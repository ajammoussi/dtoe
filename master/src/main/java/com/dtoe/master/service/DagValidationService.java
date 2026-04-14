package com.dtoe.master.service;

import com.dtoe.master.dto.request.TaskDefinitionRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DagValidationService {

    private static final Set<String> SUPPORTED_TASK_TYPES = Set.of(
            "HTTP_REQUEST",
            "SHELL_COMMAND",
            "NO_OP"
    );

    public void validate(List<TaskDefinitionRequest> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            throw new DagValidationException("Task list cannot be empty");
        }

        validateTaskIds(tasks);
        validateTaskTypes(tasks);
        validateDependencies(tasks);
        validateNoCycles(tasks);
        validateHasRootTasks(tasks);
    }

    private void validateTaskIds(List<TaskDefinitionRequest> tasks) {
        Set<String> seen = new HashSet<>();
        for (TaskDefinitionRequest task : tasks) {
            if (task.getId() == null || task.getId().isBlank()) {
                throw new DagValidationException("Task id is required");
            }
            if (!seen.add(task.getId())) {
                throw new DagValidationException("Duplicate task id: " + task.getId());
            }
        }
    }

    private void validateTaskTypes(List<TaskDefinitionRequest> tasks) {
        for (TaskDefinitionRequest task : tasks) {
            if (task.getType() == null || !SUPPORTED_TASK_TYPES.contains(task.getType())) {
                throw new DagValidationException(
                        "Unknown task type: " + task.getType() + ". Supported types: " + SUPPORTED_TASK_TYPES
                );
            }
        }
    }

    private void validateDependencies(List<TaskDefinitionRequest> tasks) {
        Set<String> taskIds = tasks.stream()
                .map(TaskDefinitionRequest::getId)
                .collect(Collectors.toSet());

        for (TaskDefinitionRequest task : tasks) {
            if (task.getDependencies() != null) {
                for (String depId : task.getDependencies()) {
                    if (!taskIds.contains(depId)) {
                        throw new DagValidationException(
                                "Task '" + task.getId() + "' references unknown dependency: " + depId
                        );
                    }
                    if (depId.equals(task.getId())) {
                        throw new DagValidationException(
                                "Task '" + task.getId() + "' cannot depend on itself"
                        );
                    }
                }
            }
        }
    }

    private void validateNoCycles(List<TaskDefinitionRequest> tasks) {
        Map<String, List<String>> adjacencyList = new HashMap<>();
        for (TaskDefinitionRequest task : tasks) {
            adjacencyList.put(task.getId(), task.getDependencies() != null ? task.getDependencies() : new ArrayList<>());
        }

        Set<String> white = new HashSet<>(adjacencyList.keySet());
        Set<String> gray = new HashSet<>();
        Set<String> black = new HashSet<>();

        for (String nodeId : adjacencyList.keySet()) {
            if (white.contains(nodeId)) {
                if (hasCycle(nodeId, adjacencyList, white, gray, black)) {
                    throw new DagValidationException("DAG contains a cycle");
                }
            }
        }
    }

    private boolean hasCycle(String node, Map<String, List<String>> graph, 
                             Set<String> white, Set<String> gray, Set<String> black) {
        white.remove(node);
        gray.add(node);

        List<String> dependencies = graph.getOrDefault(node, Collections.emptyList());
        for (String dep : dependencies) {
            if (black.contains(dep)) continue;
            if (gray.contains(dep)) return true;
            if (hasCycle(dep, graph, white, gray, black)) return true;
        }

        gray.remove(node);
        black.add(node);
        return false;
    }

    private void validateHasRootTasks(List<TaskDefinitionRequest> tasks) {
        boolean hasRoot = tasks.stream()
                .anyMatch(t -> t.getDependencies() == null || t.getDependencies().isEmpty());
        if (!hasRoot) {
            throw new DagValidationException("DAG must have at least one root task (task with no dependencies)");
        }
    }

    public static class DagValidationException extends RuntimeException {
        public DagValidationException(String message) {
            super(message);
        }
    }
}
