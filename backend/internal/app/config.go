package app

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	JWTSecret       []byte
	InternalAPIKey  string
	Environment     string
	SeedDemoData    bool
	BootstrapEmail  string
	BootstrapPass   string
	RefreshDuration time.Duration
	CookieSecure    bool
	CookieSameSite  string
	FrontendOrigin  string
	WebhookURL      string
	RedisURL        string
	PrinterIP       string
	PrinterPort     int
	PrinterModel    string
	PrinterCopies   int
}

func LoadConfig() (Config, error) {
	if err := godotenv.Load(); err != nil {
		_ = godotenv.Load("../.env")
	}

	port := env("PORT", env("BACKEND_PORT", "3001"))
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	refreshDays, err := strconv.Atoi(env("AUTH_REFRESH_DAYS", "7"))
	if err != nil || refreshDays <= 0 {
		return Config{}, fmt.Errorf("AUTH_REFRESH_DAYS must be a positive integer")
	}
	printerPort, err := strconv.Atoi(env("PRINTER_PORT", "9100"))
	if err != nil {
		return Config{}, fmt.Errorf("PRINTER_PORT must be an integer")
	}
	printerCopies, err := strconv.Atoi(env("PRINT_COPIES", "1"))
	if err != nil || printerCopies <= 0 {
		return Config{}, fmt.Errorf("PRINT_COPIES must be a positive integer")
	}

	secure := strings.EqualFold(os.Getenv("AUTH_COOKIE_SECURE"), "true")
	environment := strings.ToLower(env("APP_ENV", "development"))
	seedDemoData, err := strconv.ParseBool(env("SEED_DEMO_DATA", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("SEED_DEMO_DATA must be true or false")
	}
	jwtSecret := env("AUTH_JWT_SECRET", "vaija-dev-secret")
	internalAPIKey := env("INTERNAL_API_KEY", "vaija-dev-internal-secret")
	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if environment == "production" {
		if len(jwtSecret) < 32 {
			return Config{}, fmt.Errorf("AUTH_JWT_SECRET must contain at least 32 characters in production")
		}
		if len(internalAPIKey) < 32 {
			return Config{}, fmt.Errorf("INTERNAL_API_KEY must contain at least 32 characters in production")
		}
		if frontendOrigin == "" {
			return Config{}, fmt.Errorf("FRONTEND_ORIGIN is required in production")
		}
	}
	bootstrapEmail := strings.TrimSpace(os.Getenv("BOOTSTRAP_ADMIN_EMAIL"))
	bootstrapPass := os.Getenv("BOOTSTRAP_ADMIN_PASSWORD")
	if (bootstrapEmail == "") != (bootstrapPass == "") {
		return Config{}, fmt.Errorf("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together")
	}
	if bootstrapPass != "" && len(bootstrapPass) < 12 {
		return Config{}, fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters")
	}
	sameSite := os.Getenv("COOKIE_SAME_SITE")
	if sameSite == "" {
		if secure {
			sameSite = "none"
		} else {
			sameSite = "lax"
		}
	}

	return Config{
		Port:            port,
		DatabaseURL:     databaseURL,
		JWTSecret:       []byte(jwtSecret),
		InternalAPIKey:  internalAPIKey,
		Environment:     environment,
		SeedDemoData:    seedDemoData,
		BootstrapEmail:  bootstrapEmail,
		BootstrapPass:   bootstrapPass,
		RefreshDuration: time.Duration(refreshDays) * 24 * time.Hour,
		CookieSecure:    secure,
		CookieSameSite:  strings.ToLower(sameSite),
		FrontendOrigin:  frontendOrigin,
		WebhookURL:      os.Getenv("N8N_ORDER_STATUS_WEBHOOK_URL"),
		RedisURL:        env("REDIS_URL", "redis://localhost:6379"),
		PrinterIP:       env("PRINTER_IP", "192.168.1.100"),
		PrinterPort:     printerPort,
		PrinterModel:    env("PRINTER_MODEL", "epson"),
		PrinterCopies:   printerCopies,
	}, nil
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
