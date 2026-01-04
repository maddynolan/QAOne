// Package executor provides virtual user execution
package executor

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/aristrace/runner/internal/correlation"
	"github.com/aristrace/runner/internal/metrics"
	"github.com/aristrace/runner/pkg/scenario"
)

// VirtualUser represents a single virtual user executing a scenario
type VirtualUser struct {
	ID            string
	Scenario      *scenario.CompiledScenario
	HTTPClient    *HTTPClient
	Correlation   *correlation.Engine
	Metrics       *metrics.Collector
	
	// State
	iteration int
	running   bool
	mu        sync.RWMutex
	
	// Error handling
	lastError error
}

// NewVirtualUser creates a new virtual user
func NewVirtualUser(id string, sc *scenario.CompiledScenario, client *HTTPClient, corr *correlation.Engine, metr *metrics.Collector) *VirtualUser {
	return &VirtualUser{
		ID:          id,
		Scenario:    sc,
		HTTPClient:  client,
		Correlation: corr.Clone(), // Each VU gets its own correlation state
		Metrics:     metr,
	}
}

// Run runs the virtual user until the context is cancelled
func (vu *VirtualUser) Run(ctx context.Context, thinkTimeFn func() time.Duration) {
	vu.mu.Lock()
	vu.running = true
	vu.mu.Unlock()
	
	defer func() {
		vu.mu.Lock()
		vu.running = false
		vu.mu.Unlock()
	}()
	
	for {
		select {
		case <-ctx.Done():
			return
		default:
			vu.runIteration(ctx)
			vu.iteration++
			
			// Apply think time between iterations
			thinkTime := thinkTimeFn()
			if thinkTime > 0 {
				select {
				case <-ctx.Done():
					return
				case <-time.After(thinkTime):
				}
			}
		}
	}
}

// runIteration runs a single iteration of the scenario
func (vu *VirtualUser) runIteration(ctx context.Context) {
	for _, step := range vu.Scenario.Steps {
		select {
		case <-ctx.Done():
			return
		default:
			if err := vu.executeStep(ctx, &step); err != nil {
				vu.mu.Lock()
				vu.lastError = err
				vu.mu.Unlock()
				// Log but continue - don't stop the VU
				log.Printf("[VU-%s] Step %s failed: %v", vu.ID, step.Name, err)
			}
		}
	}
}

// executeStep executes a single step
func (vu *VirtualUser) executeStep(ctx context.Context, step *scenario.Step) error {
	switch step.Type {
	case "http":
		return vu.executeHTTPStep(ctx, step)
	case "think":
		return vu.executeThinkStep(ctx, step)
	case "loop":
		return vu.executeLoopStep(ctx, step)
	case "condition":
		return vu.executeConditionStep(ctx, step)
	default:
		// Assume HTTP request if type is empty
		if step.Method != "" && step.URL != "" {
			return vu.executeHTTPStep(ctx, step)
		}
		return fmt.Errorf("unknown step type: %s", step.Type)
	}
}

// executeHTTPStep executes an HTTP request step
func (vu *VirtualUser) executeHTTPStep(ctx context.Context, step *scenario.Step) error {
	// Apply correlation to URL and headers
	url := vu.Correlation.Substitute(step.URL)
	headers := vu.Correlation.SubstituteMap(step.Headers)
	
	// Build request
	req := &Request{
		Method:   step.Method,
		URL:      url,
		Headers:  headers,
		Body:     step.Body,
		FormData: step.FormData,
	}
	
	// Execute request
	resp := vu.HTTPClient.Execute(ctx, req)
	
	// Record metrics
	success := resp.Error == nil && resp.StatusCode >= 200 && resp.StatusCode < 400
	vu.Metrics.RecordRequest(
		resp.Duration.Milliseconds(),
		success,
		resp.BytesSent,
		resp.BytesReceived,
	)
	
	if resp.Error != nil {
		return resp.Error
	}
	
	// Extract correlation values
	if len(step.Extract) > 0 {
		vu.Correlation.Extract(resp.Body, resp.Headers, resp.StatusCode, step.Extract)
	}
	
	// Auto-detect correlation values
	vu.Correlation.AutoDetect(resp.Body, resp.Headers)
	
	// Run assertions
	for _, assertion := range step.Assertions {
		if err := vu.checkAssertion(resp, &assertion); err != nil {
			return fmt.Errorf("assertion failed: %w", err)
		}
	}
	
	return nil
}

