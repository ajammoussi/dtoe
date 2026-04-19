package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dtoe/worker/internal/config"
	"github.com/dtoe/worker/internal/kafka"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	gozap "go.uber.org/zap"
)

func main() {
	logger, _ := gozap.NewProduction()
	sugar := logger.Sugar()
	defer sugar.Sync()

	cfg, err := config.Load()
	if err != nil {
		sugar.Fatalf("Failed to load config: %v", err)
	}

	if err := validateConfig(cfg, sugar); err != nil {
		sugar.Fatalf("Config validation failed: %v", err)
	}

	consumer, err := kafka.NewConsumer(cfg, sugar)
	if err != nil {
		sugar.Fatalf("Failed to create consumer: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		sugar.Infow("Received shutdown signal", "signal", sig)
		cancel()
	}()

	heartbeatTicker := time.NewTicker(time.Duration(cfg.Worker.HeartbeatIntervalMs) * time.Millisecond)
	defer heartbeatTicker.Stop()

	go func() {
		for {
			select {
			case <-heartbeatTicker.C:
				if err := consumer.SendHeartbeat(ctx); err != nil {
					sugar.Errorw("Failed to send heartbeat", "error", err)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	sugar.Infow("Worker started",
		"workerId", consumer.GetWorkerID(),
		"threadPoolSize", cfg.Worker.ThreadPoolSize,
	)

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"OK","workerId":"%s","activeTasks":%d}`,
			consumer.GetWorkerID(), consumer.GetActiveTasks())
	})
	http.Handle("/metrics", promhttp.Handler())

	httpServer := &http.Server{Addr: ":8082"}
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			sugar.Errorf("HTTP server error: %v", err)
		}
	}()

	consumerCtx, consumerCancel := context.WithCancel(context.Background())
	go func() {
		if err := consumer.Run(consumerCtx); err != nil {
			sugar.Errorw("Consumer error", "error", err)
		}
	}()

	<-ctx.Done()

	sugar.Info("Initiating graceful shutdown...")

	consumerCancel()

	if ok := consumer.WaitForCompletion(ctx, 60*time.Second); !ok {
		sugar.Warn("Timeout waiting for in-flight tasks to complete")
	} else {
		sugar.Info("All in-flight tasks completed")
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		sugar.Errorw("HTTP server shutdown error", "error", err)
	}

	consumer.Close()

	sugar.Info("Worker stopped")
}

func validateConfig(cfg *config.Config, logger *gozap.SugaredLogger) error {
	if cfg.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if cfg.Database.Database == "" {
		return fmt.Errorf("database name is required")
	}
	if len(cfg.Kafka.Brokers) == 0 {
		return fmt.Errorf("kafka brokers are required")
	}
	if cfg.Kafka.TaskQueueTopic == "" {
		return fmt.Errorf("kafka task queue topic is required")
	}
	if cfg.Kafka.TaskResultTopic == "" {
		return fmt.Errorf("kafka task result topic is required")
	}
	if cfg.Worker.ThreadPoolSize < 1 {
		logger.Warn("Thread pool size is too low, setting to minimum 1")
		cfg.Worker.ThreadPoolSize = 1
	}
	if cfg.Worker.ThreadPoolSize > 100 {
		logger.Warn("Thread pool size is very high, consider reducing")
	}
	if cfg.Worker.HeartbeatIntervalMs < 1000 {
		logger.Warn("Heartbeat interval is very low, setting to minimum 1000ms")
		cfg.Worker.HeartbeatIntervalMs = 1000
	}
	return nil
}