package com.dtoe.master.repository;

import com.dtoe.master.domain.TaskLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaskLogRepository extends JpaRepository<TaskLog, Long> {
    List<TaskLog> findByTaskIdOrderByLoggedAtAsc(UUID taskId);
}

