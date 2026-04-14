package com.dtoe.shared.message;

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
public class TaskMessage {
    private UUID taskId;
    private UUID jobId;
    private String type;
    private Map<String, Object> payload;
    private int timeoutSeconds;
    private int retryCount;
    private int maxRetries;
    private Instant enqueuedAt;
}
