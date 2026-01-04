// Package executor provides VU pool management
package executor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/aristrace/runner/internal/correlation"
	"github.com/aristrace/runner/internal/metrics"
	"github.com/aristrace/runner/pkg/scenario"
)

// VUPool manages a pool of virtual users
type VUPool struct {
	mu sync.RWMutex
	
	scenario   *scenario.CompiledScenario
	httpClient *HTTPClient
	metrics    *metrics.Collector
	baseCorr   *correlation.Engine
	
	vus        map[string]*VirtualUser
	cancelFns  map[string]context.CancelFunc
	
	thinkTimeMin time.Duration
	thinkTimeMax time.Duration
}

// NewVUPool creates a new VU pool
func NewVUPool(sc *scenario.CompiledScenario, client *HTTPClient, metr *metrics.Collector) *VUPool {
	// Initialize base correlation engine with scenario variables
	baseCorr := correlation.NewEngine()
	for k, v := range sc.Variables {
		baseCorr.SetVariable(k, v)
	}
	
	return &VUPool{
		scenario:     sc,
		httpClient:   client,
		metrics:      metr,
		baseCorr:     baseCorr,
		vus:          make(map[string]*VirtualUser),
		cancelFns:    make(map[string]context.CancelFunc),
		thinkTimeMin: time.Duration(sc.Config.ThinkTimeMin) * time.Millisecond,
		thinkTimeMax: time.Duration(sc.Config.ThinkTimeMax) * time.Millisecond,
	}
}

// ScaleVUs adjusts the number of running VUs to the target
func (p *VUPool) ScaleVUs(ctx context.Context, target int) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	current := len(p.vus)
	
	if target > current {
		// Spawn new VUs
		for i := current; i < target; i++ {
			if err := p.spawnVU(ctx, i); err != nil {
				return fmt.Errorf("failed to spawn VU %d: %w", i, err)
			}
		}
	} else if target < current {
		// Stop excess VUs
		count := 0
		for id, cancel := range p.cancelFns {
			if count >= current-target {
				break
			}
			cancel()
			delete(p.vus, id)
			delete(p.cancelFns, id)
			count++
		}
	}
	
	// Update metrics
	p.metrics.SetActiveVUs(int32(len(p.vus)))
	
	return nil
}

// spawnVU creates and starts a new VU
func (p *VUPool) spawnVU(ctx context.Context, index int) error {
	vuID := fmt.Sprintf("vu-%d", index)
	
	// Create VU-specific context
	vuCtx, cancel := context.WithCancel(ctx)
	
	// Create VU
	vu := NewVirtualUser(vuID, p.scenario, p.httpClient, p.baseCorr, p.metrics)
	
	p.vus[vuID] = vu
	p.cancelFns[vuID] = cancel
	
	// Start VU in goroutine
	go vu.Run(vuCtx, p.getThinkTime)
	
	return nil
}

// getThinkTime returns a random think time
func (p *VUPool) getThinkTime() time.Duration {
	if p.thinkTimeMax <= p.thinkTimeMin {
		return p.thinkTimeMin
	}
	
	diff := p.thinkTimeMax - p.thinkTimeMin
	// Simple randomization
	random := time.Duration(time.Now().UnixNano()%int64(diff)) + p.thinkTimeMin
	return random
}

// StopAll stops all running VUs
func (p *VUPool) StopAll() {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	for id, cancel := range p.cancelFns {
		cancel()
		delete(p.vus, id)
		delete(p.cancelFns, id)
	}
	
	p.metrics.SetActiveVUs(0)
}

// GetActiveCount returns the number of active VUs
func (p *VUPool) GetActiveCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.vus)
}

// GetVUs returns all VUs
func (p *VUPool) GetVUs() []*VirtualUser {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	vus := make([]*VirtualUser, 0, len(p.vus))
	for _, vu := range p.vus {
		vus = append(vus, vu)
	}
	return vus
}

