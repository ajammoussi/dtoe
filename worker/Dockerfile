FROM golang:1.22-alpine AS builder

WORKDIR /app

ENV GOPROXY=https://proxy.golang.org,direct

COPY worker/go.mod worker/go.sum ./
COPY go_shared /go_shared
COPY worker ./
RUN go mod download

RUN CGO_ENABLED=0 GOOS=linux go build -o worker ./cmd/worker

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates tzdata wget curl && \
    wget -q https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -O packages-microsoft-prod.deb && \
    dpkg -i packages-microsoft-prod.deb && \
    apt-get update && \
    apt-get install -y powershell && \
    rm -rf /var/lib/apt/lists/* packages-microsoft-prod.deb

WORKDIR /root/

COPY --from=builder /app/worker .

EXPOSE 8082

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8082/health || exit 1

CMD ["./worker"]
