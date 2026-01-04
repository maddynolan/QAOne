// Package main is the entry point for the ArisTrace Go Runner
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/aristrace/runner/internal/executor"
	"github.com/aristrace/runner/internal/metrics"
	"github.com/aristrace/runner/internal/scheduler"
	"github.com/aristrace/runner/pkg/scenario"
)

var (
	grpcPort     = flag.Int("port", 50051, "gRPC server port")
	standalone   = flag.Bool("standalone", false, "Run in standalone mode (single scenario)")
	scenarioFile = flag.String("scenario", "", "Scenario file path (standalone mode)")
	maxVUs       = flag.Int("max-vus", 1000, "Maximum VUs this runner can handle")
	agentID      = flag.String("agent-id", "", "Agent ID for distributed mode")
)

func main() {
	flag.Parse()
	
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.Println("🚀 ArisTrace Go Runner starting...")
	
	// Handle standalone mode
	if *standalone {
		if *scenarioFile == "" {
			log.Fatal("--scenario required in standalone mode")
		}
		runStandalone(*scenarioFile)
		return
	}
	
	// Start gRPC server
	startGRPCServer(*grpcPort)
}

// runStandalone runs a scenario directly without gRPC
func runStandalone(scenarioPath string) {
	log.Printf("Running standalone scenario: %s", scenarioPath)
	
	// Load scenario
	sc, err := scenario.LoadFromFile(scenarioPath)
	if err != nil {
		log.Fatalf("Failed to load scenario: %v", err)
	}
	
	log.Printf("Loaded scenario: %s (VUs: %d, Duration: %ds)", 
		sc.Name, sc.Config.VirtualUsers, sc.Config.DurationSeconds)
	
	// Create components
	clientCfg := executor.DefaultClientConfig()
	clientCfg.EnableHTTP2 = sc.Config.EnableHTTP2
	clientCfg.ConnectionTimeout = time.Duration(sc.Config.ConnectionTimeout) * time.Millisecond
	clientCfg.RequestTimeout = time.Duration(sc.Config.RequestTimeout) * time.Millisecond
	
	httpClient := executor.NewHTTPClient(clientCfg)
	defer httpClient.Close()
	
	metricsCollector := metrics.NewCollector()
	vuPool := executor.NewVUPool(sc, httpClient, metricsCollector)
	
	sched := scheduler.NewScheduler(scheduler.Config{
		TargetVUs:    sc.Config.VirtualUsers,
		RampUpSecs:   sc.Config.RampUpSeconds,
		RampDownSecs: sc.Config.RampDownSeconds,
		DurationSecs: sc.Config.DurationSeconds,
		ThinkTimeMin: time.Duration(sc.Config.ThinkTimeMin) * time.Millisecond,
		ThinkTimeMax: time.Duration(sc.Config.ThinkTimeMax) * time.Millisecond,
	})
	
	// Set up VU scaling callback
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	sched.SetOnVUChange(func(newCount int) {
		if err := vuPool.ScaleVUs(ctx, newCount); err != nil {
			log.Printf("Failed to scale VUs: %v", err)
		}
		log.Printf("VUs: %d", newCount)
	})
	
	// Handle signals
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	
	// Start scheduler in goroutine
	go sched.Start(ctx)
	
	// Start metrics reporting
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				snapshot := metricsCollector.GetSnapshot()
				log.Printf("📊 VUs: %d | Reqs: %d | RPS: %.1f | Avg: %.1fms | P95: %.1fms | Errors: %d",
					snapshot.ActiveVUs,
					snapshot.TotalRequests,
					snapshot.RequestsPerSecond,
					snapshot.ResponseTimeAvg,
					snapshot.ResponseTimeP95,
					snapshot.FailedRequests,
				)
			}
		}
	}()
	
	// Wait for completion or signal
	select {
	case <-sigCh:
		log.Println("Received shutdown signal")
	case <-waitForScheduler(ctx, sched):
		log.Println("Test completed")
	}
	
	// Stop VUs
	cancel()
	vuPool.StopAll()
	
	// Print summary
	summary := metricsCollector.GetSummary()
	printSummary(summary)
}

