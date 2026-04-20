package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
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

	KafkaMessagesProduced = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_kafka_messages_produced_total",
			Help: "Total number of Kafka messages produced",
		},
	)

	KafkaProduceErrors = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dtoe_kafka_produce_errors_total",
			Help: "Total number of Kafka produce errors",
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
)
