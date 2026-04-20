package com.dtoe.master.repository;

import com.dtoe.master.domain.WorkerHeartbeat;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkerHeartbeatRepository extends JpaRepository<WorkerHeartbeat, String> {
}
