package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
)

func TestPrintQueueUsesWorkerCompatibleRedisList(t *testing.T) {
	redisServer := miniredis.RunT(t)
	queue, err := NewPrintQueue("redis://" + redisServer.Addr())
	if err != nil {
		t.Fatal(err)
	}
	order := Order{ID: 42, Customer: "Cliente", Items: []byte(`["Pizza"]`), Source: "Balcao"}
	if _, err := queue.Add(context.Background(), order); err != nil {
		t.Fatal(err)
	}

	values, err := redisServer.List("print-jobs")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 {
		t.Fatalf("queue length = %d, want 1", len(values))
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(values[0]), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["orderId"] != float64(42) || payload["source"] != "Balcao" {
		t.Fatalf("unexpected print payload: %#v", payload)
	}
}

func TestNotifyOrderChecksWebhookStatus(t *testing.T) {
	webhook := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer webhook.Close()

	server := &Server{
		cfg:        Config{WebhookURL: webhook.URL},
		httpClient: &http.Client{Timeout: time.Second},
	}
	err := server.notifyOrder(context.Background(), Order{ID: 1, Phone: "(11) 99999-9999", Items: []byte(`[]`)})
	if err == nil {
		t.Fatal("expected non-2xx webhook response to fail")
	}
}
