// Package scenario defines the compiled scenario format used by the runner
package scenario

import (
	"encoding/json"
	"os"
)

// CompiledScenario is the universal format from any source (HAR, Recorder, Builder, Manual)
type CompiledScenario struct {
	ScenarioID string                 `json:"scenario_id"`
	Name       string                 `json:"name"`
	Source     string                 `json:"source"` // "har", "recorder", "builder", "manual"
	Version    string                 `json:"version"`
	CreatedAt  string                 `json:"created_at"`

	Config     Config                 `json:"config"`
	Thresholds []Threshold            `json:"thresholds"`
	Variables  map[string]interface{} `json:"variables"`
	DataPools  []DataPool             `json:"data_pools"`
	Steps      []Step                 `json:"steps"`
}

// Config defines the load test configuration
type Config struct {
	VirtualUsers      int    `json:"virtual_users"`
	DurationSeconds   int    `json:"duration_seconds"`
	RampUpSeconds     int    `json:"ramp_up_seconds"`
	RampDownSeconds   int    `json:"ramp_down_seconds"`
	TargetURL         string `json:"target_url"`
	EnableHTTP2       bool   `json:"enable_http2"`
	ConnectionTimeout int    `json:"connection_timeout_ms"`
	RequestTimeout    int    `json:"request_timeout_ms"`
	ThinkTimeMin      int    `json:"think_time_min_ms"`
	ThinkTimeMax      int    `json:"think_time_max_ms"`
}

// Threshold defines a pass/fail threshold
type Threshold struct {
	Metric   string  `json:"metric"`
	Operator string  `json:"op"`
	Value    float64 `json:"value"`
	Critical bool    `json:"critical"`
	Name     string  `json:"name"`
}

// DataPool defines a parameterization data source
type DataPool struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	File     string   `json:"file"`
	Mode     string   `json:"mode"` // "sequential", "random", "unique", "shared"
	Columns  []string `json:"columns"`
	InlineData []map[string]interface{} `json:"inline_data,omitempty"` // For embedded data
}

// Step defines a single test step
type Step struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Type        string            `json:"type"` // "http", "think", "loop", "condition"
	
	// HTTP Request fields
	Method      string            `json:"method,omitempty"`
	URL         string            `json:"url,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Body        interface{}       `json:"body,omitempty"`
	FormData    map[string]string `json:"form_data,omitempty"`
	
	// Correlation
	Extract     []Extractor       `json:"extract,omitempty"`
	
	// Assertions
	Assertions  []Assertion       `json:"assertions,omitempty"`
	
	// Think time (for think steps)
	ThinkTimeMS int               `json:"think_time_ms,omitempty"`
	
	// Loop config
	LoopCount   int               `json:"loop_count,omitempty"`
	LoopSteps   []Step            `json:"loop_steps,omitempty"`
	
	// Condition
	Condition   string            `json:"condition,omitempty"`
	ThenSteps   []Step            `json:"then_steps,omitempty"`
	ElseSteps   []Step            `json:"else_steps,omitempty"`
}

// Extractor defines how to extract values from responses
type Extractor struct {
	Name     string `json:"name"`               // Variable name to store
	From     string `json:"from"`               // "json", "header", "cookie", "regex", "body", "status"
	Path     string `json:"path,omitempty"`     // JSONPath for json extraction
	Key      string `json:"key,omitempty"`      // Header/cookie name
	Regex    string `json:"regex,omitempty"`    // Regex pattern with capture group
	Default  string `json:"default,omitempty"`  // Default value if not found
}

// Assertion defines a test assertion
type Assertion struct {
	Type     string      `json:"type"`               // "status", "body_contains", "json_path", "header", "response_time"
	Expected interface{} `json:"expected"`
	Path     string      `json:"path,omitempty"`     // For json_path
	Key      string      `json:"key,omitempty"`      // For header
	Operator string      `json:"operator,omitempty"` // For numeric comparisons: "<", ">", "==", etc.
}

// LoadFromFile loads a compiled scenario from a JSON file
func LoadFromFile(path string) (*CompiledScenario, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	
	var scenario CompiledScenario
	if err := json.Unmarshal(data, &scenario); err != nil {
		return nil, err
	}
	
	return &scenario, nil
}

// LoadFromBytes loads a compiled scenario from JSON bytes
func LoadFromBytes(data []byte) (*CompiledScenario, error) {
	var scenario CompiledScenario
	if err := json.Unmarshal(data, &scenario); err != nil {
		return nil, err
	}
	return &scenario, nil
}

// ToJSON converts the scenario to JSON bytes
func (s *CompiledScenario) ToJSON() ([]byte, error) {
	return json.MarshalIndent(s, "", "  ")
}

// GetVariable returns a variable value with string conversion
func (s *CompiledScenario) GetVariable(name string) string {
	if val, ok := s.Variables[name]; ok {
		switch v := val.(type) {
		case string:
			return v
		case float64:
			return json.Number(string(rune(v))).String()
		default:
			b, _ := json.Marshal(v)
			return string(b)
		}
	}
	return ""
}

