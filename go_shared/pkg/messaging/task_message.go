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
	EnqueuedAt     CustomTime             `json:"enqueuedAt"`
}

type CustomTime struct {
	time.Time
}

func (ct *CustomTime) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		ct.Time = time.Time{}
		return nil
	}

	var v interface{}
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}

	switch val := v.(type) {
	case float64:
		// If val > 1e11, it is in milliseconds (e.g. 1713500000000), otherwise it is decimal seconds (e.g. 1713500000.123)
		if val > 1e11 {
			ct.Time = time.UnixMilli(int64(val))
		} else {
			sec := int64(val)
			nsec := int64((val - float64(sec)) * 1e9)
			ct.Time = time.Unix(sec, nsec)
		}
		return nil
	case string:
		parsed, err := time.Parse(time.RFC3339Nano, val)
		if err != nil {
			parsed, err = time.Parse(time.RFC3339, val)
			if err != nil {
				return err
			}
		}
		ct.Time = parsed
		return nil
	default:
		return nil
	}
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
