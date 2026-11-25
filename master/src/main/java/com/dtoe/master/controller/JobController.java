package com.dtoe.master.controller;

import com.dtoe.master.dto.request.JobSubmitRequest;
import com.dtoe.master.dto.response.JobDetailResponse;
import com.dtoe.master.dto.response.JobSubmitResponse;
import com.dtoe.master.dto.response.JobSummaryResponse;
import com.dtoe.master.service.DagValidationService;
import com.dtoe.master.service.JobService;
import com.dtoe.shared.enums.JobStatus;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
public class JobController {

    private static final Set<String> SORTABLE_PROPERTIES = Set.of("createdAt", "updatedAt", "name", "status");

    private final JobService jobService;

    @PostMapping
    public ResponseEntity<JobSubmitResponse> submitJob(@Valid @RequestBody JobSubmitRequest request) {
        JobSubmitResponse response = jobService.submitJob(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<JobSummaryResponse>> listJobs(
            @RequestParam(required = false) JobStatus status,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {

        Pageable pageable = toPageable(page, size, sort);
        Page<JobSummaryResponse> jobs = jobService.listJobs(status, q, pageable);
        return ResponseEntity.ok(jobs);
    }

    private static Pageable toPageable(int page, int size, String sort) {
        String[] sortParts = sort == null ? new String[0] : sort.split(",");
        String property = sortParts.length > 0 ? sortParts[0].trim() : "";
        if (!SORTABLE_PROPERTIES.contains(property)) {
            sortParts = new String[] {"createdAt", "desc"};
            property = "createdAt";
        }

        Sort.Direction direction = Sort.Direction.DESC;
        if (sortParts.length > 1) {
            try {
                direction = Sort.Direction.fromString(sortParts[1].trim());
            } catch (IllegalArgumentException ignored) {
                // unknown direction: keep DESC
            }
        }

        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);
        return PageRequest.of(safePage, safeSize, Sort.by(direction, property));
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<JobDetailResponse> getJob(@PathVariable UUID jobId) {
        return jobService.getJobDetail(jobId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{jobId}")
    public ResponseEntity<?> cancelJob(@PathVariable UUID jobId) {
        return jobService.cancelJob(jobId)
                .map(job -> ResponseEntity.ok(Map.<String, Object>of(
                        "jobId", job.getId(),
                        "status", job.getStatus(),
                        "message", "Job cancelled successfully"
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fields.put(error.getField(), error.getDefaultMessage()));
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Validation failed", "fields", fields));
    }

    @ExceptionHandler(DagValidationService.DagValidationException.class)
    public ResponseEntity<Map<String, String>> handleDagValidation(DagValidationService.DagValidationException ex) {
        return ResponseEntity
                .status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(Map.of("error", ex.getMessage()));
    }
}
