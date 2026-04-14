package com.dtoe.master.domain;

import com.dtoe.shared.enums.WorkerStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "worker_heartbeats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkerHeartbeat {

    @Id
    private String workerId;

    @Column(nullable = false)
    private String hostname;

    @Builder.Default
    private int activeTasks = 0;

    private int capacity;

    private Instant lastSeenAt;
    private Instant startedAt;

    public WorkerStatus computeStatus(int deadThresholdSeconds) {
        if (lastSeenAt == null) return WorkerStatus.DEAD;
        long secondsSinceHeartbeat = Instant.now().getEpochSecond() - lastSeenAt.getEpochSecond();
        if (secondsSinceHeartbeat > deadThresholdSeconds) return WorkerStatus.DEAD;
        if (secondsSinceHeartbeat > deadThresholdSeconds / 4) return WorkerStatus.STALE;
        if (activeTasks >= capacity) return WorkerStatus.BUSY;
        return WorkerStatus.HEALTHY;
    }

    public double utilizationPct() {
        if (capacity == 0) return 0;
        return (double) activeTasks / capacity * 100;
    }
}
