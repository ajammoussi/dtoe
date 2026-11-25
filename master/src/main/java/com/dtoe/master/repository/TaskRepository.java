package com.dtoe.master.repository;

import com.dtoe.master.domain.Task;
import com.dtoe.shared.enums.TaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID>, JpaSpecificationExecutor<Task> {

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.dependencies WHERE t.id = :id")
    Optional<Task> findByIdWithDependencies(UUID id);

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.job WHERE t.id = :id")
    Optional<Task> findByIdWithJob(UUID id);

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.dependencies WHERE t.job.id = :jobId")
    List<Task> findByJobIdWithDependencies(@Param("jobId") UUID jobId);

    @EntityGraph(attributePaths = "job")
    Page<Task> findAll(Specification<Task> spec, Pageable pageable);

    interface JobTaskCounts {
        UUID getJobId();

        long getTotal();

        long getCompleted();

        long getFailed();
    }

    @Query("""
        SELECT t.job.id AS jobId, COUNT(t) AS total,
               SUM(CASE WHEN t.status = :success THEN 1 ELSE 0 END) AS completed,
               SUM(CASE WHEN t.status IN :failedStatuses THEN 1 ELSE 0 END) AS failed
          FROM Task t
         WHERE t.job.id IN :jobIds
         GROUP BY t.job.id
        """)
    List<JobTaskCounts> countTasksByJobIds(@Param("jobIds") Collection<UUID> jobIds,
                                           @Param("success") TaskStatus success,
                                           @Param("failedStatuses") Collection<TaskStatus> failedStatuses);
}
