package com.dtoe.master.dto.response;

import com.dtoe.shared.enums.TaskStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskDetailResponse {

    private UUID taskId;
    private UUID jobId;
    private String name;
    private String type;
    private TaskStatus status;
    private int retryCount;
    private int maxRetries;
    private int timeoutSeconds;
    private String workerId;
    private String errorMessage;
    private Instant createdAt;
    private Instant startedAt;
    private Instant completedAt;
    private Map<String, Object> output;
}
