package com.dtoe.master.controller;

import com.dtoe.master.domain.WorkerHeartbeat;
import com.dtoe.master.dto.response.WorkerListResponse;
import com.dtoe.master.dto.response.WorkerResponse;
import com.dtoe.master.repository.WorkerHeartbeatRepository;
import com.dtoe.shared.enums.WorkerStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/workers")
@RequiredArgsConstructor
public class WorkerController {

    private static final Map<WorkerStatus, Integer> STATUS_RANK = Map.of(
            WorkerStatus.HEALTHY, 0,
            WorkerStatus.BUSY, 1,
            WorkerStatus.STALE, 2,
            WorkerStatus.DEAD, 3);

    private final WorkerHeartbeatRepository workerHeartbeatRepository;

    @Value("${dtoe.worker.dead-threshold-seconds:60}")
    private int deadThresholdSeconds;

    @GetMapping
    public ResponseEntity<WorkerListResponse> listWorkers() {
        List<WorkerResponse> all = workerHeartbeatRepository.findAll().stream()
                .map(this::toResponse)
                .sorted(Comparator
                        .comparingInt((WorkerResponse w) -> STATUS_RANK.get(w.getStatus()))
                        .thenComparing(WorkerResponse::getLastSeenAt,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        List<WorkerResponse> active = all.stream()
                .filter(w -> w.getStatus() == WorkerStatus.HEALTHY || w.getStatus() == WorkerStatus.BUSY)
                .toList();

        int totalCapacity = active.stream().mapToInt(WorkerResponse::getCapacity).sum();
        int totalActiveTasks = active.stream().mapToInt(WorkerResponse::getActiveTasks).sum();
        double clusterUtilization = totalCapacity > 0
                ? (double) totalActiveTasks / totalCapacity * 100
                : 0;

        return ResponseEntity.ok(WorkerListResponse.builder()
                .workers(all)
                .activeCount(active.size())
                .inactiveCount(all.size() - active.size())
                .totalCapacity(totalCapacity)
                .totalActiveTasks(totalActiveTasks)
                .clusterUtilizationPct(clusterUtilization)
                .build());
    }

    @GetMapping("/{workerId}")
    public ResponseEntity<WorkerResponse> getWorker(@PathVariable String workerId) {
        return workerHeartbeatRepository.findById(workerId)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    private WorkerResponse toResponse(WorkerHeartbeat heartbeat) {
        return WorkerResponse.builder()
                .workerId(heartbeat.getWorkerId())
                .hostname(heartbeat.getHostname())
                .status(heartbeat.computeStatus(deadThresholdSeconds))
                .activeTasks(heartbeat.getActiveTasks())
                .capacity(heartbeat.getCapacity())
                .utilizationPct(heartbeat.utilizationPct())
                .lastSeenAt(heartbeat.getLastSeenAt())
                .startedAt(heartbeat.getStartedAt())
                .build();
    }
}
