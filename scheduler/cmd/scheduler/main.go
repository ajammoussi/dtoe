package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dtoe/scheduler/internal/config"
	"github.com/dtoe/scheduler/internal/db"
	"github.com/dtoe/scheduler/internal/scheduler"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/segmentio/kafka-go"
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

	connString := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s",
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.Database,
	)

	repo, err := db.NewRepository(context.Background(), connString)
	if err != nil {
		sugar.Fatalf("Failed to connect to database: %v", err)
	}
	defer repo.Close()

	kafkaWriter := &kafka.Writer{
		Addr:         kafka.TCP(cfg.Kafka.Brokers...),
		Topic:        cfg.Kafka.TaskQueueTopic,
		Balancer:     &kafka.Hash{},
		WriteTimeout: 10 * time.Second,
		ReadTimeout:  10 * time.Second,
	}
	defer kafkaWriter.Close()

	sched := scheduler.NewScheduler(repo, kafkaWriter, &cfg.Scheduler, sugar)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		sugar.Infow("Received shutdown signal", "signal", sig)
		cancel()
	}()

	pollTicker := time.NewTicker(cfg.Scheduler.PollInterval())
	defer pollTicker.Stop()

	retryTicker := time.NewTicker(5 * time.Second)
	defer retryTicker.Stop()

	timeoutTicker := time.NewTicker(cfg.Scheduler.TimeoutCheckInterval())
	defer timeoutTicker.Stop()

	runningTasks := make(map[string]context.CancelFunc)

	go func() {
		for {
			select {
			case <-pollTicker.C:
				if err := sched.PromoteReadyTasks(ctx); err != nil {
					sugar.Errorw("Failed to promote ready tasks", "error", err)
				}
			case <-retryTicker.C:
				if err := sched.PromoteRetryingTasks(ctx); err != nil {
					sugar.Errorw("Failed to promote retrying tasks", "error", err)
				}
			case <-timeoutTicker.C:
				if err := sched.EnforceTimeouts(ctx); err != nil {
					sugar.Errorw("Failed to enforce timeouts", "error", err)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	sugar.Infow("Scheduler started",
		"pollInterval", cfg.Scheduler.PollInterval(),
		"timeoutCheckInterval", cfg.Scheduler.TimeoutCheckInterval(),
	)

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	http.Handle("/metrics", promhttp.Handler())

	httpServer := &http.Server{Addr: ":8081"}
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			sugar.Errorf("HTTP server error: %v", err)
		}
	}()

	<-ctx.Done()

	sugar.Info("Initiating graceful shutdown...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	for taskID, cancelTask := range runningTasks {
		sugar.Debugw("Cancelling running task", "taskId", taskID)
		cancelTask()
	}

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		sugar.Errorw("HTTP server shutdown error", "error", err)
	}

	sugar.Info("Scheduler stopped")
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
	if cfg.Scheduler.PollIntervalMs < 1000 {
		logger.Warn("Poll interval is very low, setting to minimum 1000ms")
		cfg.Scheduler.PollIntervalMs = 1000
	}
	if cfg.Scheduler.TimeoutCheckMs < 5000 {
		logger.Warn("Timeout check interval is very low, setting to minimum 5000ms")
		cfg.Scheduler.TimeoutCheckMs = 5000
	}
	return nil
}
