package app

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

type Server struct {
	cfg        Config
	store      *Store
	queue      *PrintQueue
	printer    safePrinterConfig
	httpClient *http.Client
}

func NewServer(cfg Config, store *Store) *Server {
	queue, err := NewPrintQueue(cfg.RedisURL)
	if err != nil {
		log.Printf("configure Redis print queue: %v", err)
	}
	return &Server{
		cfg: cfg, store: store, queue: queue,
		printer:    safePrinterConfig{value: PrinterConfig{IP: cfg.PrinterIP, Port: cfg.PrinterPort, Model: cfg.PrinterModel, AutoPrint: true, PrintLogo: true, Copies: cfg.PrinterCopies, SoundEnabled: true}},
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *Server) Close() {
	if s.queue != nil {
		_ = s.queue.Close()
	}
}

func (s *Server) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(s.corsMiddleware)
	r.Get("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "database": "postgres"})
	})
	r.Post("/api/auth/login", s.login)
	r.Post("/api/auth/refresh", s.refresh)
	r.Post("/api/auth/logout", s.logout)
	r.Put("/api/orders/{orderID}/status", s.updateOrderStatusInternal)
	r.Get("/api/public/{tenantID}/categories", s.getPublicCategories)
	r.Get("/api/public/{tenantID}/products", s.getPublicProducts)
	r.Get("/api/public/{tenantID}/orders", s.findPublicOrders)
	r.Post("/api/public/{tenantID}/orders", s.createPublicOrder)
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/api/auth/me", s.me)
		r.Get("/api/categories", s.getCategories)
		r.Put("/api/categories", s.putCategories)
		r.Get("/api/products", s.getProducts)
		r.Put("/api/products", s.putProducts)
		r.Get("/api/orders", s.getOrders)
		r.Put("/api/orders", s.putOrders)
		r.Get("/api/users", s.getUsers)
		r.Post("/api/users", s.createUser)
		r.Post("/api/users/change-password", s.changePassword)
		r.Get("/api/platform/users", s.getPlatformUsers)
		r.Post("/api/platform/users", s.createPlatformUser)
		r.Put("/api/platform/users/{userID}", s.updatePlatformUser)
		r.Get("/api/platform/accesses", s.getTenantUsers)
		r.Post("/api/platform/accesses", s.createTenantUser)
		r.Put("/api/platform/accesses/{userID}", s.updateTenantUser)
		r.Delete("/api/platform/accesses/{userID}", s.deleteTenantUser)
		r.Get("/api/printer/config", s.getPrinterConfig)
		r.Put("/api/printer/config", s.putPrinterConfig)
		r.Post("/api/printer/test", s.testPrinter)
		r.Get("/api/printer/status", s.printerStatus)
		r.Post("/api/printer/print-order", s.printOrder)
	})
	return r
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (s.cfg.FrontendOrigin == "" || origin == s.cfg.FrontendOrigin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Tenant-Id")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			if s.cfg.FrontendOrigin != "" && origin != s.cfg.FrontendOrigin {
				http.Error(w, "Not allowed by CORS", http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if origin != "" && s.cfg.FrontendOrigin != "" && origin != s.cfg.FrontendOrigin {
			http.Error(w, "Not allowed by CORS", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		TenantID string `json:"tenantId"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Email == "" || body.Password == "" {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "missing_credentials"})
		return
	}
	tenant := r.Header.Get("X-Tenant-Id")
	if tenant == "" {
		tenant = body.TenantID
	}
	var user User
	var err error
	if tenant == "" {
		user, err = s.store.UniqueUserByEmail(r.Context(), body.Email)
	} else {
		user, err = s.store.UserByEmail(r.Context(), body.Email, tenant, false)
	}
	if err != nil || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(body.Password)) != nil {
		writeJSON(w, 401, map[string]any{"ok": false, "error": "invalid_credentials"})
		return
	}
	tenant = user.TenantID
	access, refresh, err := s.newSession(r.Context(), user)
	if err != nil {
		internalError(w, err)
		return
	}
	s.setAuthCookies(w, access, refresh)
	writeJSON(w, 200, map[string]any{"ok": true, "user": user, "tenantId": tenant})
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("vaija_refresh_token")
	if err != nil {
		writeJSON(w, 401, map[string]any{"ok": false, "error": "missing_refresh_token"})
		return
	}
	user, err := s.store.RotateSession(r.Context(), cookie.Value)
	if err != nil {
		s.clearAuthCookies(w)
		writeJSON(w, 401, map[string]any{"ok": false, "error": "invalid_refresh_token"})
		return
	}
	access, refresh, err := s.newSession(r.Context(), user)
	if err != nil {
		internalError(w, err)
		return
	}
	s.setAuthCookies(w, access, refresh)
	writeJSON(w, 200, map[string]any{"ok": true, "user": user, "tenantId": user.TenantID})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("vaija_refresh_token"); err == nil {
		_ = s.store.DeleteSession(r.Context(), cookie.Value)
	}
	s.clearAuthCookies(w)
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	auth := currentAuth(r)
	user, err := s.store.UserByID(r.Context(), auth.UserID, auth.TenantID, false)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "user_not_found"})
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "user": user, "tenantId": auth.TenantID})
}

func (s *Server) getCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := s.store.Categories(r.Context(), currentAuth(r).TenantID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"categories": categories})
}

func (s *Server) getPublicCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := s.store.Categories(r.Context(), chi.URLParam(r, "tenantID"))
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"categories": categories})
}

func (s *Server) putCategories(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Categories *[]CategoryInput `json:"categories"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Categories == nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_categories_payload"})
		return
	}
	categories := make([]Category, len(*body.Categories))
	for i, input := range *body.Categories {
		category, ok := input.Category()
		if !ok {
			writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_categories_payload"})
			return
		}
		categories[i] = category
	}
	if err := s.store.ReplaceCategories(r.Context(), categories, currentAuth(r).TenantID); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "categories": categories})
}

