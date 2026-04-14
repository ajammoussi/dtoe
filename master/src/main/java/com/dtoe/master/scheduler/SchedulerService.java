package com.dtoe.master.scheduler;

import com.dtoe.master.domain.Task;
import com.dtoe.master.repository.TaskRepository;
import com.dtoe.master.service.JobService;
import com.dtoe.shared.enums.TaskStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SchedulerService {

    private final TaskRepository taskRepository;
    private final JobService jobService;

    @Value("${dtoe.scheduler.interval-ms:5000}")
    private long schedulerIntervalMs;

    @Scheduled(fixedDelayString = "${dtoe.scheduler.interval-ms:5000}")
    @Transactional
    public void promoteReadyTasks() {
        List<Task> readyTasks = taskRepository.findReadyTasks(TaskStatus.PENDING);
        for (Task task : readyTasks) {
            log.debug("Promoting task {} to QUEUED", task.getId());
            jobService.enqueueTask(task);
        }
        if (!readyTasks.isEmpty()) {
            log.info("Promoted {} tasks to QUEUED", readyTasks.size());
        }
    }

    @Scheduled(fixedDelayString = "${dtoe.scheduler.timeout-check-ms:10000}")
    @Transactional
    public void enforceTimeouts() {
        List<Task> timedOutTasks = taskRepository.findTimedOutTasks(Instant.now());
        for (Task task : timedOutTasks) {
            log.warn("Task {} timed out after {}s", task.getId(), task.getTimeoutSeconds());
            task.setStatus(TaskStatus.TIMED_OUT);
            task.setCompletedAt(Instant.now());
            taskRepository.save(task);

            if (task.canRetry()) {
                task.setRetryCount(task.getRetryCount() + 1);
                task.setStatus(TaskStatus.RETRYING);
                taskRepository.save(task);
                jobService.enqueueTask(task);
            }
        }
        if (!timedOutTasks.isEmpty()) {
            log.warn("Marked {} tasks as TIMED_OUT", timedOutTasks.size());
        }
    }
}
