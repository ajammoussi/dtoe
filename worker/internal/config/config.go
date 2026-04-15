package config

import (
    "github.com/spf13/viper"
)

type Config struct {
    Database DatabaseConfig
    Kafka    KafkaConfig
    Worker   WorkerConfig
}

type DatabaseConfig struct {
    Host     string
    Port     int
    User     string
    Password string
    Database string
}

type KafkaConfig struct {
    Brokers         []string
    TaskQueueTopic  string
    TaskResultTopic string
    ConsumerGroup   string
}

type WorkerConfig struct {
    ID                string
    ThreadPoolSize    int
    HeartbeatIntervalMs int
}

func Load() (*Config, error) {
    viper.SetEnvPrefix("DTOE")
    viper.AutomaticEnv()

    viper.SetDefault("DATABASE_HOST", "localhost")
    viper.SetDefault("DATABASE_PORT", 5432)
    viper.SetDefault("DATABASE_USER", "dtoe")
    viper.SetDefault("DATABASE_PASSWORD", "dtoe")
    viper.SetDefault("DATABASE_DATABASE", "dtoe")

    viper.SetDefault("KAFKA_BROKERS", "localhost:9092")
    viper.SetDefault("KAFKA_TASK_QUEUE_TOPIC", "task-queue")
    viper.SetDefault("KAFKA_TASK_RESULT_TOPIC", "task-results")
    viper.SetDefault("KAFKA_CONSUMER_GROUP", "worker-group")

    viper.SetDefault("WORKER_THREAD_POOL_SIZE", 8)
    viper.SetDefault("WORKER_HEARTBEAT_INTERVAL_MS", 5000)
    viper.SetDefault("WORKER_ID", "")

    if err := viper.BindEnv("DATABASE_HOST"); err != nil {
        return nil, err
    }
    if err := viper.BindEnv("KAFKA_BROKERS"); err != nil {
        return nil, err
    }

    return &Config{
        Database: DatabaseConfig{
            Host:     viper.GetString("DATABASE_HOST"),
            Port:     viper.GetInt("DATABASE_PORT"),
            User:     viper.GetString("DATABASE_USER"),
            Password: viper.GetString("DATABASE_PASSWORD"),
            Database: viper.GetString("DATABASE_DATABASE"),
        },
        Kafka: KafkaConfig{
            Brokers:         []string{viper.GetString("KAFKA_BROKERS")},
            TaskQueueTopic:  viper.GetString("KAFKA_TASK_QUEUE_TOPIC"),
            TaskResultTopic: viper.GetString("KAFKA_TASK_RESULT_TOPIC"),
            ConsumerGroup:   viper.GetString("KAFKA_CONSUMER_GROUP"),
        },
        Worker: WorkerConfig{
            ID:                viper.GetString("WORKER_ID"),
            ThreadPoolSize:    viper.GetInt("WORKER_THREAD_POOL_SIZE"),
            HeartbeatIntervalMs: viper.GetInt("WORKER_HEARTBEAT_INTERVAL_MS"),
        },
    }, nil
}
