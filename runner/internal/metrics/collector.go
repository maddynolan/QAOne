// Package metrics provides high-performance metrics collection using HdrHistogram
package metrics

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/HdrHistogram/hdrhistogram-go"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// Collector collects and aggregates metrics for load tests
type Collector struct {
	mu sync.RWMutex
	
	// Request counts (atomic for performance)
	totalRequests     int64
	successfulRequests int64
	failedRequests    int64
	
	// Bytes transferred (atomic)
	bytesSent     int64
	bytesReceived int64
	
	// Response time histogram (thread-safe via mutex)
	responseTimeHist *hdrhistogram.Histogram
	
	// Active VUs
	activeVUs int32
	peakVUs   int32
	
	// Time tracking
	startTime time.Time
	lastReset time.Time
	
	// Per-second metrics (for RPS calculation)
	requestsLastSecond int64
	lastSecondTime     time.Time
	
	// Network baseline
	netBaseline net.IOCountersStat
}

// Snapshot represents a point-in-time metrics snapshot
type Snapshot struct {
	// Timestamp
	Timestamp     time.Time
	ElapsedMillis int64
	
	// Virtual Users
	ActiveVUs int32
	PeakVUs   int32
	
	// Request counts
	TotalRequests      int64
	SuccessfulRequests int64
	FailedRequests     int64
	ErrorRate          float64
	
	// Throughput
	RequestsPerSecond float64
	BytesSent         int64
	BytesReceived     int64
	
	// Response times (milliseconds)
	ResponseTimeMin float64
	ResponseTimeMax float64
	ResponseTimeAvg float64
	ResponseTimeP50 float64
	ResponseTimeP75 float64
	ResponseTimeP90 float64
	ResponseTimeP95 float64
	ResponseTimeP99 float64
	
	// Host metrics
	HostCPUPercent    float64
	HostMemoryPercent float64
	HostOpenConns     int64
	
	// Go runtime
	GoGoroutines int64
	GoHeapBytes  int64
}

// Summary represents final test summary
type Summary struct {
	DurationSeconds int32
	PeakVUs         int32
	
	TotalRequests      int64
	SuccessfulRequests int64
	FailedRequests     int64
	ErrorRate          float64
	
	AvgResponseTime float64
	P50ResponseTime float64
	P95ResponseTime float64
	P99ResponseTime float64
	MinResponseTime float64
	MaxResponseTime float64
	
	RequestsPerSecond float64
	BytesSent         int64
	BytesReceived     int64
}

// NewCollector creates a new metrics collector
func NewCollector() *Collector {
	// Create histogram: 1ms to 60s, 3 significant digits
	hist := hdrhistogram.New(1, 60000, 3)
	
	c := &Collector{
		responseTimeHist: hist,
		startTime:        time.Now(),
		lastReset:        time.Now(),
		lastSecondTime:   time.Now(),
	}
	
	// Get network baseline
	if counters, err := net.IOCounters(false); err == nil && len(counters) > 0 {
		c.netBaseline = counters[0]
	}
	
	return c
}

// RecordRequest records a completed request
func (c *Collector) RecordRequest(durationMs int64, success bool, bytesSent, bytesReceived int64) {
	if success {
		atomic.AddInt64(&c.successfulRequests, 1)
	} else {
		atomic.AddInt64(&c.failedRequests, 1)
	}
	atomic.AddInt64(&c.totalRequests, 1)
	atomic.AddInt64(&c.bytesSent, bytesSent)
	atomic.AddInt64(&c.bytesReceived, bytesReceived)
	atomic.AddInt64(&c.requestsLastSecond, 1)
	
	// Record response time in histogram
	c.mu.Lock()
	c.responseTimeHist.RecordValue(durationMs)
	c.mu.Unlock()
}

// SetActiveVUs sets the current active VU count
func (c *Collector) SetActiveVUs(count int32) {
	atomic.StoreInt32(&c.activeVUs, count)
	
	// Track peak
	for {
		current := atomic.LoadInt32(&c.peakVUs)
		if count <= current {
			break
		}
		if atomic.CompareAndSwapInt32(&c.peakVUs, current, count) {
			break
		}
	}
}

