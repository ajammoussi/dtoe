# Deployment Guide

## Local Development (Docker Compose)

The fastest way to run the full stack locally.

### Prerequisites

- Docker 24+ and Docker Compose v2
- Go 1.23+ (workspace uses `go 1.23.0` for the scheduler and worker)
- Java 21+ and Maven 3.9+ (master node)
- Node.js 20+ (dashboard)

### Start Infrastructure

```bash
# Infrastructure only — the services are run manually below
docker compose up -d postgres zookeeper kafka kafka-ui

# Verify all containers are healthy
docker compose ps
```

Services started:

| Service | Port | URL |
|---|---|---|
| PostgreSQL | 5432 | `jdbc:postgresql://localhost:5432/dtoe` |
| Kafka | 9092 | `localhost:9092` |
| Zookeeper | 2181 | `localhost:2181` |
| Kafka UI | 8090 | http://localhost:8090 |

### Run the Master Node (Java/Spring Boot)

There is no Maven wrapper in this repository; use a local Maven 3.9+.

```bash
mvn -pl master -am -DskipTests package
java -jar master/target/dtoe-master-1.0.0-SNAPSHOT.jar --spring.profiles.active=local
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
| `DTOE_WORKER_DEAD_THRESHOLD_SECONDS` | `60` | Seconds before a worker is marked DEAD (STALE at a quarter of it) |
| `DTOE_WORKER_RETENTION_HOURS` | `24` | Delete worker heartbeat rows older than this; `0` keeps history forever |
| `DTOE_KAFKA_TOPICS_TASK_RESULTS` | `task-results` | Topic the master consumes results from |
| `SERVER_PORT` | `8080` | HTTP port |

### Scheduler Service (Go)

| Variable | Default | Description |
|---|---|---|
| `DTOE_DATABASE_HOST` | `localhost` | PostgreSQL host |
| `DTOE_DATABASE_PORT` | `5432` | PostgreSQL port |
| `DTOE_DATABASE_USER` | `dtoe` | DB username |
| `DTOE_DATABASE_PASSWORD` | `dtoe` | DB password |
| `DTOE_DATABASE_DATABASE` | `dtoe` | Database name |
| `DTOE_KAFKA_BROKERS` | `localhost:9092` | Kafka bootstrap servers |
| `DTOE_KAFKA_TASK_QUEUE_TOPIC` | `task-queue` | Topic the scheduler publishes to |
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

The console has no runtime configuration: the browser calls the relative path `/api/v1/...`. In development Vite proxies that to `http://localhost:8080` (`vite.config.ts`), and in Docker nginx proxies it to `http://master:8080` (`nginx.conf`).

Point it at a different master by editing the proxy target in one of those two files.

---

## Docker Compose File

[`docker-compose.yml`](../docker-compose.yml) is the source of truth — keep this guide descriptive rather than copying it, so the two cannot drift.

| Service | Image / build | Ports |
|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 |
| `zookeeper`, `kafka` | Confluent 7.6.1 | 2181, 9092 (host), 9093 (in-cluster) |
| `kafka-ui` | `provectuslabs/kafka-ui` | 8090 |
| `master` | `master/Dockerfile`, repo-root context | 8080 |
| `scheduler` | `scheduler/Dockerfile`, repo-root context | 8081 |
| `worker` | `worker/Dockerfile`, repo-root context | 8082 |
| `dashboard` | `dashboard/Dockerfile` | 3000 |
| `prometheus`, `grafana` | upstream images | 9090, 3001 |

Kafka advertises `kafka:9093` to the other containers and `localhost:9092` to the host. `master` waits for the Postgres and Kafka healthchecks before starting.

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
  replicas: 2  # HA: promotion is atomic, both replicas can run
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

All Dockerfiles expect the **repository root** as build context: `master/Dockerfile` copies `shared/` and `master/`, the Go ones copy `go_shared/` plus their module, and the console is built from `./dashboard`.

```bash
docker build -f master/Dockerfile    -t your-registry/dtoe-master:latest .
docker build -f scheduler/Dockerfile -t your-registry/dtoe-scheduler:latest .
docker build -f worker/Dockerfile    -t your-registry/dtoe-worker:latest .
docker build -t your-registry/dtoe-dashboard:latest dashboard/
```

Or let Compose do the same work:

```bash
docker compose build
```

### Push all images

```bash
docker push your-registry/dtoe-master:latest
docker push your-registry/dtoe-scheduler:latest
docker push your-registry/dtoe-worker:latest
docker push your-registry/dtoe-dashboard:latest
```
