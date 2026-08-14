package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthContract(t *testing.T) {
	server := NewServer(Config{RedisURL: "redis://localhost:6379"}, nil)
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["ok"] != true || body["database"] != "postgres" {
		t.Fatalf("unexpected response: %#v", body)
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	server := NewServer(Config{RedisURL: "redis://localhost:6379", FrontendOrigin: "https://app.example.com"}, nil)
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	request.Header.Set("Origin", "https://malicious.example.com")
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
}

func TestCategoryInputAcceptsBothJSONConventions(t *testing.T) {
	for _, input := range []string{
		`{"name":"Bebidas","menuEnabled":true,"posEnabled":false}`,
		`{"name":"Bebidas","menu_enabled":true,"pos_enabled":false}`,
	} {
		var payload CategoryInput
		if err := json.Unmarshal([]byte(input), &payload); err != nil {
			t.Fatal(err)
		}
		category, ok := payload.Category()
		if !ok || !category.MenuEnabled || category.POSEnabled {
			t.Fatalf("unexpected category from %s: %#v", input, category)
		}
	}
}

func TestOrderValidation(t *testing.T) {
	valid := Order{ID: 1, Customer: "Cliente", Phone: "11999999999", Address: "Rua A", Items: []byte(`["Pizza"]`), Elapsed: "agora", Status: "Pendente", Payment: "Pix", Time: "12:00"}
	if !valid.Valid() {
		t.Fatal("expected order to be valid")
	}
	valid.Status = "desconhecido"
	if valid.Valid() {
		t.Fatal("expected unknown status to be invalid")
	}
}
