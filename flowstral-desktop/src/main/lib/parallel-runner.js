/**
 * Parallel Test Runner
 * 
 * Executes multiple tests simultaneously using browser contexts.
 * 
 * USAGE:
 * 1. In Settings > General > Parallel Execution, enable parallel mode
 * 2. Set number of workers (1-8, default 4)
 * 3. Run a test suite - tests will execute in parallel
 * 
 * ARCHITECTURE:
 * - Creates N browser contexts (workers)
 * - Each worker executes one test at a time
 * - Tests are distributed round-robin to available workers
 * - Results are aggregated in real-time
 * 
 * LIMITATIONS:
 * - Tests that share state (cookies, localStorage) may conflict
 * - Use isolated browser contexts for true parallel execution
 * - Consider test dependencies when running in parallel
 */

const { EventEmitter } = require('events');

class ParallelTestRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxWorkers = options.maxWorkers || 4;
    this.browser = options.browser || null;
    this.workers = [];
    this.queue = [];
    this.results = [];
    this.running = false;
    this.startTime = null;
    
    // Statistics
    this.stats = {
      total: 0,
      completed: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Initialize workers (browser contexts)
  // ─────────────────────────────────────────────────────────────────────────
  
  async initialize(browser) {
    this.browser = browser;
    console.log(`[ParallelRunner] Initializing ${this.maxWorkers} workers`);
    
    for (let i = 0; i < this.maxWorkers; i++) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: false,
      });
      
      const page = await context.newPage();
      
      this.workers.push({
        id: i,
        context,
        page,
        busy: false,
        currentTest: null,
      });
      
      console.log(`[ParallelRunner] Worker ${i} ready`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Add tests to queue
  // ─────────────────────────────────────────────────────────────────────────
  
  addTests(tests) {
    if (!Array.isArray(tests)) {
      tests = [tests];
    }
    
    this.queue.push(...tests);
    this.stats.total += tests.length;
    
    console.log(`[ParallelRunner] Added ${tests.length} tests to queue. Total: ${this.queue.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Find an available worker
  // ─────────────────────────────────────────────────────────────────────────
  
  getAvailableWorker() {
    return this.workers.find(w => !w.busy);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Execute a single test on a worker
  // ─────────────────────────────────────────────────────────────────────────
  
  async executeTestOnWorker(worker, test, testExecutor) {
    worker.busy = true;
    worker.currentTest = test;
    
    const startTime = Date.now();
    
    this.emit('test:start', {
      workerId: worker.id,
      testId: test.id,
      testName: test.name,
    });
    
    console.log(`[ParallelRunner] Worker ${worker.id} executing: ${test.name}`);
    
    try {
      // Create a test executor instance for this worker
      const result = await testExecutor.executeTest({
        ...test,
        page: worker.page, // Use worker's page
      });
      
      const duration = Date.now() - startTime;
      
      const testResult = {
        testId: test.id,
        testName: test.name,
        workerId: worker.id,
        status: result.status,
        steps: result.steps,
        duration,
        error: result.error,
        startTime: new Date(startTime).toISOString(),
      };
      
      this.results.push(testResult);
      
      // Update stats
      this.stats.completed++;
      if (result.status === 'passed') this.stats.passed++;
      else if (result.status === 'failed') this.stats.failed++;
      else this.stats.skipped++;
      
      this.emit('test:complete', testResult);
      
      console.log(`[ParallelRunner] Worker ${worker.id} finished: ${test.name} - ${result.status} (${duration}ms)`);
      
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const testResult = {
        testId: test.id,
        testName: test.name,
        workerId: worker.id,
        status: 'error',
        error: error.message,
        duration,
        startTime: new Date(startTime).toISOString(),
      };
      
      this.results.push(testResult);
      this.stats.completed++;
      this.stats.failed++;
      
      this.emit('test:error', testResult);
      
      console.error(`[ParallelRunner] Worker ${worker.id} error: ${test.name} - ${error.message}`);
      
      return testResult;
    } finally {
      worker.busy = false;
      worker.currentTest = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Run all tests in parallel
  // ─────────────────────────────────────────────────────────────────────────
  
  async runAll(testExecutor) {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize(browser) first.');
    }
    
    this.running = true;
    this.startTime = Date.now();
    this.results = [];
    this.stats = {
      total: this.queue.length,
      completed: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };
    
    console.log(`[ParallelRunner] Starting parallel execution of ${this.queue.length} tests with ${this.maxWorkers} workers`);
    
    this.emit('run:start', {
      totalTests: this.queue.length,
      workers: this.maxWorkers,
    });
    
    const runningTasks = [];
    
    while (this.queue.length > 0 || runningTasks.length > 0) {
      // Check if we should stop
      if (!this.running) {
        console.log('[ParallelRunner] Run stopped by user');
        break;
      }
      
      // Start new tasks if workers are available
      while (this.queue.length > 0) {
        const worker = this.getAvailableWorker();
        if (!worker) break;
        
        const test = this.queue.shift();
        const task = this.executeTestOnWorker(worker, test, testExecutor);
        runningTasks.push(task);
        
        // Emit progress
        this.emit('run:progress', {
          completed: this.stats.completed,
          total: this.stats.total,
          running: runningTasks.length,
          queued: this.queue.length,
        });
      }
      
      // Wait for at least one task to complete
      if (runningTasks.length > 0) {
        await Promise.race(runningTasks);
        
        // Remove completed tasks
        for (let i = runningTasks.length - 1; i >= 0; i--) {
          // Check if the promise is settled
          const worker = this.workers.find(w => w.id === i);
          if (worker && !worker.busy) {
            runningTasks.splice(i, 1);
          }
        }
        
        // Small delay to prevent tight loop
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    // Wait for all remaining tasks
    await Promise.all(runningTasks);
    
    const totalDuration = Date.now() - this.startTime;
    
    const summary = {
      totalTests: this.stats.total,
      passed: this.stats.passed,
      failed: this.stats.failed,
      skipped: this.stats.skipped,
      duration: totalDuration,
      workers: this.maxWorkers,
      results: this.results,
    };
    
    this.emit('run:complete', summary);
    
    console.log(`[ParallelRunner] Execution complete:`);
    console.log(`  - Total: ${this.stats.total}`);
    console.log(`  - Passed: ${this.stats.passed}`);
    console.log(`  - Failed: ${this.stats.failed}`);
    console.log(`  - Duration: ${totalDuration}ms`);
    
    this.running = false;
    return summary;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stop execution
  // ─────────────────────────────────────────────────────────────────────────
  
  stop() {
    console.log('[ParallelRunner] Stopping execution...');
    this.running = false;
    this.emit('run:stop', { reason: 'User requested stop' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get current status
  // ─────────────────────────────────────────────────────────────────────────
  
  getStatus() {
    return {
      running: this.running,
      workers: this.workers.map(w => ({
        id: w.id,
        busy: w.busy,
        currentTest: w.currentTest?.name || null,
      })),
      queue: this.queue.length,
      stats: { ...this.stats },
      elapsed: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────
  
  async cleanup() {
    console.log('[ParallelRunner] Cleaning up workers...');
    
    for (const worker of this.workers) {
      try {
        await worker.page.close();
        await worker.context.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    this.workers = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

function createParallelRunner(options = {}) {
  return new ParallelTestRunner(options);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  ParallelTestRunner,
  createParallelRunner,
};
