package com.dtoe.master.dto.response;

import com.dtoe.shared.enums.WorkerStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerListResponse {

    private List<WorkerResponse> workers;
    private int totalCapacity;
    private int totalActiveTasks;
    private double clusterUtilizationPct;
}
