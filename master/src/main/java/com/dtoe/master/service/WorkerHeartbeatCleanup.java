package com.dtoe.master.service;

import com.dtoe.master.repository.WorkerHeartbeatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class WorkerHeartbeatCleanup {

    private final WorkerHeartbeatRepository workerHeartbeatRepository;

    @Value("${dtoe.worker.retention-hours:24}")
    private long retentionHours;

    @Scheduled(initialDelay = 60_000, fixedDelay = 600_000)
    @Transactional
    public void purge() {
        if (retentionHours <= 0) {
            return;
        }
        int deleted = workerHeartbeatRepository.deleteStale(
                Instant.now().minus(retentionHours, ChronoUnit.HOURS));
        if (deleted > 0) {
            log.info("Purged {} worker heartbeats older than {}h", deleted, retentionHours);
        }
    }
}
