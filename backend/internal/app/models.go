package app

import (
	"encoding/json"
	"math"
)

type User struct {
	ID           int64    `json:"id"`
	Name         string   `json:"name"`
	Role         string   `json:"role"`
	RoleKey      string   `json:"roleKey"`
	Shift        string   `json:"shift"`
	Email        string   `json:"email"`
	TenantID     string   `json:"tenantId"`
	Permissions  []string `json:"permissions"`
	PasswordHash string   `json:"-"`
}

type Category struct {
	Name        string `json:"name"`
	MenuEnabled bool   `json:"menuEnabled"`
	POSEnabled  bool   `json:"posEnabled"`
	TenantID    string `json:"tenantId,omitempty"`
}

type CategoryInput struct {
	Name             string `json:"name"`
	MenuEnabled      *bool  `json:"menuEnabled"`
	POSEnabled       *bool  `json:"posEnabled"`
	MenuEnabledSnake *bool  `json:"menu_enabled"`
	POSEnabledSnake  *bool  `json:"pos_enabled"`
}

func (c CategoryInput) Category() (Category, bool) {
	menu, pos := c.MenuEnabled, c.POSEnabled
	if menu == nil {
		menu = c.MenuEnabledSnake
	}
	if pos == nil {
		pos = c.POSEnabledSnake
	}
	if c.Name == "" || menu == nil || pos == nil {
		return Category{}, false
	}
	return Category{Name: c.Name, MenuEnabled: *menu, POSEnabled: *pos}, true
}

type SizePrice struct {
	Size  string  `json:"size"`
	Price float64 `json:"price"`
}

type Product struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Price       float64     `json:"price"`
	Category    string      `json:"category"`
	Description string      `json:"description"`
	Image       string      `json:"image"`
	Available   *bool       `json:"available"`
	SizePrices  []SizePrice `json:"sizePrices,omitempty"`
	TenantID    string      `json:"tenantId,omitempty"`
}

func (p Product) Valid() bool {
	return p.ID != "" && p.Name != "" && p.Category != "" && p.Description != "" &&
		p.Image != "" && p.Available != nil && !math.IsNaN(p.Price) && !math.IsInf(p.Price, 0) && p.Price >= 0
}

type Order struct {
	ID          int             `json:"id"`
	Customer    string          `json:"customer"`
	Phone       string          `json:"phone"`
	Address     string          `json:"address"`
	Items       json.RawMessage `json:"items"`
	Elapsed     string          `json:"elapsed"`
	Value       float64         `json:"value"`
	Status      string          `json:"status"`
	Payment     string          `json:"payment"`
	Time        string          `json:"time"`
	Source      string          `json:"source,omitempty"`
	TableNumber any             `json:"tableNumber,omitempty"`
	DeliveryFee *float64        `json:"deliveryFee,omitempty"`
	Notes       string          `json:"notes,omitempty"`
	TenantID    string          `json:"tenantId,omitempty"`
}

var allowedOrderStatuses = map[string]bool{
	"Pendente": true, "Em preparo": true, "Em producao": true,
	"Saiu para entrega": true, "Entregue": true, "Cancelado": true,
	"Pronto para retirada": true,
}

func (o Order) Valid() bool {
	if o.ID == 0 || o.Customer == "" || o.Phone == "" ||
		o.Elapsed == "" || o.Payment == "" || o.Time == "" || !allowedOrderStatuses[o.Status] {
		return false
	}
	var items []any
	return json.Unmarshal(o.Items, &items) == nil
}

func permissions(role string) []string {
	switch role {
	case "admin":
		return []string{"users:read", "users:create", "users:update", "users:change-password", "catalog:write", "orders:write"}
	case "manager":
		return []string{"users:read", "users:change-password", "catalog:write", "orders:write"}
	case "operator":
		return []string{"users:change-password", "catalog:write", "orders:write"}
	default:
		return []string{}
	}
}

func hasPermission(role, wanted string) bool {
	for _, permission := range permissions(role) {
		if permission == wanted {
			return true
		}
	}
	return false
}
