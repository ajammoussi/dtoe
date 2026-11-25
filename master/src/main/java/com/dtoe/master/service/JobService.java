package com.dtoe.master.service;

import com.dtoe.master.domain.Job;
import com.dtoe.master.domain.Task;
import com.dtoe.master.dto.request.JobSubmitRequest;
import com.dtoe.master.dto.request.TaskDefinitionRequest;
import com.dtoe.master.dto.response.JobDetailResponse;
import com.dtoe.master.dto.response.JobSubmitResponse;
import com.dtoe.master.dto.response.JobSummaryResponse;
import com.dtoe.master.repository.JobRepository;
import com.dtoe.master.repository.TaskRepository;
import com.dtoe.shared.enums.JobStatus;
import com.dtoe.shared.enums.TaskStatus;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobService {

    private static final List<TaskStatus> FAILED_STATUSES = List.of(TaskStatus.FAILED, TaskStatus.TIMED_OUT);

    private final JobRepository jobRepository;
    private final TaskRepository taskRepository;
    private final DagValidationService dagValidationService;

    @Transactional
    public JobSubmitResponse submitJob(JobSubmitRequest request) {
        dagValidationService.validate(request.getTasks());

        Job job = Job.builder()
                .name(request.getName())
                .submittedBy(request.getSubmittedBy())
                .status(JobStatus.RUNNING)
                .build();
        job = jobRepository.save(job);

        Map<String, Task> tasksByLogicalId = new HashMap<>();
        for (TaskDefinitionRequest taskDef : request.getTasks()) {
            Task task = Task.builder()
                    .job(job)
                    .name(taskDef.getName())
                    .type(taskDef.getType())
                    .payload(taskDef.getPayload())
                    .timeoutSeconds(taskDef.getTimeoutSeconds())
                    .maxRetries(taskDef.getMaxRetries())
                    .status(TaskStatus.PENDING)
                    .build();
            tasksByLogicalId.put(taskDef.getId(), taskRepository.save(task));
        }

        for (TaskDefinitionRequest taskDef : request.getTasks()) {
            Task task = tasksByLogicalId.get(taskDef.getId());
            List<String> rawDeps = taskDef.getDependencies() != null ? taskDef.getDependencies() : List.of();
            List<Task> deps = rawDeps.stream()
                    .map(tasksByLogicalId::get)
                    .filter(Objects::nonNull)
                    .collect(java.util.stream.Collectors.toList());
            task.setDependencies(deps);
            taskRepository.save(task);
        }

        log.info("Job {} submitted with {} tasks", job.getId(), request.getTasks().size());
        
        return JobSubmitResponse.builder()
                .jobId(job.getId())
                .name(job.getName())
                .status(job.getStatus())
                .taskCount(request.getTasks().size())
                .createdAt(job.getCreatedAt())
                .build();
    }

    @Transactional
    public Optional<Job> cancelJob(UUID jobId) {
        return jobRepository.findByIdWithTasks(jobId).map(job -> {
            if (job.isTerminal()) {
                throw new IllegalStateException("Job " + jobId + " is already in terminal state: " + job.getStatus());
            }
            Instant now = Instant.now();
            job.getTasks().stream()
                    .filter(t -> t.getStatus() == TaskStatus.PENDING
                            || t.getStatus() == TaskStatus.QUEUED
                            || t.getStatus() == TaskStatus.RETRYING)
                    .forEach(t -> {
                        t.setStatus(TaskStatus.CANCELLED);
                        t.setScheduledFor(null);
                        if (t.getCompletedAt() == null) {
                            t.setCompletedAt(now);
                        }
                    });
            job.setStatus(JobStatus.CANCELLED);
            job.setCompletedAt(now);
            return jobRepository.save(job);
        });
    }

    @Transactional(readOnly = true)
    public Page<JobSummaryResponse> listJobs(JobStatus status, String search, Pageable pageable) {
        Specification<Job> spec = (root, query, cb) -> {
            List<Predicate> filters = new ArrayList<>();
            if (status != null) {
                filters.add(cb.equal(root.get("status"), status));
            }
            if (search != null && !search.isBlank()) {
                filters.add(cb.greaterThan(
                        cb.locate(cb.lower(root.get("name")), search.trim().toLowerCase()), 0));
            }
            return cb.and(filters.toArray(new Predicate[0]));
        };
        Page<Job> jobs = jobRepository.findAll(spec, pageable);

        List<UUID> jobIds = jobs.getContent().stream().map(Job::getId).toList();
        Map<UUID, TaskRepository.JobTaskCounts> counts = jobIds.isEmpty()
                ? Map.of()
                : taskRepository.countTasksByJobIds(jobIds, TaskStatus.SUCCESS, FAILED_STATUSES).stream()
                        .collect(Collectors.toMap(TaskRepository.JobTaskCounts::getJobId, c -> c));

        return jobs.map(job -> toSummaryResponse(job, counts.get(job.getId())));
    }

    @Transactional(readOnly = true)
    public Optional<JobDetailResponse> getJobDetail(UUID jobId) {
        return jobRepository.findByIdWithTasks(jobId).map(this::toDetailResponse);
    }

    private JobSummaryResponse toSummaryResponse(Job job, TaskRepository.JobTaskCounts counts) {
        return JobSummaryResponse.builder()
                .jobId(job.getId())
                .name(job.getName())
                .status(job.getStatus())
                .taskCount(counts == null ? 0 : (int) counts.getTotal())
                .completedTasks(counts == null ? 0 : (int) counts.getCompleted())
                .failedTasks(counts == null ? 0 : (int) counts.getFailed())
                .createdAt(job.getCreatedAt())
                .completedAt(job.getCompletedAt())
                .build();
    }

    private JobDetailResponse toDetailResponse(Job job) {
        return JobDetailResponse.builder()
                .jobId(job.getId())
                .name(job.getName())
                .status(job.getStatus())
                .submittedBy(job.getSubmittedBy())
                .createdAt(job.getCreatedAt())
                .completedAt(job.getCompletedAt())
                .tasks(job.getTasks().stream().map(this::toTaskSummary).toList())
                .build();
    }

    private JobDetailResponse.TaskSummary toTaskSummary(Task task) {
        return JobDetailResponse.TaskSummary.builder()
            .taskId(task.getId())
            .name(task.getName())
            .type(task.getType())
            .status(task.getStatus())
            .workerId(task.getWorkerId())
            .retryCount(task.getRetryCount())
            .maxRetries(task.getMaxRetries())
            .timeoutSeconds(task.getTimeoutSeconds())
            .startedAt(task.getStartedAt())
            .completedAt(task.getCompletedAt())
            .errorMessage(task.getErrorMessage())
            .payload(task.getPayload())
            .dependencies(task.getDependencies().stream().map(Task::getId).toList())
            .build();
    }

    @Transactional
    public void checkAndUpdateJobCompletion(UUID jobId) {
        jobRepository.findByIdWithTasks(jobId).ifPresent(job -> {
            if (job.isTerminal()) {
                return;
            }

            List<Task> tasks = job.getTasks();
            boolean allTerminal = tasks.stream().allMatch(Task::isTerminal);

            if (!allTerminal) {
                return;
            }

            boolean allSuccess = tasks.stream().allMatch(t -> t.getStatus() == TaskStatus.SUCCESS);
            boolean anySuccess = tasks.stream().anyMatch(t -> t.getStatus() == TaskStatus.SUCCESS);

            JobStatus finalStatus = allSuccess ? JobStatus.SUCCESS
                    : (anySuccess ? JobStatus.PARTIALLY_FAILED : JobStatus.FAILED);

            job.setStatus(finalStatus);
            job.setCompletedAt(Instant.now());
            jobRepository.save(job);

            log.info("Job {} completed with status: {}", job.getId(), finalStatus);
        });
    }
}
