export interface QualityGate {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    minSuccessRate: number;
    maxFailureRate: number;
    maxDuration: number;
    minTestCoverage: number;
    maxFlakyRate: number;
  };
  actions: {
    onPass: 'deploy' | 'notify' | 'continue';
    onFail: 'block' | 'notify' | 'warn';
    notifications: string[];
  };
  lastEvaluated?: Date;
  lastResult?: 'pass' | 'fail' | 'warning';
}

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  order: number;
  qualityGates: string[];
  dependencies: string[];
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  logs?: string[];
  artifacts?: string[];
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  projectId: string;
  orgId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  stages: PipelineStage[];
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  triggeredBy: string;
  triggeredAt: Date;
  commitHash?: string;
  branch?: string;
  environment: string;
}

export interface QualityGateResult {
  gateId: string;
  gateName: string;
  status: 'pass' | 'fail' | 'warning';
  evaluatedAt: Date;
  metrics: {
    successRate: number;
    failureRate: number;
    duration: number;
    testCoverage: number;
    flakyRate: number;
  };
  details: {
    condition: string;
    actual: number;
    expected: number;
    passed: boolean;
  }[];
  recommendations?: string[];
}

export class CICDService {
  private pipelines: Map<string, Pipeline> = new Map();
  private qualityGates: Map<string, QualityGate> = new Map();
  private gateResults: Map<string, QualityGateResult[]> = new Map();

  constructor() {
    this.initializeDefaultQualityGates();
  }

  private initializeDefaultQualityGates() {
    const defaultGates: QualityGate[] = [
      {
        id: 'test-success-rate',
        name: 'Test Success Rate',
        description: 'Ensure minimum test success rate',
        enabled: true,
        conditions: {
          minSuccessRate: 90,
          maxFailureRate: 10,
          maxDuration: 300000, // 5 minutes
          minTestCoverage: 80,
          maxFlakyRate: 5
        },
        actions: {
          onPass: 'continue',
          onFail: 'block',
          notifications: ['team@company.com']
        },
        lastResult: 'pass'
      },
      {
        id: 'performance-gate',
        name: 'Performance Gate',
        description: 'Ensure tests complete within acceptable time',
        enabled: true,
        conditions: {
          minSuccessRate: 85,
          maxFailureRate: 15,
          maxDuration: 600000, // 10 minutes
          minTestCoverage: 70,
          maxFlakyRate: 10
        },
        actions: {
          onPass: 'continue',
          onFail: 'warn',
          notifications: ['performance@company.com']
        },
        lastResult: 'pass'
      },
      {
        id: 'coverage-gate',
        name: 'Coverage Gate',
        description: 'Ensure minimum test coverage',
        enabled: true,
        conditions: {
          minSuccessRate: 80,
          maxFailureRate: 20,
          maxDuration: 900000, // 15 minutes
          minTestCoverage: 90,
          maxFlakyRate: 15
        },
        actions: {
          onPass: 'continue',
          onFail: 'block',
          notifications: ['coverage@company.com']
        },
        lastResult: 'pass'
      }
    ];

    defaultGates.forEach(gate => {
      this.qualityGates.set(gate.id, gate);
    });
  }

  async createPipeline(pipeline: Omit<Pipeline, 'id' | 'status' | 'stages' | 'triggeredAt'>): Promise<string> {
    const id = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const triggeredAt = new Date();
    
    const newPipeline: Pipeline = {
      ...pipeline,
      id,
      status: 'pending',
      stages: [],
      triggeredAt
    };

    this.pipelines.set(id, newPipeline);
    return id;
  }

  async executePipeline(pipelineId: string): Promise<Pipeline> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    pipeline.status = 'running';
    pipeline.startTime = new Date();

    try {
      // Execute stages sequentially
      for (const stage of pipeline.stages) {
        await this.executeStage(pipelineId, stage.id);
      }

      pipeline.status = 'passed';
      pipeline.endTime = new Date();
      pipeline.duration = pipeline.endTime.getTime() - pipeline.startTime.getTime();
    } catch (error) {
      pipeline.status = 'failed';
      pipeline.endTime = new Date();
      pipeline.duration = pipeline.endTime.getTime() - pipeline.startTime.getTime();
      throw error;
    }

