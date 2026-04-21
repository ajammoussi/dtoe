# Deployment Guide

## Local Development (Docker Compose)

The fastest way to run the full stack locally.

### Prerequisites

- Docker 24+ and Docker Compose v2
- Go 1.22+ (for scheduler and worker)
- Java 21+ (for master node)
- Node.js 20+ (for the dashboard)

### Start Infrastructure

```bash
# Start PostgreSQL, Kafka, Zookeeper, and Kafka UI
docker-compose up -d

# Verify all containers are healthy
docker-compose ps
```

Services started:

| Service | Port | URL |
|---|---|---|
| PostgreSQL | 5432 | `jdbc:postgresql://localhost:5432/dtoe` |
| Kafka | 9092 | `localhost:9092` |
| Zookeeper | 2181 | `localhost:2181` |
| Kafka UI | 8090 | http://localhost:8090 |

### Run the Master Node (Java/Spring Boot)

```bash
cd master
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

The API will be available at `http://localhost:8080`.

### Run the Scheduler Service (Go)

```bash
cd scheduler
go run ./cmd/scheduler
```

The scheduler will:
- Poll the database for ready tasks every 5 seconds
- Publish tasks to Kafka `task-queue` topic
- Monitor for task timeouts every 10 seconds

Health endpoint: `http://localhost:8081/health`

### Run Worker Nodes (Go)

```bash
# Terminal 1
cd worker
go run ./cmd/worker

# Terminal 2 — scale horizontally
cd worker
DTOE_WORKER_ID=worker-2 go run ./cmd/worker
```

Each worker:
- Consumes from Kafka `task-queue` topic
- Executes tasks and publishes results to `task-results`
- Sends heartbeats to the database every 5 seconds

Health endpoint: `http://localhost:8082/health`

### Run the Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Dashboard available at `http://localhost:3000`.

---

## Environment Variables

### Master Node (Java/Spring Boot)

| Variable | Default | Description |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/dtoe` | PostgreSQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | `dtoe` | DB username |
| `SPRING_DATASOURCE_PASSWORD` | `dtoe` | DB password |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka bootstrap servers |
| `DTOE_WORKER_DEAD_THRESHOLD_SECONDS` | `60` | Seconds before a worker is marked DEAD |

### Scheduler Service (Go)

| Variable | Default | Description |
|---|---|---|
| `DTOE_DATABASE_HOST` | `localhost` | PostgreSQL host |
| `DTOE_DATABASE_PORT` | `5432` | PostgreSQL port |
| `DTOE_DATABASE_USER` | `dtoe` | DB username |
| `DTOE_DATABASE_PASSWORD` | `dtoe` | DB password |
| `DTOE_DATABASE_DATABASE` | `dtoe` | Database name |
| `DTOE_KAFKA_BROKERS` | `localhost:9092` | Kafka bootstrap servers |
| `DTOE_SCHEDULER_POLL_INTERVAL_MS` | `5000` | How often the scheduler polls for ready tasks |
| `DTOE_SCHEDULER_TIMEOUT_CHECK_MS` | `10000` | How often timeout enforcement runs |

### Worker Node (Go)

| Variable | Default | Description |
|---|---|---|
| `DTOE_DATABASE_HOST` | `localhost` | PostgreSQL host |
| `DTOE_DATABASE_PORT` | `5432` | PostgreSQL port |
| `DTOE_DATABASE_USER` | `dtoe` | DB username |
| `DTOE_DATABASE_PASSWORD` | `dtoe` | DB password |
| `DTOE_DATABASE_DATABASE` | `dtoe` | Database name |
| `DTOE_KAFKA_BROKERS` | `localhost:9092` | Kafka bootstrap servers |
| `DTOE_KAFKA_TASK_QUEUE_TOPIC` | `task-queue` | Task queue topic |
| `DTOE_KAFKA_TASK_RESULT_TOPIC` | `task-results` | Task result topic |
| `DTOE_KAFKA_CONSUMER_GROUP` | `worker-group` | Consumer group ID |
| `DTOE_WORKER_ID` | (auto-generated) | Worker identifier |
| `DTOE_WORKER_THREAD_POOL_SIZE` | `8` | Max concurrent tasks per worker |
| `DTOE_WORKER_HEARTBEAT_INTERVAL_MS` | `5000` | Heartbeat frequency |

### Dashboard

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Master node API base URL |
| `NEXT_PUBLIC_REFRESH_INTERVAL` | `5000` | Dashboard polling interval in ms |

---

## Docker Compose File

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dtoe
      POSTGRES_USER: dtoe
      POSTGRES_PASSWORD: dtoe
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dtoe"]
      interval: 5s
      timeout: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
      KAFKA_NUM_PARTITIONS: 12
      KAFKA_DEFAULT_REPLICATION_FACTOR: 1
    healthcheck:
      test: ["CMD", "kafka-topics", "--bootstrap-server", "localhost:9092", "--list"]
      interval: 10s
      timeout: 10s
      retries: 5

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    depends_on:
      - kafka
    ports:
      - "8090:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092

  volumes:
    postgres_data:
```

