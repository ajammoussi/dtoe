package com.dtoe.master.repository;

import com.dtoe.master.domain.WorkerHeartbeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface WorkerHeartbeatRepository extends JpaRepository<WorkerHeartbeat, String> {

    @Query("SELECT w FROM WorkerHeartbeat w WHERE w.lastSeenAt > :since")
    List<WorkerHeartbeat> findActiveWorkers(Instant since);
}
