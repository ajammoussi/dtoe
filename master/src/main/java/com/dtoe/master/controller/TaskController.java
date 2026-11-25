package com.dtoe.master.controller;

import com.dtoe.master.domain.Task;
import com.dtoe.master.dto.response.TaskDetailResponse;
import com.dtoe.master.dto.response.TaskSummaryResponse;
import com.dtoe.master.repository.TaskRepository;
import com.dtoe.shared.enums.TaskStatus;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskRepository taskRepository;
    private final com.dtoe.master.repository.TaskLogRepository taskLogRepository;

    @GetMapping
    public ResponseEntity<Page<TaskSummaryResponse>> listTasks(
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Specification<Task> spec = (root, query, cb) -> {
            List<Predicate> filters = new ArrayList<>();
            if (status != null) {
                filters.add(cb.equal(root.get("status"), status));
            }
            if (q != null && !q.isBlank()) {
                String needle = q.trim().toLowerCase();
                filters.add(cb.or(
                        cb.greaterThan(cb.locate(cb.lower(root.get("name")), needle), 0),
                        cb.greaterThan(cb.locate(cb.lower(root.get("type")), needle), 0),
                        cb.greaterThan(cb.locate(cb.lower(root.get("job").get("name")), needle), 0)));
            }
            return cb.and(filters.toArray(new Predicate[0]));
        };
        Page<Task> tasks = taskRepository.findAll(spec, pageable);
        return ResponseEntity.ok(tasks.map(this::toSummary));
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<TaskDetailResponse> getTask(@PathVariable UUID taskId) {
        return taskRepository.findByIdWithJob(taskId)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{taskId}/logs")
    public ResponseEntity<java.util.Map<String, Object>> getTaskLogs(@PathVariable UUID taskId) {
        java.util.List<com.dtoe.master.domain.TaskLog> logs = taskLogRepository.findByTaskIdOrderByLoggedAtAsc(taskId);
        return ResponseEntity.ok(java.util.Map.of("logs", logs));
    }

    private TaskSummaryResponse toSummary(Task task) {
        return TaskSummaryResponse.builder()
                .taskId(task.getId())
                .jobId(task.getJob().getId())
                .jobName(task.getJob().getName())
                .name(task.getName())
                .type(task.getType())
                .status(task.getStatus())
                .retryCount(task.getRetryCount())
                .maxRetries(task.getMaxRetries())
                .workerId(task.getWorkerId())
                .errorMessage(task.getErrorMessage())
                .createdAt(task.getCreatedAt())
                .startedAt(task.getStartedAt())
                .completedAt(task.getCompletedAt())
                .build();
    }

    private TaskDetailResponse toResponse(Task task) {
        return TaskDetailResponse.builder()
                .taskId(task.getId())
                .jobId(task.getJob().getId())
                .jobName(task.getJob().getName())
                .name(task.getName())
                .type(task.getType())
                .status(task.getStatus())
                .retryCount(task.getRetryCount())
                .maxRetries(task.getMaxRetries())
                .timeoutSeconds(task.getTimeoutSeconds())
                .workerId(task.getWorkerId())
                .errorMessage(task.getErrorMessage())
                .createdAt(task.getCreatedAt())
                .startedAt(task.getStartedAt())
                .completedAt(task.getCompletedAt())
                .payload(task.getPayload())
                .output(task.getOutput())
                .build();
    }
}
