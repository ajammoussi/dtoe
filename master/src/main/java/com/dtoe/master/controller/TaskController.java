package com.dtoe.master.controller;

import com.dtoe.master.domain.Task;
import com.dtoe.master.dto.response.TaskDetailResponse;
import com.dtoe.master.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskRepository taskRepository;

    @GetMapping("/{taskId}")
    public ResponseEntity<TaskDetailResponse> getTask(@PathVariable UUID taskId) {
        return taskRepository.findById(taskId)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
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
