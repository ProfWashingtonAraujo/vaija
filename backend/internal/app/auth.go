package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type authClaims struct {
	Email    string `json:"email"`
	Role     string `json:"role"`
	RoleKey  string `json:"roleKey"`
	TenantID string `json:"tenantId"`
	jwt.RegisteredClaims
}

type authInfo struct {
	UserID   int64
	Email    string
	Role     string
	RoleKey  string
	TenantID string
}

type authContextKey struct{}

func (s *Server) signAccessToken(user User) (string, error) {
	now := time.Now()
	claims := authClaims{
		Email: user.Email, Role: user.Role, RoleKey: user.RoleKey, TenantID: user.TenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   formatInt64(user.ID),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.cfg.JWTSecret)
}

func randomToken() (string, error) {
	buffer := make([]byte, 48)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func (s *Server) newSession(ctx context.Context, user User) (access, refresh string, err error) {
	access, err = s.signAccessToken(user)
	if err != nil {
		return "", "", err
	}
	refresh, err = randomToken()
	if err != nil {
		return "", "", err
	}
	err = s.store.CreateSession(ctx, user.ID, refresh, time.Now().Add(s.cfg.RefreshDuration))
	return access, refresh, err
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var token string
		if cookie, err := r.Cookie("vaija_access_token"); err == nil {
			token = cookie.Value
		} else if authorization := r.Header.Get("Authorization"); strings.HasPrefix(authorization, "Bearer ") {
			token = strings.TrimPrefix(authorization, "Bearer ")
		}
		if token == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "missing_auth_token"})
			return
		}

		claims := &authClaims{}
		parsed, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (any, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, errors.New("unexpected signing method")
			}
			return s.cfg.JWTSecret, nil
		})
		if err != nil || !parsed.Valid {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "invalid_auth_token"})
			return
		}
		userID, err := parseInt64(claims.Subject)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": "invalid_auth_token"})
			return
		}
		tenant := claims.TenantID
		if tenant == "" {
			tenant = r.Header.Get("X-Tenant-Id")
		}
		if tenant == "" {
			tenant = "default"
		}
		info := authInfo{UserID: userID, Email: claims.Email, Role: claims.Role, RoleKey: claims.RoleKey, TenantID: tenant}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), authContextKey{}, info)))
	})
}

func currentAuth(r *http.Request) authInfo {
	return r.Context().Value(authContextKey{}).(authInfo)
}

func (s *Server) setAuthCookies(w http.ResponseWriter, access, refresh string) {
	http.SetCookie(w, &http.Cookie{Name: "vaija_access_token", Value: access, Path: "/", HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: sameSite(s.cfg.CookieSameSite), MaxAge: 900})
	http.SetCookie(w, &http.Cookie{Name: "vaija_refresh_token", Value: refresh, Path: "/", HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: sameSite(s.cfg.CookieSameSite), MaxAge: int(s.cfg.RefreshDuration.Seconds())})
}

func (s *Server) clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: "vaija_access_token", Path: "/", HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: sameSite(s.cfg.CookieSameSite), MaxAge: -1})
	http.SetCookie(w, &http.Cookie{Name: "vaija_refresh_token", Path: "/", HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: sameSite(s.cfg.CookieSameSite), MaxAge: -1})
}

func sameSite(value string) http.SameSite {
	switch strings.ToLower(value) {
	case "none":
		return http.SameSiteNoneMode
	case "strict":
		return http.SameSiteStrictMode
	default:
		return http.SameSiteLaxMode
	}
}