func (s *Server) getProducts(w http.ResponseWriter, r *http.Request) {
	products, err := s.store.Products(r.Context(), currentAuth(r).TenantID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"products": products})
}

func (s *Server) getPublicProducts(w http.ResponseWriter, r *http.Request) {
	products, err := s.store.Products(r.Context(), chi.URLParam(r, "tenantID"))
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"products": products})
}

func (s *Server) putProducts(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Products *[]Product `json:"products"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Products == nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_products_payload"})
		return
	}
	for _, product := range *body.Products {
		if !product.Valid() {
			writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_products_payload"})
			return
		}
	}
	if err := s.store.ReplaceProducts(r.Context(), *body.Products, currentAuth(r).TenantID); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "products": *body.Products})
}

func (s *Server) getOrders(w http.ResponseWriter, r *http.Request) {
	orders, err := s.store.Orders(r.Context(), currentAuth(r).TenantID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"orders": orders})
}

func (s *Server) putOrders(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Orders *[]Order `json:"orders"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Orders == nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_orders_payload"})
		return
	}
	for _, order := range *body.Orders {
		if !order.Valid() {
			writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_orders_payload"})
			return
		}
	}
	changed, added, err := s.store.ReplaceOrders(r.Context(), *body.Orders, currentAuth(r).TenantID)
	if err != nil {
		internalError(w, err)
		return
	}
	failed := s.notifyOrders(r.Context(), changed)
	if s.queue != nil {
		for _, order := range added {
			if _, err := s.queue.Add(r.Context(), order); err != nil {
				log.Printf("queue order %d for printing: %v", order.ID, err)
			}
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true, "orders": *body.Orders, "notifications": map[string]any{"changed": len(changed), "failed": failed}})
}

