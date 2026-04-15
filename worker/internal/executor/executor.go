package executor

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "os/exec"
    "time"

    "github.com/dtoe/go_shared/pkg/messaging"
)

type TaskResult struct {
    Status      messaging.TaskStatus
    Output      map[string]interface{}
    Error       string
    StartedAt   time.Time
    CompletedAt time.Time
}

type TaskHandler interface {
    Execute(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error)
}

type HTTPRequestHandler struct{}

func (h *HTTPRequestHandler) Execute(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error) {
    url, ok := payload["url"].(string)
    if !ok {
        return nil, fmt.Errorf("missing or invalid 'url' in payload")
    }

    method, _ := payload["method"].(string)
    if method == "" {
        method = "GET"
    }

    var bodyReader *bytes.Reader
    if body, ok := payload["body"]; ok {
        bodyBytes, _ := json.Marshal(body)
        bodyReader = bytes.NewReader(bodyBytes)
    } else {
        bodyReader = bytes.NewReader([]byte{})
    }

    req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
    if err != nil {
        return nil, err
    }

    if headers, ok := payload["headers"].(map[string]interface{}); ok {
        for k, v := range headers {
            req.Header.Set(k, fmt.Sprintf("%v", v))
        }
    }

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        return nil, fmt.Errorf("HTTP request failed with status %d", resp.StatusCode)
    }

    var result map[string]interface{}
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        result = map[string]interface{}{
            "status_code": resp.StatusCode,
        }
    }

    return result, nil
}

type ShellCommandHandler struct{}

func (h *ShellCommandHandler) Execute(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error) {
    command, ok := payload["command"].(string)
    if !ok {
        return nil, fmt.Errorf("missing or invalid 'command' in payload")
    }

    args := []string{}
    if argsInterface, ok := payload["args"].([]interface{}); ok {
        for _, arg := range argsInterface {
            args = append(args, fmt.Sprintf("%v", arg))
        }
    }

    ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
    defer cancel()

    cmd := exec.CommandContext(ctx, command, args...)
    output, err := cmd.CombinedOutput()
    if err != nil {
        return nil, fmt.Errorf("command failed: %v, output: %s", err, string(output))
    }

    return map[string]interface{}{
        "output": string(output),
    }, nil
}

type NoOpHandler struct{}

func (h *NoOpHandler) Execute(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error) {
    return map[string]interface{}{"result": "success"}, nil
}

type TaskExecutor struct {
    handlers map[string]TaskHandler
}

func NewTaskExecutor() *TaskExecutor {
    return &TaskExecutor{
        handlers: map[string]TaskHandler{
            "HTTP_REQUEST":   &HTTPRequestHandler{},
            "SHELL_COMMAND":  &ShellCommandHandler{},
            "NO_OP":          &NoOpHandler{},
        },
    }
}

func (e *TaskExecutor) Execute(ctx context.Context, msg *messaging.TaskMessage) TaskResult {
    startedAt := time.Now()

    handler, ok := e.handlers[msg.Type]
    if !ok {
        return TaskResult{
            Status:      messaging.TaskStatusFailed,
            Error:       fmt.Sprintf("Unknown task type: %s", msg.Type),
            StartedAt:   startedAt,
            CompletedAt: time.Now(),
        }
    }

    execCtx, cancel := context.WithTimeout(ctx, time.Duration(msg.TimeoutSeconds)*time.Second)
    defer cancel()

    output, err := handler.Execute(execCtx, msg.Payload)
    completedAt := time.Now()

    if err != nil {
        return TaskResult{
            Status:      messaging.TaskStatusFailed,
            Error:       err.Error(),
            StartedAt:   startedAt,
            CompletedAt: completedAt,
        }
    }

    return TaskResult{
        Status:      messaging.TaskStatusSuccess,
        Output:      output,
        StartedAt:   startedAt,
        CompletedAt: completedAt,
    }
}
