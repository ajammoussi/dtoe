package com.dtoe.master.dto.response;

import com.dtoe.shared.enums.JobStatus;
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
public class JobSummaryResponse {

    private UUID jobId;
    private String name;
    private JobStatus status;
    private int taskCount;
    private int completedTasks;
    private Instant createdAt;
    private Instant completedAt;
}
