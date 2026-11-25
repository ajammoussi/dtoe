package com.dtoe.master.dto.response;

import com.dtoe.shared.enums.TaskStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskSummaryResponse {

    private UUID taskId;
    private UUID jobId;
    private String jobName;
    private String name;
    private String type;
    private TaskStatus status;
    private int retryCount;
    private int maxRetries;
    private String workerId;
    private String errorMessage;
    private Instant createdAt;
    private Instant startedAt;
    private Instant completedAt;
}