// waitForScheduler waits for the scheduler to finish
func waitForScheduler(ctx context.Context, sched *scheduler.Scheduler) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		for {
			if sched.IsFinished() {
				close(done)
				return
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(100 * time.Millisecond):
			}
		}
	}()
	return done
}

// printSummary prints the test summary
func printSummary(summary *metrics.Summary) {
	fmt.Println()
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println("                     TEST SUMMARY")
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Printf("  Duration:         %d seconds\n", summary.DurationSeconds)
	fmt.Printf("  Peak VUs:         %d\n", summary.PeakVUs)
	fmt.Println("──────────────────────────────────────────────────────────────")
	fmt.Printf("  Total Requests:   %d\n", summary.TotalRequests)
	fmt.Printf("  Successful:       %d\n", summary.SuccessfulRequests)
	fmt.Printf("  Failed:           %d\n", summary.FailedRequests)
	fmt.Printf("  Error Rate:       %.2f%%\n", summary.ErrorRate*100)
	fmt.Println("──────────────────────────────────────────────────────────────")
	fmt.Printf("  RPS:              %.2f\n", summary.RequestsPerSecond)
	fmt.Printf("  Bytes Sent:       %d\n", summary.BytesSent)
	fmt.Printf("  Bytes Received:   %d\n", summary.BytesReceived)
	fmt.Println("──────────────────────────────────────────────────────────────")
	fmt.Printf("  Response Times:\n")
	fmt.Printf("    Min:            %.2fms\n", summary.MinResponseTime)
	fmt.Printf("    Avg:            %.2fms\n", summary.AvgResponseTime)
	fmt.Printf("    P50:            %.2fms\n", summary.P50ResponseTime)
	fmt.Printf("    P95:            %.2fms\n", summary.P95ResponseTime)
	fmt.Printf("    P99:            %.2fms\n", summary.P99ResponseTime)
	fmt.Printf("    Max:            %.2fms\n", summary.MaxResponseTime)
	fmt.Println("══════════════════════════════════════════════════════════════")
}

// startGRPCServer starts the gRPC server
func startGRPCServer(port int) {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}
	
	grpcServer := grpc.NewServer()
	
	// Register RunnerService
	runnerSvc := NewRunnerService(*maxVUs, *agentID)
	RegisterRunnerService(grpcServer, runnerSvc)
	
	// Enable reflection for debugging
	reflection.Register(grpcServer)
	
	// Handle signals
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	
	go func() {
		<-sigCh
		log.Println("Shutting down gRPC server...")
		grpcServer.GracefulStop()
	}()
	
	log.Printf("🔌 gRPC server listening on :%d (max VUs: %d)", port, *maxVUs)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}

// RunnerService implements the gRPC RunnerService
type RunnerService struct {
	maxVUs     int
	agentID    string
	
	// Active runs
	runs map[string]*RunInstance
}

// RunInstance represents an active test run
type RunInstance struct {
	ID             string
	Scenario       *scenario.CompiledScenario
	HTTPClient     *executor.HTTPClient
	VUPool         *executor.VUPool
	Metrics        *metrics.Collector
	Scheduler      *scheduler.Scheduler
	Cancel         context.CancelFunc
	Context        context.Context
}

// NewRunnerService creates a new runner service
func NewRunnerService(maxVUs int, agentID string) *RunnerService {
	if agentID == "" {
		hostname, _ := os.Hostname()
		agentID = fmt.Sprintf("runner-%s-%d", hostname, os.Getpid())
	}
	
	return &RunnerService{
		maxVUs:  maxVUs,
		agentID: agentID,
		runs:    make(map[string]*RunInstance),
	}
}

// RegisterRunnerService registers the service with gRPC server
// This is a placeholder - actual proto implementation would go here
func RegisterRunnerService(s *grpc.Server, svc *RunnerService) {
	// In production, this would register the proto-generated service
	// For now, we're creating the structure
	log.Printf("Registered RunnerService (agent: %s)", svc.agentID)
}

