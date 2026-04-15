package messaging

import (
    "encoding/json"
    "time"
)

type TaskMessage struct {
    TaskID         string                 `json:"taskId"`
    JobID          string                 `json:"jobId"`
    Type           string                 `json:"type"`
    Payload        map[string]interface{} `json:"payload"`
    TimeoutSeconds int                    `json:"timeoutSeconds"`
    RetryCount     int                    `json:"retryCount"`
    MaxRetries     int                    `json:"maxRetries"`
    EnqueuedAt     time.Time              `json:"enqueuedAt"`
}

func (m TaskMessage) ToJSON() ([]byte, error) {
    return json.Marshal(m)
}

func ParseTaskMessage(data []byte) (*TaskMessage, error) {
    var msg TaskMessage
    if err := json.Unmarshal(data, &msg); err != nil {
        return nil, err
    }
    return &msg, nil
}
