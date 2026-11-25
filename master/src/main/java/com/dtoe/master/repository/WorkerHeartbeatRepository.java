package com.dtoe.master.repository;

import com.dtoe.master.domain.WorkerHeartbeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface WorkerHeartbeatRepository extends JpaRepository<WorkerHeartbeat, String> {

    @Modifying
    @Query("DELETE FROM WorkerHeartbeat w WHERE w.lastSeenAt IS NULL OR w.lastSeenAt < :cutoff")
    int deleteStale(@Param("cutoff") Instant cutoff);
}
