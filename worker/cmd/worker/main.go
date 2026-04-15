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

    consumer, err := kafka.NewConsumer(cfg, sugar)
    if err != nil {
        sugar.Fatalf("Failed to create consumer: %v", err)
    }
    defer consumer.Close()

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        <-sigChan
        sugar.Info("Received shutdown signal, stopping...")
        cancel()
    }()

    go func() {
        ticker := time.NewTicker(time.Duration(cfg.Worker.HeartbeatIntervalMs) * time.Millisecond)
        defer ticker.Stop()

        for {
            select {
            case <-ticker.C:
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

    httpServer := &http.Server{Addr: ":8082"}
    go func() {
        if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            sugar.Errorf("HTTP server error: %v", err)
        }
    }()

    go func() {
        if err := consumer.Run(ctx); err != nil {
            sugar.Errorw("Consumer error", "error", err)
        }
    }()

    <-ctx.Done()

    shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer shutdownCancel()

    httpServer.Shutdown(shutdownCtx)
    sugar.Info("Worker stopped")
}
