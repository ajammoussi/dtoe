package com.dtoe.master.service;

import com.dtoe.master.domain.Job;
import com.dtoe.master.domain.Task;
import com.dtoe.master.dto.request.JobSubmitRequest;
import com.dtoe.master.dto.request.TaskDefinitionRequest;
import com.dtoe.master.dto.response.JobDetailResponse;
import com.dtoe.master.dto.response.JobSubmitResponse;
import com.dtoe.master.dto.response.JobSummaryResponse;
import com.dtoe.master.kafka.TaskQueueProducer;
import com.dtoe.master.repository.JobRepository;
import com.dtoe.master.repository.TaskRepository;
import com.dtoe.shared.enums.JobStatus;
import com.dtoe.shared.enums.TaskStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final TaskRepository taskRepository;
    private final DagValidationService dagValidationService;
    private final TaskQueueProducer taskQueueProducer;

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
            List<Task> deps = taskDef.getDependencies().stream()
                    .map(tasksByLogicalId::get)
                    .toList();
            task.setDependencies(deps);
            taskRepository.save(task);
        }

        for (TaskDefinitionRequest taskDef : request.getTasks()) {
            if (taskDef.getDependencies().isEmpty()) {
                Task rootTask = tasksByLogicalId.get(taskDef.getId());
                enqueueTask(rootTask);
            }
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
    public void enqueueTask(Task task) {
        task.setStatus(TaskStatus.QUEUED);
        task.setQueuedAt(Instant.now());
        taskRepository.save(task);
        taskQueueProducer.publish(task);
        log.debug("Task {} enqueued", task.getId());
    }

    @Transactional
    public Optional<Job> cancelJob(UUID jobId) {
        return jobRepository.findByIdWithTasks(jobId).map(job -> {
            if (job.isTerminal()) {
                throw new IllegalStateException("Job " + jobId + " is already in terminal state: " + job.getStatus());
            }
            job.getTasks().stream()
                    .filter(t -> t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.QUEUED)
                    .forEach(t -> t.setStatus(TaskStatus.CANCELLED));
            job.setStatus(JobStatus.CANCELLED);
            job.setCompletedAt(Instant.now());
            return jobRepository.save(job);
        });
    }

    @Transactional(readOnly = true)
    public Page<JobSummaryResponse> listJobs(JobStatus status, Pageable pageable) {
        Page<Job> jobs = status != null
                ? jobRepository.findByStatus(status, pageable)
                : jobRepository.findAll(pageable);
        return jobs.map(this::toSummaryResponse);
    }

    @Transactional(readOnly = true)
    public Optional<JobDetailResponse> getJobDetail(UUID jobId) {
        return jobRepository.findByIdWithTasks(jobId).map(this::toDetailResponse);
    }

    private JobSummaryResponse toSummaryResponse(Job job) {
        long completedTasks = job.getTasks().stream()
                .filter(t -> t.getStatus() == TaskStatus.SUCCESS).count();
        return JobSummaryResponse.builder()
                .jobId(job.getId())
                .name(job.getName())
                .status(job.getStatus())
                .taskCount(job.getTasks().size())
                .completedTasks((int) completedTasks)
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
            .startedAt(task.getStartedAt())
            .completedAt(task.getCompletedAt())
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
            boolean anyFailed = tasks.stream().anyMatch(t -> 
                t.getStatus() == TaskStatus.FAILED || 
                t.getStatus() == TaskStatus.TIMED_OUT ||
                t.getStatus() == TaskStatus.CANCELLED
            );

            JobStatus finalStatus;
            if (allSuccess) {
                finalStatus = JobStatus.SUCCESS;
            } else if (anyFailed) {
                finalStatus = JobStatus.FAILED;
            } else {
                finalStatus = JobStatus.CANCELLED;
            }

            job.setStatus(finalStatus);
            job.setCompletedAt(Instant.now());
            jobRepository.save(job);

            log.info("Job {} completed with status: {}", job.getId(), finalStatus);
        });
    }
}
