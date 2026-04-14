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
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @PostMapping
    public ResponseEntity<JobSubmitResponse> submitJob(@Valid @RequestBody JobSubmitRequest request) {
        JobSubmitResponse response = jobService.submitJob(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<JobSummaryResponse>> listJobs(
            @RequestParam(required = false) JobStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {

        String[] sortParts = sort.split(",");
        Sort.Direction direction = sortParts.length > 1 
                ? Sort.Direction.fromString(sortParts[1]) 
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(direction, sortParts[0]));

        Page<JobSummaryResponse> jobs = jobService.listJobs(status, pageable);
        return ResponseEntity.ok(jobs);
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
