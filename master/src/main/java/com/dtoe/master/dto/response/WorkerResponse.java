package com.dtoe.master.dto.response;

import com.dtoe.shared.enums.WorkerStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerResponse {

    private String workerId;
    private String hostname;
    private WorkerStatus status;
    private int activeTasks;
    private int capacity;
    private double utilizationPct;
    private Instant lastSeenAt;
    private Instant startedAt;
}
