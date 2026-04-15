package config

import (
    "time"

    "github.com/spf13/viper"
)

type Config struct {
    Database DatabaseConfig
    Kafka    KafkaConfig
    Scheduler SchedulerConfig
}

type DatabaseConfig struct {
    Host     string
    Port     int
    User     string
    Password string
    Database string
}

type KafkaConfig struct {
    Brokers       []string
    TaskQueueTopic string
}

type SchedulerConfig struct {
    PollIntervalMs     int
    TimeoutCheckMs     int
    DeadThresholdSec   int
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

    viper.SetDefault("SCHEDULER_POLL_INTERVAL_MS", 5000)
    viper.SetDefault("SCHEDULER_TIMEOUT_CHECK_MS", 10000)
    viper.SetDefault("SCHEDULER_DEAD_THRESHOLD_SEC", 60)

    if err := viper.BindEnv("DATABASE_HOST"); err != nil {
        return nil, err
    }
    if err := viper.BindEnv("DATABASE_PORT"); err != nil {
        return nil, err
    }
    if err := viper.BindEnv("DATABASE_USER"); err != nil {
        return nil, err
    }
    if err := viper.BindEnv("DATABASE_PASSWORD"); err != nil {
        return nil, err
    }
    if err := viper.BindEnv("DATABASE_DATABASE"); err != nil {
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
            Brokers:       []string{viper.GetString("KAFKA_BROKERS")},
            TaskQueueTopic: viper.GetString("KAFKA_TASK_QUEUE_TOPIC"),
        },
        Scheduler: SchedulerConfig{
            PollIntervalMs:   viper.GetInt("SCHEDULER_POLL_INTERVAL_MS"),
            TimeoutCheckMs:   viper.GetInt("SCHEDULER_TIMEOUT_CHECK_MS"),
            DeadThresholdSec: viper.GetInt("SCHEDULER_DEAD_THRESHOLD_SEC"),
        },
    }, nil
}

func (c *SchedulerConfig) PollInterval() time.Duration {
    return time.Duration(c.PollIntervalMs) * time.Millisecond
}

func (c *SchedulerConfig) TimeoutCheckInterval() time.Duration {
    return time.Duration(c.TimeoutCheckMs) * time.Millisecond
}
