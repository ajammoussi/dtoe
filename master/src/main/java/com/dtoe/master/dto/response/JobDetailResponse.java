package com.dtoe.master.dto.response;

import com.dtoe.shared.enums.JobStatus;
import com.dtoe.shared.enums.TaskStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobDetailResponse {

    private UUID jobId;
    private String name;
    private JobStatus status;
    private String submittedBy;
    private Instant createdAt;
    private List<TaskSummary> tasks;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TaskSummary {
        private UUID taskId;
        private String name;
        private String type;
        private TaskStatus status;
        private String workerId;
        private int retryCount;
        private int maxRetries;
        private int timeoutSeconds;
        private Instant startedAt;
        private Instant completedAt;
        private List<UUID> dependencies;
    }
}
