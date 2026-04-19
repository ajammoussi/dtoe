package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	JobsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "dtoe_jobs_total",
			Help: "Total number of jobs created",
		},
		[]string{"status"},
	)

	TasksTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "dtoe_tasks_total",
			Help: "Total number of tasks processed",
		},
		[]string{"status", "type"},
	)

	TasksInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "dtoe_tasks_in_flight",
			Help: "Number of tasks currently being processed",
		},
	)

	TaskDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "dtoe_task_duration_seconds",
			Help:    "Task execution duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 10),
		},
		[]string{"type", "status"},
	)

	TaskRetriesTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_task_retries_total",
			Help: "Total number of task retries",
		},
	)

	TaskTimeoutsTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_task_timeouts_total",
			Help: "Total number of task timeouts",
		},
	)

	WorkersActive = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "dtoe_workers_active",
			Help: "Number of active workers",
		},
	)

	WorkersHeartbeatLastTimestamp = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "dtoe_workers_heartbeat_last_timestamp",
			Help: "Timestamp of last worker heartbeat",
		},
	)

	KafkaMessagesProduced = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_kafka_messages_produced_total",
			Help: "Total number of Kafka messages produced",
		},
	)

	KafkaMessagesConsumed = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_kafka_messages_consumed_total",
			Help: "Total number of Kafka messages consumed",
		},
	)

	KafkaProduceErrors = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_kafka_produce_errors_total",
			Help: "Total number of Kafka produce errors",
		},
	)

	KafkaConsumeErrors = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_kafka_consume_errors_total",
			Help: "Total number of Kafka consume errors",
		},
	)

	SchedulerPollDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "dtoe_scheduler_poll_duration_seconds",
			Help:    "Scheduler poll loop duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 12),
		},
	)

	SchedulerTasksPromoted = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_scheduler_tasks_promoted_total",
			Help: "Total number of tasks promoted to queue",
		},
	)

	DatabaseQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "dtoe_database_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 12),
		},
		[]string{"operation"},
	)
)