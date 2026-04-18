package com.dtoe.master.repository;

import com.dtoe.master.domain.Task;
import com.dtoe.shared.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.dependencies WHERE t.id = :id")
    Optional<Task> findByIdWithDependencies(UUID id);

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.job WHERE t.id = :id")
    Optional<Task> findByIdWithJob(UUID id);

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.job LEFT JOIN FETCH t.dependents WHERE t.id = :id")
    Optional<Task> findByIdWithJobAndDependents(UUID id);

    List<Task> findByJobIdAndStatusIn(UUID jobId, List<TaskStatus> statuses);

    @Query("""
        SELECT t FROM Task t
        WHERE t.status = :status
        AND NOT EXISTS (
            SELECT 1 FROM Task dep
            JOIN t.dependencies td ON dep.id = td.id
            WHERE dep.status <> 'SUCCESS'
        )
        """)
    List<Task> findReadyTasks(TaskStatus status);

    @Query("""
        SELECT t FROM Task t
        WHERE t.status = 'RUNNING'
        AND t.startedAt < :timeoutThreshold
        """)
    List<Task> findTimedOutTasks(Instant timeoutThreshold);
}
