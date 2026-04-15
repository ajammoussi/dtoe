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
        <-sigChan
        sugar.Info("Received shutdown signal, stopping...")
        cancel()
    }()

    pollTicker := time.NewTicker(cfg.Scheduler.PollInterval())
    defer pollTicker.Stop()

    timeoutTicker := time.NewTicker(cfg.Scheduler.TimeoutCheckInterval())
    defer timeoutTicker.Stop()

    go func() {
        for {
            select {
            case <-pollTicker.C:
                if err := sched.PromoteReadyTasks(ctx); err != nil {
                    sugar.Errorw("Failed to promote ready tasks", "error", err)
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

    httpServer := &http.Server{Addr: ":8081"}
    go func() {
        if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            sugar.Errorf("HTTP server error: %v", err)
        }
    }()

    <-ctx.Done()

    shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer shutdownCancel()

    httpServer.Shutdown(shutdownCtx)
    sugar.Info("Scheduler stopped")
}