func (s *Server) updateOrderStatusInternal(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Internal-API-Key") == "" || r.Header.Get("X-Internal-API-Key") != s.cfg.InternalAPIKey {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "invalid_internal_api_key"})
		return
	}
	orderID, err := strconv.Atoi(chi.URLParam(r, "orderID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_order_id"})
		return
	}
	var body struct {
		Status   string `json:"status"`
		TenantID string `json:"tenantId"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if !allowedOrderStatuses[body.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_order_status"})
		return
	}
	if body.TenantID == "" {
		body.TenantID = "default"
	}
	order, err := s.store.UpdateOrderStatus(r.Context(), orderID, body.TenantID, body.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "order_not_found"})
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	if err := s.notifyOrder(r.Context(), order); err != nil {
		log.Printf("notify paid order %d: %v", order.ID, err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "order": order})
}

func (s *Server) createPublicOrder(w http.ResponseWriter, r *http.Request) {
	var order Order
	if !decodeJSON(w, r, &order) {
		return
	}
	order.ID = 1
	if !order.Valid() {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_order_payload"})
		return
	}
	created, err := s.store.CreateOrder(r.Context(), order, chi.URLParam(r, "tenantID"))
	if err != nil {
		internalError(w, err)
		return
	}
	if err := s.notifyOrder(r.Context(), created); err != nil {
		log.Printf("notify new public order %d: %v", created.ID, err)
	}
	if s.queue != nil {
		if _, err := s.queue.Add(r.Context(), created); err != nil {
			log.Printf("queue public order %d for printing: %v", created.ID, err)
		}
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "order": created})
}

func (s *Server) findPublicOrders(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "missing_query"})
		return
	}
	orders, err := s.store.FindOrders(r.Context(), chi.URLParam(r, "tenantID"), query)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": orders})
}

func (s *Server) getUsers(w http.ResponseWriter, r *http.Request) {
	auth := currentAuth(r)
	if !hasPermission(auth.RoleKey, "users:read") {
		writeJSON(w, 403, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	users, err := s.store.Users(r.Context(), auth.TenantID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "users": users})
}

func (s *Server) createUser(w http.ResponseWriter, r *http.Request) {
	auth := currentAuth(r)
	if !hasPermission(auth.RoleKey, "users:create") {
		writeJSON(w, 403, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	var body struct {
		Name     string `json:"name"`
		RoleKey  string `json:"roleKey"`
		Shift    string `json:"shift"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Name == "" || body.RoleKey == "" || body.Shift == "" || body.Email == "" || body.Password == "" {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "missing_user_fields"})
		return
	}
	labels := map[string]string{"admin": "Administrador", "manager": "Gerente", "operator": "Operador"}
	role, ok := labels[body.RoleKey]
	if !ok {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_role"})
		return
	}
	if len(body.Password) < 6 {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "password_too_short"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	if err != nil {
		internalError(w, err)
		return
	}
	user, err := s.store.CreateUser(r.Context(), User{Name: body.Name, Role: role, RoleKey: body.RoleKey, Shift: body.Shift, Email: body.Email, TenantID: auth.TenantID, PasswordHash: string(hash)})
	if err != nil {
		var databaseError *pgconn.PgError
		if errors.As(err, &databaseError) && databaseError.Code == "23505" {
			writeJSON(w, 400, map[string]any{"ok": false, "error": "email_already_exists"})
			return
		}
		internalError(w, err)
		return
	}
	writeJSON(w, 201, map[string]any{"ok": true, "user": user})
}

func platformAdmin(r *http.Request) bool {
	auth := currentAuth(r)
	return auth.TenantID == "admin" && auth.RoleKey == "admin"
}

func validPlatformPermissions(values []string) bool {
	allowed := make(map[string]bool, len(platformPermissions))
	for _, permission := range platformPermissions {
		allowed[permission] = true
	}
	for _, permission := range values {
		if !allowed[permission] {
			return false
		}
	}
	return true
}

func (s *Server) getPlatformUsers(w http.ResponseWriter, r *http.Request) {
	if !platformAdmin(r) {
		writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	users, err := s.store.Users(r.Context(), "admin")
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "users": users})
}