// StartRun starts a new load test run
func (s *RunnerService) StartRun(runID string, scenarioBytes []byte, config *RunConfig) error {
	// Load scenario
	sc, err := scenario.LoadFromBytes(scenarioBytes)
	if err != nil {
		return fmt.Errorf("failed to parse scenario: %w", err)
	}
	
	// Apply config overrides
	if config != nil {
		if config.VirtualUsers > 0 {
			sc.Config.VirtualUsers = config.VirtualUsers
		}
		if config.DurationSeconds > 0 {
			sc.Config.DurationSeconds = config.DurationSeconds
		}
		if config.RampUpSeconds > 0 {
			sc.Config.RampUpSeconds = config.RampUpSeconds
		}
		if config.TargetURL != "" {
			sc.Config.TargetURL = config.TargetURL
		}
	}
	
	// Check capacity
	if sc.Config.VirtualUsers > s.maxVUs {
		return fmt.Errorf("requested VUs (%d) exceeds capacity (%d)", 
			sc.Config.VirtualUsers, s.maxVUs)
	}
	
	// Create components
	clientCfg := executor.DefaultClientConfig()
	clientCfg.EnableHTTP2 = sc.Config.EnableHTTP2
	
	httpClient := executor.NewHTTPClient(clientCfg)
	metricsCollector := metrics.NewCollector()
	vuPool := executor.NewVUPool(sc, httpClient, metricsCollector)
	
	sched := scheduler.NewScheduler(scheduler.Config{
		TargetVUs:    sc.Config.VirtualUsers,
		RampUpSecs:   sc.Config.RampUpSeconds,
		RampDownSecs: sc.Config.RampDownSeconds,
		DurationSecs: sc.Config.DurationSeconds,
		ThinkTimeMin: time.Duration(sc.Config.ThinkTimeMin) * time.Millisecond,
		ThinkTimeMax: time.Duration(sc.Config.ThinkTimeMax) * time.Millisecond,
	})
	
	ctx, cancel := context.WithCancel(context.Background())
	
	run := &RunInstance{
		ID:         runID,
		Scenario:   sc,
		HTTPClient: httpClient,
		VUPool:     vuPool,
		Metrics:    metricsCollector,
		Scheduler:  sched,
		Cancel:     cancel,
		Context:    ctx,
	}
	
	s.runs[runID] = run
	
	// Set up VU scaling
	sched.SetOnVUChange(func(newCount int) {
		vuPool.ScaleVUs(ctx, newCount)
	})
	
	// Start scheduler
	go sched.Start(ctx)
	
	// Auto-cleanup when finished
	go func() {
		for !sched.IsFinished() {
			time.Sleep(100 * time.Millisecond)
		}
		// Run completed normally
		log.Printf("Run %s completed", runID)
	}()
	
	log.Printf("Started run %s: %d VUs, %ds duration", runID, sc.Config.VirtualUsers, sc.Config.DurationSeconds)
	
	return nil
}

// StopRun stops a running test
func (s *RunnerService) StopRun(runID string, graceful bool) (*metrics.Summary, error) {
	run, ok := s.runs[runID]
	if !ok {
		return nil, fmt.Errorf("run not found: %s", runID)
	}
	
	// Cancel context to stop VUs
	run.Cancel()
	run.VUPool.StopAll()
	run.HTTPClient.Close()
	
	summary := run.Metrics.GetSummary()
	
	delete(s.runs, runID)
	
	return summary, nil
}

// GetMetrics returns current metrics for a run
func (s *RunnerService) GetMetrics(runID string) (*metrics.Snapshot, error) {
	run, ok := s.runs[runID]
	if !ok {
		return nil, fmt.Errorf("run not found: %s", runID)
	}
	
	return run.Metrics.GetSnapshot(), nil
}

// RunConfig is the run configuration (from proto)
type RunConfig struct {
	VirtualUsers    int
	DurationSeconds int
	RampUpSeconds   int
	RampDownSeconds int
	TargetURL       string
	EnableHTTP2     bool
}

