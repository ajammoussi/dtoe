package metrics

import (
	"time"

	"github.com/dtoe/go_shared/pkg/messaging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	TasksInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "dtoe_worker_tasks_in_flight",
			Help: "Number of tasks currently being processed by this worker",
		},
	)

	TasksExecutedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "dtoe_worker_tasks_executed_total",
			Help: "Total number of tasks executed",
		},
		[]string{"type", "status"},
	)

	TaskExecutionDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "dtoe_worker_task_execution_duration_seconds",
			Help:    "Task execution duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.01, 2, 12),
		},
		[]string{"type"},
	)

	HeartbeatSentTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_worker_heartbeat_sent_total",
			Help: "Total number of heartbeats sent",
		},
	)

	HeartbeatErrors = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_worker_heartbeat_errors_total",
			Help: "Total number of heartbeat errors",
		},
	)

	KafkaMessagesProcessed = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_worker_kafka_messages_processed_total",
			Help: "Total number of Kafka messages processed",
		},
	)

	KafkaConsumeErrors = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_worker_kafka_consume_errors_total",
			Help: "Total number of Kafka message consumption errors",
		},
	)

	KafkaProcessingErrors = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_worker_kafka_processing_errors_total",
			Help: "Total number of Kafka message processing errors",
		},
	)

	TaskLogEntries = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_worker_task_log_entries_total",
			Help: "Total number of task log entries written",
		},
	)
)

func RecordTaskResult(taskType string, status messaging.TaskStatus, duration time.Duration) {
	TasksExecutedTotal.WithLabelValues(taskType, string(status)).Inc()
	TaskExecutionDuration.WithLabelValues(taskType).Observe(duration.Seconds())
}

func RecordTaskStart() {
	TasksInFlight.Inc()
}

func RecordTaskEnd() {
	TasksInFlight.Dec()
}