func (s *Server) createPlatformUser(w http.ResponseWriter, r *http.Request) {
	if !platformAdmin(r) {
		writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	var body struct {
		Name        string   `json:"name"`
		Email       string   `json:"email"`
		Password    string   `json:"password"`
		Permissions []string `json:"permissions"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	if body.Name == "" || !strings.Contains(body.Email, "@") || len(body.Password) < 8 || !validPlatformPermissions(body.Permissions) {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_platform_user"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		internalError(w, err)
		return
	}
	user, err := s.store.CreatePlatformUser(r.Context(), User{Name: body.Name, Email: body.Email, PasswordHash: string(hash), Permissions: body.Permissions})
	if err != nil {
		var databaseError *pgconn.PgError
		if errors.As(err, &databaseError) && databaseError.Code == "23505" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "email_already_exists"})
			return
		}
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "user": user})
}

func (s *Server) updatePlatformUser(w http.ResponseWriter, r *http.Request) {
	if !platformAdmin(r) {
		writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	userID, err := parseInt64(chi.URLParam(r, "userID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_user_id"})
		return
	}
	var body struct {
		Name        string   `json:"name"`
		Email       string   `json:"email"`
		Password    string   `json:"password"`
		Permissions []string `json:"permissions"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	if body.Name == "" || !strings.Contains(body.Email, "@") || (body.Password != "" && len(body.Password) < 8) || !validPlatformPermissions(body.Permissions) {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_platform_user"})
		return
	}
	passwordHash := ""
	if body.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
		if err != nil {
			internalError(w, err)
			return
		}
		passwordHash = string(hash)
	}
	user, err := s.store.UpdatePlatformUser(r.Context(), userID, body.Name, body.Email, passwordHash, body.Permissions)
	if err != nil {
		var databaseError *pgconn.PgError
		if errors.As(err, &databaseError) && databaseError.Code == "23505" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "email_already_exists"})
			return
		}
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "user": user})
}

func (s *Server) getTenantUsers(w http.ResponseWriter, r *http.Request) {
	if !platformAdmin(r) {
		writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	users, err := s.store.TenantUsers(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "users": users})
}

func managedUserRole(roleKey string) (string, bool) {
	role, ok := map[string]string{"admin": "Administrador", "manager": "Gerente", "operator": "Operador"}[roleKey]
	return role, ok
}

func (s *Server) createTenantUser(w http.ResponseWriter, r *http.Request) {
	if !platformAdmin(r) {
		writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	var body struct {
		TenantID string `json:"tenantId"`
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		RoleKey  string `json:"roleKey"`
		Shift    string `json:"shift"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	body.TenantID = strings.TrimSpace(body.TenantID)
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	body.Shift = strings.TrimSpace(body.Shift)
	role, validRole := managedUserRole(body.RoleKey)
	if body.TenantID == "" || body.TenantID == "admin" || body.Name == "" || !strings.Contains(body.Email, "@") || len(body.Password) < 8 || body.Shift == "" || !validRole {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_tenant_user"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		internalError(w, err)
		return
	}
	user, err := s.store.CreateUser(r.Context(), User{TenantID: body.TenantID, Name: body.Name, Email: body.Email, PasswordHash: string(hash), Role: role, RoleKey: body.RoleKey, Shift: body.Shift})
	if err != nil {
		var databaseError *pgconn.PgError
		if errors.As(err, &databaseError) && databaseError.Code == "23505" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "email_already_exists"})
			return
		}
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "user": user})
}

func (s *Server) updateTenantUser(w http.ResponseWriter, r *http.Request) {
	if !platformAdmin(r) {
		writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	userID, err := parseInt64(chi.URLParam(r, "userID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_user_id"})
		return
	}
	var body struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		RoleKey  string `json:"roleKey"`
		Shift    string `json:"shift"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	body.Shift = strings.TrimSpace(body.Shift)
	role, validRole := managedUserRole(body.RoleKey)
	if body.Name == "" || !strings.Contains(body.Email, "@") || (body.Password != "" && len(body.Password) < 8) || body.Shift == "" || !validRole {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_tenant_user"})
		return
	}
	passwordHash := ""
	if body.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
		if err != nil {
			internalError(w, err)
			return
		}
		passwordHash = string(hash)
	}
	user, err := s.store.UpdateTenantUser(r.Context(), userID, body.Name, body.Email, role, body.RoleKey, body.Shift, passwordHash)
	if err != nil {
		var databaseError *pgconn.PgError
		if errors.As(err, &databaseError) && databaseError.Code == "23505" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "email_already_exists"})
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "user_not_found"})
			return
		}
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "user": user})
}