// executeThinkStep pauses execution for the specified time
func (vu *VirtualUser) executeThinkStep(ctx context.Context, step *scenario.Step) error {
	duration := time.Duration(step.ThinkTimeMS) * time.Millisecond
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(duration):
		return nil
	}
}

// executeLoopStep executes steps in a loop
func (vu *VirtualUser) executeLoopStep(ctx context.Context, step *scenario.Step) error {
	for i := 0; i < step.LoopCount; i++ {
		for _, loopStep := range step.LoopSteps {
			if err := vu.executeStep(ctx, &loopStep); err != nil {
				return err
			}
		}
	}
	return nil
}

// executeConditionStep executes conditional steps
func (vu *VirtualUser) executeConditionStep(ctx context.Context, step *scenario.Step) error {
	// Simple condition evaluation (expand as needed)
	conditionMet := vu.evaluateCondition(step.Condition)
	
	var stepsToExecute []scenario.Step
	if conditionMet {
		stepsToExecute = step.ThenSteps
	} else {
		stepsToExecute = step.ElseSteps
	}
	
	for _, condStep := range stepsToExecute {
		if err := vu.executeStep(ctx, &condStep); err != nil {
			return err
		}
	}
	
	return nil
}

// evaluateCondition evaluates a simple condition string
func (vu *VirtualUser) evaluateCondition(condition string) bool {
	// Substitute variables and check if non-empty
	result := vu.Correlation.Substitute(condition)
	return result != "" && result != "false" && result != "0"
}

// checkAssertion verifies a response assertion
func (vu *VirtualUser) checkAssertion(resp *Response, assertion *scenario.Assertion) error {
	switch assertion.Type {
	case "status":
		expected, ok := assertion.Expected.(float64)
		if !ok {
			return fmt.Errorf("invalid status assertion")
		}
		if resp.StatusCode != int(expected) {
			return fmt.Errorf("expected status %d, got %d", int(expected), resp.StatusCode)
		}
		
	case "body_contains":
		expected, ok := assertion.Expected.(string)
		if !ok {
			return fmt.Errorf("invalid body_contains assertion")
		}
		if resp.BodyString == "" || !contains(resp.BodyString, expected) {
			return fmt.Errorf("body does not contain: %s", expected)
		}
		
	case "response_time":
		expected, ok := assertion.Expected.(float64)
		if !ok {
			return fmt.Errorf("invalid response_time assertion")
		}
		op := assertion.Operator
		if op == "" {
			op = "<"
		}
		actual := float64(resp.Duration.Milliseconds())
		if !compareFloat(actual, expected, op) {
			return fmt.Errorf("response time %s %v failed: actual=%vms", op, expected, actual)
		}
	}
	
	return nil
}

// GetIteration returns the current iteration count
func (vu *VirtualUser) GetIteration() int {
	vu.mu.RLock()
	defer vu.mu.RUnlock()
	return vu.iteration
}

// IsRunning returns whether the VU is running
func (vu *VirtualUser) IsRunning() bool {
	vu.mu.RLock()
	defer vu.mu.RUnlock()
	return vu.running
}

// GetLastError returns the last error encountered
func (vu *VirtualUser) GetLastError() error {
	vu.mu.RLock()
	defer vu.mu.RUnlock()
	return vu.lastError
}

// Helper functions

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || 
		(len(s) > 0 && len(substr) > 0 && 
			(s[:len(substr)] == substr || contains(s[1:], substr))))
}

func compareFloat(actual, expected float64, op string) bool {
	switch op {
	case "<":
		return actual < expected
	case ">":
		return actual > expected
	case "<=":
		return actual <= expected
	case ">=":
		return actual >= expected
	case "==":
		return actual == expected
	default:
		return false
	}
}

