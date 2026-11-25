package com.dtoe.master.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerListResponse {

    private List<WorkerResponse> workers;
    private int activeCount;
    private int inactiveCount;
    private int totalCapacity;
    private int totalActiveTasks;
    private double clusterUtilizationPct;
}
