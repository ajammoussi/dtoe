package com.dtoe.master.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
    private int timeoutSeconds = 60;

    @Builder.Default
    private int maxRetries = 3;

    @Builder.Default
    private List<String> dependencies = new ArrayList<>();
}
