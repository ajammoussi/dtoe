package com.dtoe.master.repository;

import com.dtoe.master.domain.Job;
import com.dtoe.shared.enums.JobStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface JobRepository extends JpaRepository<Job, UUID> {

    Page<Job> findByStatus(JobStatus status, Pageable pageable);

    @Query("SELECT j FROM Job j LEFT JOIN FETCH j.tasks WHERE j.id = :id")
    Optional<Job> findByIdWithTasks(UUID id);

    @Query("SELECT j FROM Job j LEFT JOIN FETCH j.tasks t WHERE t.id = :taskId")
    Optional<Job> findByTaskIdWithTasks(UUID taskId);
}