    return pipeline;
  }

  private async executeStage(pipelineId: string, stageId: string): Promise<void> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return;

    const stage = pipeline.stages.find(s => s.id === stageId);
    if (!stage) return;

    stage.status = 'running';
    stage.startTime = new Date();

    try {
      // Execute quality gates for this stage
      for (const gateId of stage.qualityGates) {
        const result = await this.evaluateQualityGate(gateId, pipelineId);
        this.recordQualityGateResult(gateId, result);
        
        if (result.status === 'fail') {
          throw new Error(`Quality gate ${gateId} failed`);
        }
      }

      stage.status = 'passed';
      stage.endTime = new Date();
      stage.duration = stage.endTime.getTime() - stage.startTime.getTime();
    } catch (error) {
      stage.status = 'failed';
      stage.endTime = new Date();
      stage.duration = stage.endTime.getTime() - stage.startTime.getTime();
      throw error;
    }
  }

  async evaluateQualityGate(gateId: string, pipelineId: string): Promise<QualityGateResult> {
    const gate = this.qualityGates.get(gateId);
    if (!gate) {
      throw new Error(`Quality gate ${gateId} not found`);
    }

    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    // Simulate metrics calculation
    const metrics = {
      successRate: Math.random() * 100,
      failureRate: Math.random() * 20,
      duration: Math.random() * 600000, // 0-10 minutes
      testCoverage: Math.random() * 100,
      flakyRate: Math.random() * 20
    };

    const details = [
      {
        condition: 'Success Rate',
        actual: metrics.successRate,
        expected: gate.conditions.minSuccessRate,
        passed: metrics.successRate >= gate.conditions.minSuccessRate
      },
      {
        condition: 'Failure Rate',
        actual: metrics.failureRate,
        expected: gate.conditions.maxFailureRate,
        passed: metrics.failureRate <= gate.conditions.maxFailureRate
      },
      {
        condition: 'Duration',
        actual: metrics.duration,
        expected: gate.conditions.maxDuration,
        passed: metrics.duration <= gate.conditions.maxDuration
      },
      {
        condition: 'Test Coverage',
        actual: metrics.testCoverage,
        expected: gate.conditions.minTestCoverage,
        passed: metrics.testCoverage >= gate.conditions.minTestCoverage
      },
      {
        condition: 'Flaky Rate',
        actual: metrics.flakyRate,
        expected: gate.conditions.maxFlakyRate,
        passed: metrics.flakyRate <= gate.conditions.maxFlakyRate
      }
    ];

    const allPassed = details.every(d => d.passed);
    const somePassed = details.some(d => d.passed);

    let status: 'pass' | 'fail' | 'warning';
    if (allPassed) {
      status = 'pass';
    } else if (somePassed) {
      status = 'warning';
    } else {
      status = 'fail';
    }

    const result: QualityGateResult = {
      gateId,
      gateName: gate.name,
      status,
      evaluatedAt: new Date(),
      metrics,
      details,
      recommendations: this.generateRecommendations(details)
    };

    // Update gate status
    gate.lastEvaluated = new Date();
    gate.lastResult = status;

    return result;
  }

  private generateRecommendations(details: any[]): string[] {
    const recommendations: string[] = [];
    
    details.forEach(detail => {
      if (!detail.passed) {
        switch (detail.condition) {
          case 'Success Rate':
            recommendations.push('Review failing tests and fix issues');
            break;
          case 'Failure Rate':
            recommendations.push('Investigate and fix test failures');
            break;
          case 'Duration':
            recommendations.push('Optimize test execution time');
            break;
          case 'Test Coverage':
            recommendations.push('Add more test cases to improve coverage');
            break;
          case 'Flaky Rate':
            recommendations.push('Investigate and fix flaky tests');
            break;
        }
      }
    });

    return recommendations;
  }

  private recordQualityGateResult(gateId: string, result: QualityGateResult): void {
    if (!this.gateResults.has(gateId)) {
      this.gateResults.set(gateId, []);
    }
    
    const results = this.gateResults.get(gateId)!;
    results.push(result);
    
    // Keep only last 100 results
    if (results.length > 100) {
      results.shift();
    }
  }

  getPipeline(pipelineId: string): Pipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  getAllPipelines(): Pipeline[] {
    return Array.from(this.pipelines.values());
  }

  getPipelinesByProject(projectId: string): Pipeline[] {
    return this.getAllPipelines().filter(p => p.projectId === projectId);
  }

  getQualityGates(): QualityGate[] {
    return Array.from(this.qualityGates.values());
  }

  getQualityGateResults(gateId: string): QualityGateResult[] {
    return this.gateResults.get(gateId) || [];
  }

  updateQualityGate(gateId: string, updates: Partial<QualityGate>): boolean {
    const gate = this.qualityGates.get(gateId);
    if (!gate) return false;

    Object.assign(gate, updates);
    return true;
  }

  createQualityGate(gate: Omit<QualityGate, 'id' | 'lastEvaluated' | 'lastResult'>): string {
    const id = `gate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newGate: QualityGate = {
      ...gate,
      id,
      lastResult: 'pass'
    };
    
    this.qualityGates.set(id, newGate);
    return id;
  }

  deleteQualityGate(gateId: string): boolean {
    return this.qualityGates.delete(gateId);
  }

  async triggerPipeline(projectId: string, environment: string, triggeredBy: string): Promise<string> {
    const pipeline = await this.createPipeline({
      name: `Pipeline ${new Date().toLocaleString()}`,
      description: `Automated pipeline for ${environment}`,
      projectId,
      orgId: "550e8400-e29b-41d4-a716-446655440000", // Mock org ID
      triggeredBy,
      environment,
      branch: 'main',
      commitHash: 'abc123def456'
    });

    // Add default stages
    const stages: PipelineStage[] = [
      {
        id: 'build',
        name: 'Build',
        description: 'Build and prepare application',
        order: 1,
        qualityGates: ['test-success-rate'],
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'test',
        name: 'Test',
        description: 'Run test suite',
        order: 2,
        qualityGates: ['test-success-rate', 'performance-gate'],
        dependencies: ['build'],
        status: 'pending'
      },
      {
        id: 'deploy',
        name: 'Deploy',
        description: 'Deploy to environment',
        order: 3,
        qualityGates: ['coverage-gate'],
        dependencies: ['test'],
        status: 'pending'
      }
    ];

    pipeline.stages = stages;
    this.pipelines.set(pipeline.id, pipeline);

    return pipeline.id;
  }
}

export const cicdService = new CICDService();


