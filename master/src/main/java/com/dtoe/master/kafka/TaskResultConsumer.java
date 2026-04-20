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

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class TaskResultConsumer {

    private final TaskRepository taskRepository;
    private final JobService jobService;

    @KafkaListener(
        topics = "${dtoe.kafka.topics.task-results:task-results}",
        groupId = "${spring.kafka.consumer.group-id:dtoe-master}",
        containerFactory = "taskResultListenerContainerFactory"
    )
    @Transactional
    public void handleTaskResult(TaskResultMessage message) {
        log.debug("Received task result for task {}", message.getTaskId());

        Optional<Task> taskOpt = taskRepository.findByIdWithJob(message.getTaskId());
        if (taskOpt.isEmpty()) {
            log.warn("Received result for unknown task {}", message.getTaskId());
            return;
        }

        Task task = taskOpt.get();
        // Only a task the worker actually claimed may accept a result. Anything the
        // scheduler already recycled (RETRYING, TIMED_OUT, FAILED) keeps its state.
        if (task.getStatus() != TaskStatus.RUNNING) {
            log.info("Ignoring result for task {} in state {} (expected RUNNING)", task.getId(), task.getStatus());
            return;
        }

        task.setStatus(message.getStatus());
        task.setStartedAt(message.getStartedAt());
        task.setCompletedAt(message.getCompletedAt());
        task.setWorkerId(message.getWorkerId());
        task.setErrorMessage(message.getErrorMessage());
        task.setOutput(message.getOutput());

        boolean retryScheduled = false;
        if (message.getStatus() == TaskStatus.FAILED || message.getStatus() == TaskStatus.TIMED_OUT) {
            if (task.canRetry()) {
                int nextRetry = task.getRetryCount() + 1;
                long delaySeconds = Math.min((long) Math.pow(2, nextRetry) * 2L, 60L);
                Instant scheduledFor = Instant.now().plusSeconds(delaySeconds);

                log.info("Task {} failed, scheduling retry (attempt {}/{}) with backoff delay {}s (scheduled for {})",
                    task.getId(), nextRetry, task.getMaxRetries(), delaySeconds, scheduledFor);
                task.setRetryCount(nextRetry);
                task.setScheduledFor(scheduledFor);
                task.setStatus(TaskStatus.RETRYING);
                task.setCompletedAt(null);
                retryScheduled = true;
            } else {
                log.warn("Task {} failed after {} retries", task.getId(), task.getMaxRetries());
            }
        }

        taskRepository.save(task);

        if (!retryScheduled
                && (message.getStatus() == TaskStatus.FAILED || message.getStatus() == TaskStatus.TIMED_OUT)) {
            cancelDownstream(task);
        }

        jobService.checkAndUpdateJobCompletion(task.getJob().getId());
    }

    /**
     * Marks every not-yet-started transitive dependent of a failed task CANCELLED,
     * so the tasks can never become ready and the job can reach a terminal state.
     */
    private void cancelDownstream(Task failed) {
        List<Task> jobTasks = taskRepository.findByJobIdWithDependencies(failed.getJob().getId());
        Map<UUID, List<Task>> dependentsOf = new HashMap<>();
        for (Task t : jobTasks) {
            for (Task dep : t.getDependencies()) {
                dependentsOf.computeIfAbsent(dep.getId(), k -> new ArrayList<>()).add(t);
            }
        }

        Deque<Task> queue = new ArrayDeque<>(dependentsOf.getOrDefault(failed.getId(), List.of()));
        while (!queue.isEmpty()) {
            Task t = queue.poll();
            if (t.getStatus() != TaskStatus.PENDING && t.getStatus() != TaskStatus.RETRYING) {
                continue;
            }
            t.setStatus(TaskStatus.CANCELLED);
            t.setScheduledFor(null);
            t.setCompletedAt(Instant.now());
            t.setErrorMessage("Skipped: upstream task '" + failed.getName() + "' failed");
            taskRepository.save(t);
            log.info("Skipped downstream task {} of failed task {}", t.getId(), failed.getId());
            queue.addAll(dependentsOf.getOrDefault(t.getId(), List.of()));
        }
    }
}
