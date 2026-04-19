module github.com/dtoe/worker

go 1.22

require (
	github.com/dtoe/go_shared v0.0.0
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.5.5
	github.com/prometheus/client_golang v1.20.5
	github.com/segmentio/kafka-go v0.4.47
	github.com/spf13/viper v1.18.2
	go.uber.org/zap v1.27.0
)

replace github.com/dtoe/go_shared => ../go_shared
