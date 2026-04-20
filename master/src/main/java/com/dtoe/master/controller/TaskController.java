package com.dtoe.master.controller;

import com.dtoe.master.domain.Task;
import com.dtoe.master.dto.response.TaskDetailResponse;
import com.dtoe.master.repository.TaskRepository;
import com.dtoe.shared.enums.TaskStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskRepository taskRepository;
    private final com.dtoe.master.repository.TaskLogRepository taskLogRepository;

    @GetMapping
    public ResponseEntity<Page<TaskDetailResponse>> listTasks(
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Task> tasks = status == null ? taskRepository.findAll(pageable)
                                          : taskRepository.findByStatus(status, pageable);
        return ResponseEntity.ok(tasks.map(this::toResponse));
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<TaskDetailResponse> getTask(@PathVariable UUID taskId) {
        return taskRepository.findById(taskId)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{taskId}/logs")
    public ResponseEntity<java.util.Map<String, Object>> getTaskLogs(@PathVariable UUID taskId) {
        java.util.List<com.dtoe.master.domain.TaskLog> logs = taskLogRepository.findByTaskIdOrderByLoggedAtAsc(taskId);
        return ResponseEntity.ok(java.util.Map.of("logs", logs));
    }

    private TaskDetailResponse toResponse(Task task) {
        return TaskDetailResponse.builder()
                .taskId(task.getId())
                .jobId(task.getJob().getId())
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
                .output(task.getOutput())
                .build();
    }
}
