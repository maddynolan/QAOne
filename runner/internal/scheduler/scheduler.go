// Package scheduler handles VU ramping and pacing
package scheduler

import (
	"context"
	"math"
	"sync"
	"time"
)

// Scheduler manages virtual user ramping and think times
type Scheduler struct {
	mu sync.RWMutex
	
	targetVUs     int
	currentVUs    int
	rampUpSecs    int
	rampDownSecs  int
	durationSecs  int
	thinkTimeMin  time.Duration
	thinkTimeMax  time.Duration
	
	startTime time.Time
	state     State
	
	// Callbacks
	onVUChange func(newCount int)
}

// State represents the scheduler state
type State string

const (
	StateIdle       State = "idle"
	StateRampingUp  State = "ramping_up"
	StateRunning    State = "running"
	StateRampingDown State = "ramping_down"
	StateStopped    State = "stopped"
)

// Config configures the scheduler
type Config struct {
	TargetVUs    int
	RampUpSecs   int
	RampDownSecs int
	DurationSecs int
	ThinkTimeMin time.Duration
	ThinkTimeMax time.Duration
}

// NewScheduler creates a new scheduler
func NewScheduler(cfg Config) *Scheduler {
	return &Scheduler{
		targetVUs:    cfg.TargetVUs,
		rampUpSecs:   cfg.RampUpSecs,
		rampDownSecs: cfg.RampDownSecs,
		durationSecs: cfg.DurationSecs,
		thinkTimeMin: cfg.ThinkTimeMin,
		thinkTimeMax: cfg.ThinkTimeMax,
		state:        StateIdle,
	}
}

// SetOnVUChange sets the callback for VU count changes
func (s *Scheduler) SetOnVUChange(fn func(int)) {
	s.mu.Lock()
	s.onVUChange = fn
	s.mu.Unlock()
}

// Start starts the scheduler
func (s *Scheduler) Start(ctx context.Context) {
	s.mu.Lock()
	s.startTime = time.Now()
	s.state = StateRampingUp
	s.mu.Unlock()
	
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			s.setState(StateStopped)
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

// tick is called periodically to update VU count
func (s *Scheduler) tick() {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	elapsed := time.Since(s.startTime).Seconds()
	totalDuration := float64(s.rampUpSecs + s.durationSecs + s.rampDownSecs)
	
	var newVUs int
	
	switch {
	case elapsed < float64(s.rampUpSecs):
		// Ramp up phase
		s.state = StateRampingUp
		progress := elapsed / float64(s.rampUpSecs)
		newVUs = int(math.Ceil(progress * float64(s.targetVUs)))
		
	case elapsed < float64(s.rampUpSecs+s.durationSecs):
		// Steady state
		s.state = StateRunning
		newVUs = s.targetVUs
		
	case elapsed < totalDuration:
		// Ramp down phase
		s.state = StateRampingDown
		rampDownElapsed := elapsed - float64(s.rampUpSecs+s.durationSecs)
		progress := 1 - (rampDownElapsed / float64(s.rampDownSecs))
		newVUs = int(math.Ceil(progress * float64(s.targetVUs)))
		if newVUs < 0 {
			newVUs = 0
		}
		
	default:
		// Test complete
		s.state = StateStopped
		newVUs = 0
	}
	
	if newVUs != s.currentVUs {
		s.currentVUs = newVUs
		if s.onVUChange != nil {
			// Call without lock to prevent deadlock
			fn := s.onVUChange
			s.mu.Unlock()
			fn(newVUs)
			s.mu.Lock()
		}
	}
}

// AdjustTargetVUs adjusts the target VU count mid-run
func (s *Scheduler) AdjustTargetVUs(target int) {
	s.mu.Lock()
	s.targetVUs = target
	s.mu.Unlock()
}

// GetState returns the current scheduler state
func (s *Scheduler) GetState() State {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state
}

// GetCurrentVUs returns the current VU count
func (s *Scheduler) GetCurrentVUs() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.currentVUs
}

// GetTargetVUs returns the target VU count
func (s *Scheduler) GetTargetVUs() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.targetVUs
}

// GetElapsedSeconds returns elapsed time in seconds
func (s *Scheduler) GetElapsedSeconds() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return int(time.Since(s.startTime).Seconds())
}

// IsFinished returns true if the test is complete
func (s *Scheduler) IsFinished() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state == StateStopped
}

// GetThinkTime returns a random think time within bounds
func (s *Scheduler) GetThinkTime() time.Duration {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if s.thinkTimeMax <= s.thinkTimeMin {
		return s.thinkTimeMin
	}
	
	diff := s.thinkTimeMax - s.thinkTimeMin
	// Simple randomization (good enough for think times)
	random := time.Duration(time.Now().UnixNano()%int64(diff)) + s.thinkTimeMin
	return random
}

// setState sets the scheduler state
func (s *Scheduler) setState(state State) {
	s.mu.Lock()
	s.state = state
	s.mu.Unlock()
}

