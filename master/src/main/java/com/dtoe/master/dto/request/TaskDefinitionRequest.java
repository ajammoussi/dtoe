package com.dtoe.master.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskDefinitionRequest {

    @NotBlank(message = "Task id is required")
    private String id;

    @NotBlank(message = "Task name is required")
    private String name;

    @NotBlank(message = "Task type is required")
    private String type;

    private Map<String, Object> payload;

    @Builder.Default
    @Min(value = 1, message = "timeoutSeconds must be at least 1")
    @Max(value = 3600, message = "timeoutSeconds must be at most 3600")
    private int timeoutSeconds = 60;

    @Builder.Default
    @Min(value = 0, message = "maxRetries must be at least 0")
    @Max(value = 10, message = "maxRetries must be at most 10")
    private int maxRetries = 3;

    @Builder.Default
    @com.fasterxml.jackson.annotation.JsonAlias({"dependsOn"})
    private List<String> dependencies = new ArrayList<>();
}
