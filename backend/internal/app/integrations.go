package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

type PrintQueue struct {
	client *redis.Client
	nextID atomic.Uint64
}

func NewPrintQueue(redisURL string) (*PrintQueue, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &PrintQueue{client: redis.NewClient(options)}, nil
}

func (q *PrintQueue) Close() error { return q.client.Close() }

func (q *PrintQueue) Add(ctx context.Context, order Order) (string, error) {
	id := fmt.Sprintf("%d-%d", time.Now().UnixMilli(), q.nextID.Add(1))
	payload := map[string]any{
		"orderId": order.ID, "customer": order.Customer, "phone": order.Phone,
		"address": order.Address, "items": json.RawMessage(order.Items), "value": order.Value,
		"payment": order.Payment, "source": order.Source, "tableNumber": order.TableNumber,
		"notes": order.Notes, "status": order.Status, "createdAt": time.Now().UTC().Format(time.RFC3339),
	}
	if payload["source"] == "" {
		payload["source"] = "Online"
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	if err := q.client.LPush(ctx, "print-jobs", data).Err(); err != nil {
		return "", err
	}
	return id, nil
}

func (q *PrintQueue) Waiting(ctx context.Context) (int64, error) {
	return q.client.LLen(ctx, "print-jobs").Result()
}

type PrinterConfig struct {
	IP           string `json:"ip"`
	Port         int    `json:"port"`
	Model        string `json:"model"`
	AutoPrint    bool   `json:"autoPrint"`
	PrintLogo    bool   `json:"printLogo"`
	Copies       int    `json:"copies"`
	SoundEnabled bool   `json:"soundEnabled"`
}

type safePrinterConfig struct {
	sync.RWMutex
	value PrinterConfig
}

var nonDigits = regexp.MustCompile(`\D`)

func (s *Server) notifyOrder(ctx context.Context, order Order) error {
	if s.cfg.WebhookURL == "" {
		return nil
	}
	payload := map[string]any{
		"orderId": order.ID, "customer": order.Customer,
		"phone": nonDigits.ReplaceAllString(order.Phone, ""), "rawPhone": order.Phone,
		"status": order.Status, "items": json.RawMessage(order.Items), "value": order.Value,
		"payment": order.Payment, "time": order.Time, "elapsed": order.Elapsed,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("webhook returned %s", response.Status)
	}
	return nil
}

func (s *Server) notifyOrders(ctx context.Context, orders []Order) bool {
	var failed atomic.Bool
	var wait sync.WaitGroup
	limit := make(chan struct{}, 4)
	for _, order := range orders {
		wait.Add(1)
		go func() {
			defer wait.Done()
			limit <- struct{}{}
			defer func() { <-limit }()
			if err := s.notifyOrder(ctx, order); err != nil {
				failed.Store(true)
			}
		}()
	}
	wait.Wait()
	return failed.Load()
}
