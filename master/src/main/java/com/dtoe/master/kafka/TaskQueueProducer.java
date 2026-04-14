package com.dtoe.master.kafka;

import com.dtoe.master.domain.Task;
import com.dtoe.shared.message.TaskMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class TaskQueueProducer {

    private final KafkaTemplate<String, TaskMessage> kafkaTemplate;

    @Value("${dtoe.kafka.topics.task-queue:task-queue}")
    private String taskQueueTopic;

    public void publish(Task task) {
        TaskMessage message = TaskMessage.builder()
                .taskId(task.getId())
                .jobId(task.getJob().getId())
                .type(task.getType())
                .payload(task.getPayload())
                .timeoutSeconds(task.getTimeoutSeconds())
                .retryCount(task.getRetryCount())
                .maxRetries(task.getMaxRetries())
                .enqueuedAt(Instant.now())
                .build();

        kafkaTemplate.send(taskQueueTopic, task.getJob().getId().toString(), message)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish task {} to Kafka", task.getId(), ex);
                    } else {
                        log.debug("Published task {} to topic {}", task.getId(), taskQueueTopic);
                    }
                });
    }
}
