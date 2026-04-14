# ⚙️ DTOE — Distributed Task Orchestration Engine

> A lightweight, production-grade distributed job scheduler and worker pool — built from scratch with Java, Kafka, PostgreSQL, and React.

---

## What Is DTOE?

DTOE (pronounced *"dee-toe"*) is a mini Apache Airflow / Celery implementation that lets you define, schedule, and monitor **directed acyclic graphs (DAGs) of tasks** via a REST API. A central master node coordinates work through a Kafka message broker, and a fleet of stateless worker nodes execute tasks concurrently — reporting status back to a shared PostgreSQL database.

Think of it as proving you understand:
- **Distributed computing** — message brokers, network partitions, at-least-once delivery
- **State machines** — task lifecycle (PENDING → QUEUED → RUNNING → SUCCESS / FAILED / RETRYING)
- **Worker pools** — thread management, concurrency locks, backpressure
- **Fault tolerance** — retries, timeouts, dead-letter queues, idempotency

---

## Key Features

| Feature | Description |
|---|---|
| **DAG Scheduling** | Define jobs as JSON graphs of tasks with dependencies |
| **REST API** | Submit, cancel, and inspect jobs via HTTP |
| **Kafka-backed Queue** | Durable, partitioned task queue with replay support |
| **Distributed Workers** | Horizontally scalable worker pool with heartbeating |
| **Retry Engine** | Configurable exponential backoff on task failure |
| **Timeout Handling** | Per-task timeouts enforced by the master scheduler |
| **Monitoring Dashboard** | React/Next.js UI showing real-time worker health and job status |
| **Concurrency Locking** | PostgreSQL advisory locks prevent duplicate task execution |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client / CLI                         │
└───────────────────────┬─────────────────────────────────┘
                        │ REST (HTTP/JSON)
┌───────────────────────▼─────────────────────────────────┐
│               Master Node (Spring Boot)                 │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ Job Ingestion│  │  DAG Resolver │  │  Scheduler  │  │
│  │   (REST API) │  │  & Validator  │  │  (Cron/Poll)│  │
│  └──────────────┘  └───────────────┘  └──────┬──────┘  │
└──────────────────────────────────────────────┼──────────┘
                                               │ Publish Tasks
┌──────────────────────────────────────────────▼──────────┐
│                  Apache Kafka                           │
│         topic: task-queue   topic: task-results        │
└─────────────────────┬───────────────────┬───────────────┘
                      │ Consume           │ Publish Results
        ┌─────────────▼──────┐  ┌─────────▼──────────────┐
        │    Worker Node 1   │  │    Worker Node 2        │
        │  ThreadPool(N)     │  │  ThreadPool(N)          │
        └────────────────────┘  └────────────────────────┘
                      │                   │
┌─────────────────────▼───────────────────▼───────────────┐
│                  PostgreSQL                             │
│   jobs  │  tasks  │  task_logs  │  worker_heartbeats   │
└─────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│           Monitoring Dashboard (Next.js)                │
│      Worker Health · Job Status · Task Logs             │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Java 21+
- Docker & Docker Compose
- Node.js 20+ (for dashboard)

### 1. Start Infrastructure

```bash
docker-compose up -d
# Starts: PostgreSQL, Kafka, Zookeeper, Kafka UI
```

### 2. Run the Master Node

```bash
cd master
./mvnw spring-boot:run
# API available at http://localhost:8080
```

### 3. Run a Worker Node

```bash
cd worker
./mvnw spring-boot:run
# Worker registers and begins polling Kafka
```

### 4. Run the Dashboard

```bash
cd dashboard
npm install && npm run dev
# Dashboard at http://localhost:3000
```

### 5. Submit Your First Job

```bash
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d @examples/simple-pipeline.json
```

---

## Repository Structure

```
dtoe/
├── README.md
├── docs/
│   ├── architecture.md       # Deep-dive system design
│   ├── api-reference.md      # REST API docs
│   ├── dag-specification.md  # Job/DAG JSON format
│   ├── deployment.md         # Docker, K8s guides
│   └── adr/                  # Architecture Decision Records
├── docker-compose.yml
├── master/                   # Spring Boot master node
├── worker/                   # Spring Boot worker node
├── shared/                   # Shared DTOs and domain models
├── dashboard/                # Next.js monitoring UI
└── examples/                 # Sample DAG JSON files
```

---

## Documentation

| Doc | Description |
|---|---|
| [Architecture](docs/architecture.md) | System design, state machines, concurrency strategy |
| [API Reference](docs/api-reference.md) | All REST endpoints with request/response examples |
| [DAG Specification](docs/dag-specification.md) | How to define jobs and task graphs |
| [Deployment Guide](docs/deployment.md) | Docker Compose and Kubernetes deployment |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Master & Worker | Java 21, Spring Boot 3, Spring Kafka |
| Message Broker | Apache Kafka |
| Database | PostgreSQL 16 |
| ORM | Spring Data JPA / Hibernate |
| Monitoring UI | Next.js 14, React, Tailwind CSS, SWR |
| Infrastructure | Docker, Docker Compose |

---

## License

MIT — build on it, learn from it, ship it.
