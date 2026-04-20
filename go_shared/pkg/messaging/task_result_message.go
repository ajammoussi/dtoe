package messaging

import (
	"encoding/json"
)

type TaskResultMessage struct {
	TaskID       string                 `json:"taskId"`
	JobID        string                 `json:"jobId"`
	WorkerID     string                 `json:"workerId"`
	Status       TaskStatus             `json:"status"`
	Output       map[string]interface{} `json:"output,omitempty"`
	ErrorMessage string                 `json:"errorMessage,omitempty"`
	StartedAt    CustomTime             `json:"startedAt"`
	CompletedAt  CustomTime             `json:"completedAt"`
}

func (m TaskResultMessage) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

func ParseTaskResultMessage(data []byte) (*TaskResultMessage, error) {
	var msg TaskResultMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}