---

## Production Deployment (Kubernetes)

### Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or local k3s)
- `kubectl` configured
- Helm 3+
- External PostgreSQL (RDS, Cloud SQL, etc.)
- External Kafka (MSK, Confluent Cloud, etc.)

### Apply Manifests

```bash
# Create namespace
kubectl create namespace dtoe

# Create secrets
kubectl create secret generic dtoe-secrets \
  --from-literal=db-password='<your-password>' \
  --from-literal=db-url='jdbc:postgresql://<host>:5432/dtoe' \
  -n dtoe

# Apply all manifests
kubectl apply -f k8s/ -n dtoe
```

### Master Node Deployment (Java)

```yaml
# k8s/master-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dtoe-master
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dtoe-master
  template:
    metadata:
      labels:
        app: dtoe-master
    spec:
      containers:
      - name: master
        image: your-registry/dtoe-master:latest
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_DATASOURCE_URL
          valueFrom:
            secretKeyRef:
              name: dtoe-secrets
              key: db-url
        - name: SPRING_DATASOURCE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: dtoe-secrets
              key: db-password
        - name: SPRING_KAFKA_BOOTSTRAP_SERVERS
          value: "kafka-broker:9092"
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
        resources:
          requests:
            cpu: "250m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
```

### Scheduler Deployment (Go)

```yaml
# k8s/scheduler-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dtoe-scheduler
spec:
  replicas: 2  # HA: only one actively schedules (advisory lock)
  selector:
    matchLabels:
      app: dtoe-scheduler
  template:
    metadata:
      labels:
        app: dtoe-scheduler
    spec:
      containers:
      - name: scheduler
        image: your-registry/dtoe-scheduler:latest
        env:
        - name: DTOE_DATABASE_HOST
          value: "postgres-host"
        - name: DTOE_DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: dtoe-secrets
              key: db-password
        - name: DTOE_KAFKA_BROKERS
          value: "kafka-broker:9092"
        readinessProbe:
          httpGet:
            path: /health
            port: 8081
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8081
          initialDelaySeconds: 10
          periodSeconds: 30
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
```

### Worker Deployment (Go)

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dtoe-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dtoe-worker
  template:
    metadata:
      labels:
        app: dtoe-worker
    spec:
      containers:
      - name: worker
        image: your-registry/dtoe-worker:latest
        env:
        - name: DTOE_DATABASE_HOST
          value: "postgres-host"
        - name: DTOE_DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: dtoe-secrets
              key: db-password
        - name: DTOE_KAFKA_BROKERS
          value: "kafka-broker:9092"
        - name: DTOE_WORKER_THREAD_POOL_SIZE
          value: "8"
        readinessProbe:
          httpGet:
            path: /health
            port: 8082
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8082
          initialDelaySeconds: 10
          periodSeconds: 30
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
```

### Horizontal Pod Autoscaling (Workers)

```yaml
# k8s/worker-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dtoe-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dtoe-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## Building Docker Images

### Master Node (Java)

```bash
cd master
./mvnw package -DskipTests
docker build -t your-registry/dtoe-master:latest .
```

### Scheduler (Go)

```bash
cd scheduler
docker build -t your-registry/dtoe-scheduler:latest .
```

Dockerfile for scheduler:
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o scheduler ./cmd/scheduler

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/scheduler .
EXPOSE 8081
CMD ["./scheduler"]
```

### Worker (Go)

```bash
cd worker
docker build -t your-registry/dtoe-worker:latest .
```

Dockerfile for worker:
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o worker ./cmd/worker

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/worker .
EXPOSE 8082
CMD ["./worker"]
```

### Dashboard

```bash
cd dashboard
docker build -t your-registry/dtoe-dashboard:latest .
```

### Push all images

```bash
docker push your-registry/dtoe-master:latest
docker push your-registry/dtoe-scheduler:latest
docker push your-registry/dtoe-worker:latest
docker push your-registry/dtoe-dashboard:latest
```
