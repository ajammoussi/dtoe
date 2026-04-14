package com.dtoe.master.domain;

import com.dtoe.shared.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TaskStatus status = TaskStatus.PENDING;

    @Builder.Default
    private int retryCount = 0;

    @Builder.Default
    private int maxRetries = 3;

    @Builder.Default
    private int timeoutSeconds = 60;

    private String workerId;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    private Instant queuedAt;
    private Instant startedAt;
    private Instant completedAt;

    private String errorMessage;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> output;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "task_dependencies",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "dependency_id")
    )
    @Builder.Default
    private List<Task> dependencies = new ArrayList<>();

    @ManyToMany(mappedBy = "dependencies", fetch = FetchType.LAZY)
    @Builder.Default
    private List<Task> dependents = new ArrayList<>();

    public boolean isTerminal() {
        return status == TaskStatus.SUCCESS
                || status == TaskStatus.FAILED
                || status == TaskStatus.TIMED_OUT
                || status == TaskStatus.CANCELLED;
    }

    public boolean canRetry() {
        return retryCount < maxRetries;
    }
}