// GetSnapshot returns a point-in-time snapshot of all metrics
func (c *Collector) GetSnapshot() *Snapshot {
	now := time.Now()
	elapsed := now.Sub(c.startTime)
	elapsedSeconds := elapsed.Seconds()
	
	// Get histogram values under lock
	c.mu.RLock()
	hist := c.responseTimeHist
	min := float64(hist.Min())
	max := float64(hist.Max())
	mean := hist.Mean()
	p50 := float64(hist.ValueAtQuantile(50))
	p75 := float64(hist.ValueAtQuantile(75))
	p90 := float64(hist.ValueAtQuantile(90))
	p95 := float64(hist.ValueAtQuantile(95))
	p99 := float64(hist.ValueAtQuantile(99))
	c.mu.RUnlock()
	
	// Load atomic counters
	total := atomic.LoadInt64(&c.totalRequests)
	successful := atomic.LoadInt64(&c.successfulRequests)
	failed := atomic.LoadInt64(&c.failedRequests)
	bytesSent := atomic.LoadInt64(&c.bytesSent)
	bytesReceived := atomic.LoadInt64(&c.bytesReceived)
	activeVUs := atomic.LoadInt32(&c.activeVUs)
	peakVUs := atomic.LoadInt32(&c.peakVUs)
	
	// Calculate RPS
	var rps float64
	if elapsedSeconds > 0 {
		rps = float64(total) / elapsedSeconds
	}
	
	// Error rate
	var errorRate float64
	if total > 0 {
		errorRate = float64(failed) / float64(total)
	}
	
	// Host metrics
	cpuPercent, memPercent, openConns := c.getHostMetrics()
	
	// Go runtime metrics
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	return &Snapshot{
		Timestamp:          now,
		ElapsedMillis:      elapsed.Milliseconds(),
		ActiveVUs:          activeVUs,
		PeakVUs:            peakVUs,
		TotalRequests:      total,
		SuccessfulRequests: successful,
		FailedRequests:     failed,
		ErrorRate:          errorRate,
		RequestsPerSecond:  rps,
		BytesSent:          bytesSent,
		BytesReceived:      bytesReceived,
		ResponseTimeMin:    min,
		ResponseTimeMax:    max,
		ResponseTimeAvg:    mean,
		ResponseTimeP50:    p50,
		ResponseTimeP75:    p75,
		ResponseTimeP90:    p90,
		ResponseTimeP95:    p95,
		ResponseTimeP99:    p99,
		HostCPUPercent:     cpuPercent,
		HostMemoryPercent:  memPercent,
		HostOpenConns:      openConns,
		GoGoroutines:       int64(runtime.NumGoroutine()),
		GoHeapBytes:        int64(memStats.HeapAlloc),
	}
}

// GetSummary returns the final test summary
func (c *Collector) GetSummary() *Summary {
	elapsed := time.Since(c.startTime)
	elapsedSeconds := int32(elapsed.Seconds())
	
	c.mu.RLock()
	hist := c.responseTimeHist
	mean := hist.Mean()
	p50 := float64(hist.ValueAtQuantile(50))
	p95 := float64(hist.ValueAtQuantile(95))
	p99 := float64(hist.ValueAtQuantile(99))
	min := float64(hist.Min())
	max := float64(hist.Max())
	c.mu.RUnlock()
	
	total := atomic.LoadInt64(&c.totalRequests)
	successful := atomic.LoadInt64(&c.successfulRequests)
	failed := atomic.LoadInt64(&c.failedRequests)
	
	var errorRate float64
	if total > 0 {
		errorRate = float64(failed) / float64(total)
	}
	
	var rps float64
	if elapsedSeconds > 0 {
		rps = float64(total) / float64(elapsedSeconds)
	}
	
	return &Summary{
		DurationSeconds:    elapsedSeconds,
		PeakVUs:            atomic.LoadInt32(&c.peakVUs),
		TotalRequests:      total,
		SuccessfulRequests: successful,
		FailedRequests:     failed,
		ErrorRate:          errorRate,
		AvgResponseTime:    mean,
		P50ResponseTime:    p50,
		P95ResponseTime:    p95,
		P99ResponseTime:    p99,
		MinResponseTime:    min,
		MaxResponseTime:    max,
		RequestsPerSecond:  rps,
		BytesSent:          atomic.LoadInt64(&c.bytesSent),
		BytesReceived:      atomic.LoadInt64(&c.bytesReceived),
	}
}

// Reset resets all metrics
func (c *Collector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	atomic.StoreInt64(&c.totalRequests, 0)
	atomic.StoreInt64(&c.successfulRequests, 0)
	atomic.StoreInt64(&c.failedRequests, 0)
	atomic.StoreInt64(&c.bytesSent, 0)
	atomic.StoreInt64(&c.bytesReceived, 0)
	atomic.StoreInt32(&c.activeVUs, 0)
	atomic.StoreInt32(&c.peakVUs, 0)
	
	c.responseTimeHist.Reset()
	c.startTime = time.Now()
	c.lastReset = time.Now()
}

// getHostMetrics gets CPU, memory, and connection counts
func (c *Collector) getHostMetrics() (cpuPercent, memPercent float64, openConns int64) {
	// CPU
	if cpus, err := cpu.Percent(0, false); err == nil && len(cpus) > 0 {
		cpuPercent = cpus[0]
	}
	
	// Memory
	if vmem, err := mem.VirtualMemory(); err == nil {
		memPercent = vmem.UsedPercent
	}
	
	// Network connections (approximate)
	if counters, err := net.IOCounters(false); err == nil && len(counters) > 0 {
		// This is a rough approximation
		openConns = int64(counters[0].PacketsSent - c.netBaseline.PacketsSent)
	}
	
	return
}

