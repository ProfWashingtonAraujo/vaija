package app

import (
	"strings"
	"testing"
)

func TestLoadConfigRejectsWeakProductionSecrets(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgresql://localhost/vaija")
	t.Setenv("AUTH_JWT_SECRET", "short")
	t.Setenv("INTERNAL_API_KEY", strings.Repeat("i", 32))
	t.Setenv("FRONTEND_ORIGIN", "https://app.example.com")

	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected weak production JWT secret to be rejected")
	}
}

func TestLoadConfigAcceptsSecureProductionConfig(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgresql://localhost/vaija")
	t.Setenv("AUTH_JWT_SECRET", strings.Repeat("j", 32))
	t.Setenv("INTERNAL_API_KEY", strings.Repeat("i", 32))
	t.Setenv("FRONTEND_ORIGIN", "https://app.example.com")
	t.Setenv("SEED_DEMO_DATA", "false")
	t.Setenv("BOOTSTRAP_ADMIN_EMAIL", "admin@example.com")
	t.Setenv("BOOTSTRAP_ADMIN_PASSWORD", "secure-password")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Environment != "production" || cfg.SeedDemoData {
		t.Fatalf("unexpected production config: %#v", cfg)
	}
}
