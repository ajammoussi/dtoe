package com.dtoe.master.controller;

import com.dtoe.master.domain.WorkerHeartbeat;
import com.dtoe.master.dto.response.WorkerListResponse;
import com.dtoe.master.dto.response.WorkerResponse;
import com.dtoe.master.repository.WorkerHeartbeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workers")
@RequiredArgsConstructor
public class WorkerController {

    private final WorkerHeartbeatRepository workerHeartbeatRepository;

    @Value("${dtoe.worker.dead-threshold-seconds:60}")
    private int deadThresholdSeconds;

    @GetMapping
    public ResponseEntity<WorkerListResponse> listWorkers() {
        List<WorkerHeartbeat> workers = workerHeartbeatRepository.findAll();
        
        List<WorkerResponse> workerResponses = workers.stream()
                .map(this::toResponse)
                .toList();

        int totalCapacity = workers.stream().mapToInt(WorkerHeartbeat::getCapacity).sum();
        int totalActiveTasks = workers.stream().mapToInt(WorkerHeartbeat::getActiveTasks).sum();
        double clusterUtilization = totalCapacity > 0 
                ? (double) totalActiveTasks / totalCapacity * 100 
                : 0;

        return ResponseEntity.ok(WorkerListResponse.builder()
                .workers(workerResponses)
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
