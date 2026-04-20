package com.dtoe.master.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobSubmitRequest {

    @NotBlank(message = "Job name is required")
    private String name;

    private String submittedBy;

    @NotEmpty(message = "At least one task is required")
    @Valid
    private List<TaskDefinitionRequest> tasks;
}
