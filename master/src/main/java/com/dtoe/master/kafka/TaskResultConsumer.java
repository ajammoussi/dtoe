package com.dtoe.master.kafka;

import com.dtoe.master.domain.Task;
import com.dtoe.master.repository.TaskRepository;
import com.dtoe.master.service.JobService;
import com.dtoe.shared.enums.TaskStatus;
import com.dtoe.shared.message.TaskResultMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class TaskResultConsumer {

    private final TaskRepository taskRepository;
    private final JobService jobService;

    @KafkaListener(
        topics = "${dtoe.kafka.topics.task-results:task-results}",
        groupId = "${spring.kafka.consumer.group-id:dtoe-master}"
    )
    @Transactional
    public void handleTaskResult(TaskResultMessage message) {
        log.debug("Received task result for task {}", message.getTaskId());

        Optional<Task> taskOpt = taskRepository.findByIdWithJobAndDependents(message.getTaskId());
        if (taskOpt.isEmpty()) {
            log.warn("Received result for unknown task {}", message.getTaskId());
            return;
        }

        Task task = taskOpt.get();
        task.setStatus(message.getStatus());
        task.setCompletedAt(message.getCompletedAt());
        task.setWorkerId(message.getWorkerId());
        task.setErrorMessage(message.getErrorMessage());
        task.setOutput(message.getOutput());

        if (message.getStatus() == TaskStatus.FAILED || message.getStatus() == TaskStatus.TIMED_OUT) {
            if (task.canRetry()) {
                log.info("Task {} failed, scheduling retry (attempt {}/{})",
                    task.getId(), task.getRetryCount() + 1, task.getMaxRetries());
                task.setRetryCount(task.getRetryCount() + 1);
                task.setStatus(TaskStatus.RETRYING);
            } else {
                log.warn("Task {} failed after {} retries", task.getId(), task.getMaxRetries());
            }
        }

        taskRepository.save(task);

        if (message.getStatus() == TaskStatus.SUCCESS) {
            promoteDependentTasks(task);
        }

        jobService.checkAndUpdateJobCompletion(task.getJob().getId());
    }

    private void promoteDependentTasks(Task completedTask) {
        for (Task dependent : completedTask.getDependents()) {
            Task dependentWithDeps = taskRepository.findByIdWithDependencies(dependent.getId())
                .orElse(dependent);
            
            if (dependentWithDeps.getStatus() != TaskStatus.PENDING) continue;

            boolean allDepsComplete = dependentWithDeps.getDependencies().stream()
                .allMatch(dep -> dep.getStatus() == TaskStatus.SUCCESS);

            if (allDepsComplete) {
                log.info("All dependencies complete for task {}, promoting to QUEUED", dependentWithDeps.getId());
                jobService.enqueueTask(dependentWithDeps);
            }
        }
    }
}
