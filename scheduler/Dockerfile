FROM golang:1.23-alpine AS builder

WORKDIR /app

ENV GOPROXY=https://proxy.golang.org,direct

COPY scheduler/go.mod scheduler/go.sum ./
COPY go_shared /go_shared
COPY scheduler ./
RUN go mod download

RUN CGO_ENABLED=0 GOOS=linux go build -o scheduler ./cmd/scheduler

FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

COPY --from=builder /app/scheduler .

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

CMD ["./scheduler"]
