package com.dtoe.shared.message;

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
public class TaskResultMessage {
    private UUID taskId;
    private UUID jobId;
    private String workerId;
    private TaskStatus status;
    private Map<String, Object> output;
    private String errorMessage;
    private Instant startedAt;
    private Instant completedAt;
}
