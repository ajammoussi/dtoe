package com.dtoe.master.repository;

import com.dtoe.master.domain.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface JobRepository extends JpaRepository<Job, UUID>, JpaSpecificationExecutor<Job> {

    @Query("SELECT j FROM Job j LEFT JOIN FETCH j.tasks WHERE j.id = :id")
    Optional<Job> findByIdWithTasks(UUID id);
}