func (s *Server) deleteTenantUser(w http.ResponseWriter, r *http.Request) {
	if !platformAdmin(r) {
		writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "forbidden"})
		return
	}
	userID, err := parseInt64(chi.URLParam(r, "userID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid_user_id"})
		return
	}
	if err := s.store.DeleteTenantUser(r.Context(), userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "user_not_found"})
			return
		}
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NextPassword    string `json:"nextPassword"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.CurrentPassword == "" || body.NextPassword == "" {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "missing_password_fields"})
		return
	}
	if len(body.NextPassword) < 6 {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "password_too_short"})
		return
	}
	auth := currentAuth(r)
	user, err := s.store.UserByID(r.Context(), auth.UserID, auth.TenantID, true)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "user_not_found"})
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(body.CurrentPassword)) != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_current_password"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.NextPassword), 10)
	if err != nil {
		internalError(w, err)
		return
	}
	if err := s.store.UpdatePassword(r.Context(), user.ID, auth.TenantID, string(hash)); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) getPrinterConfig(w http.ResponseWriter, _ *http.Request) {
	s.printer.RLock()
	defer s.printer.RUnlock()
	writeJSON(w, 200, s.printer.value)
}

func (s *Server) putPrinterConfig(w http.ResponseWriter, r *http.Request) {
	var updates map[string]json.RawMessage
	if !decodeJSON(w, r, &updates) {
		return
	}
	s.printer.Lock()
	defer s.printer.Unlock()
	for key, value := range updates {
		switch key {
		case "ip":
			_ = json.Unmarshal(value, &s.printer.value.IP)
		case "port":
			_ = json.Unmarshal(value, &s.printer.value.Port)
		case "model":
			_ = json.Unmarshal(value, &s.printer.value.Model)
		case "autoPrint":
			_ = json.Unmarshal(value, &s.printer.value.AutoPrint)
		case "printLogo":
			_ = json.Unmarshal(value, &s.printer.value.PrintLogo)
		case "copies":
			_ = json.Unmarshal(value, &s.printer.value.Copies)
		case "soundEnabled":
			_ = json.Unmarshal(value, &s.printer.value.SoundEnabled)
		}
	}
	writeJSON(w, 200, s.printer.value)
}

func (s *Server) testPrinter(w http.ResponseWriter, r *http.Request) {
	if s.queue == nil {
		writeJSON(w, 500, map[string]any{"success": false, "error": "Redis queue is not configured"})
		return
	}
	order := Order{ID: 9999, Customer: "TESTE DE IMPRESSAO", Phone: "(11) 99999-9999", Address: "Rua de Teste, 123", Items: []byte(`["1x Pizza Margherita","1x Coca-Cola 2L"]`), Value: 45.90, Payment: "Pix", Source: "Teste", Notes: "Este e um cupom de teste"}
	id, err := s.queue.Add(r.Context(), order)
	if err != nil {
		writeJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "jobId": id, "message": "Job de teste adicionado a fila"})
}

func (s *Server) printerStatus(w http.ResponseWriter, r *http.Request) {
	if s.queue == nil {
		writeJSON(w, 500, map[string]any{"error": "Redis queue is not configured"})
		return
	}
	waiting, err := s.queue.Waiting(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	s.printer.RLock()
	printer := map[string]any{"ip": s.printer.value.IP, "port": s.printer.value.Port, "model": s.printer.value.Model}
	s.printer.RUnlock()
	writeJSON(w, 200, map[string]any{"printer": printer, "queue": map[string]any{"waiting": waiting, "active": 0, "completed": 0, "failed": 0}})
}

func (s *Server) printOrder(w http.ResponseWriter, r *http.Request) {
	var order Order
	if !decodeJSON(w, r, &order) {
		return
	}
	if order.ID == 0 || len(order.Items) == 0 {
		writeJSON(w, 400, map[string]any{"error": "Dados do pedido incompletos"})
		return
	}
	if s.queue == nil {
		writeJSON(w, 500, map[string]any{"success": false, "error": "Redis queue is not configured"})
		return
	}
	id, err := s.queue.Add(r.Context(), order)
	if err != nil {
		writeJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "jobId": id})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, destination any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	if err := json.NewDecoder(r.Body).Decode(destination); err != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid_json"})
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func internalError(w http.ResponseWriter, err error) {
	log.Printf("request failed: %v", err)
	writeJSON(w, 500, map[string]any{"ok": false, "error": "internal_error"})
}
func formatInt64(value int64) string         { return strconv.FormatInt(value, 10) }
func parseInt64(value string) (int64, error) { return strconv.ParseInt(value, 10, 64) }
