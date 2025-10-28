export interface TelemetryEvent {
  id: string;
  timestamp: Date;
  eventType: 'test_execution' | 'ai_generation' | 'ai_triage' | 'jira_integration' | 'self_healing';
  orgId: string;
  projectId: string;
  userId: string;
  metadata: {
    duration?: number;
    cost?: number;
    tokens?: number;
    success?: boolean;
    error?: string;
    [key: string]: any;
  };
}

export interface UsageMetrics {
  totalEvents: number;
  totalCost: number;
  totalTokens: number;
  totalDuration: number;
  eventsByType: Record<string, number>;
  costByType: Record<string, number>;
  tokensByType: Record<string, number>;
  durationByType: Record<string, number>;
  successRate: number;
  errorRate: number;
}

export interface CostBreakdown {
  aiGeneration: number;
  aiTriage: number;
  testExecution: number;
  jiraIntegration: number;
  selfHealing: number;
  total: number;
}

export interface UsageTrend {
  date: string;
  events: number;
  cost: number;
  tokens: number;
  duration: number;
}

export class TelemetryService {
  private events: Map<string, TelemetryEvent> = new Map();
  private costRates: Map<string, number> = new Map();

  constructor() {
    this.initializeCostRates();
  }

  private initializeCostRates() {
    // Cost rates per operation (in USD)
    this.costRates.set('ai_generation', 0.01); // $0.01 per test case generation
    this.costRates.set('ai_triage', 0.005); // $0.005 per triage analysis
    this.costRates.set('test_execution', 0.001); // $0.001 per test execution
    this.costRates.set('jira_integration', 0.002); // $0.002 per Jira operation
    this.costRates.set('self_healing', 0.003); // $0.003 per healing action
  }

  async trackEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): Promise<string> {
    const id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    
    const telemetryEvent: TelemetryEvent = {
      ...event,
      id,
      timestamp
    };

    // Calculate cost if not provided
    if (!telemetryEvent.metadata.cost) {
      telemetryEvent.metadata.cost = this.calculateCost(telemetryEvent);
    }

    // Calculate tokens if not provided
    if (!telemetryEvent.metadata.tokens) {
      telemetryEvent.metadata.tokens = this.estimateTokens(telemetryEvent);
    }

    this.events.set(id, telemetryEvent);
    
    // In a real implementation, this would:
    // 1. Send to external telemetry service
    // 2. Store in database
    // 3. Trigger alerts for high usage
    // 4. Update billing
    
    console.log('Telemetry event tracked:', telemetryEvent);
    return id;
  }

  private calculateCost(event: TelemetryEvent): number {
    const baseRate = this.costRates.get(event.eventType) || 0;
    let cost = baseRate;

    // Adjust cost based on metadata
    if (event.metadata.duration) {
      cost *= (event.metadata.duration / 1000); // Scale by duration in seconds
    }

    if (event.metadata.tokens) {
      cost *= (event.metadata.tokens / 1000); // Scale by token count
    }

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }

  private estimateTokens(event: TelemetryEvent): number {
    // Estimate token usage based on event type and metadata
    switch (event.eventType) {
      case 'ai_generation':
        return 500; // Average tokens for test case generation
      case 'ai_triage':
        return 300; // Average tokens for triage analysis
      case 'test_execution':
        return 100; // Average tokens for test execution logs
      case 'jira_integration':
        return 200; // Average tokens for Jira operations
      case 'self_healing':
        return 150; // Average tokens for healing actions
      default:
        return 100;
    }
  }

  async getUsageMetrics(orgId: string, startDate?: Date, endDate?: Date): Promise<UsageMetrics> {
    const events = this.getEventsByOrg(orgId, startDate, endDate);
    
    const metrics: UsageMetrics = {
      totalEvents: events.length,
      totalCost: 0,
      totalTokens: 0,
      totalDuration: 0,
      eventsByType: {},
      costByType: {},
      tokensByType: {},
      durationByType: {},
      successRate: 0,
      errorRate: 0
    };

    if (events.length === 0) return metrics;

    let successfulEvents = 0;
    let errorEvents = 0;

    events.forEach(event => {
      // Count events by type
      metrics.eventsByType[event.eventType] = (metrics.eventsByType[event.eventType] || 0) + 1;
      
      // Sum costs by type
      metrics.costByType[event.eventType] = (metrics.costByType[event.eventType] || 0) + (event.metadata.cost || 0);
      
      // Sum tokens by type
      metrics.tokensByType[event.eventType] = (metrics.tokensByType[event.eventType] || 0) + (event.metadata.tokens || 0);
      
      // Sum duration by type
      metrics.durationByType[event.eventType] = (metrics.durationByType[event.eventType] || 0) + (event.metadata.duration || 0);
      
      // Total metrics
      metrics.totalCost += event.metadata.cost || 0;
      metrics.totalTokens += event.metadata.tokens || 0;
      metrics.totalDuration += event.metadata.duration || 0;
      
      // Success/error rates
      if (event.metadata.success === true) {
        successfulEvents++;
      } else if (event.metadata.success === false || event.metadata.error) {
        errorEvents++;
      }
    });

    metrics.successRate = events.length > 0 ? (successfulEvents / events.length) * 100 : 0;
    metrics.errorRate = events.length > 0 ? (errorEvents / events.length) * 100 : 0;

    return metrics;
  }

  async getCostBreakdown(orgId: string, startDate?: Date, endDate?: Date): Promise<CostBreakdown> {
    const events = this.getEventsByOrg(orgId, startDate, endDate);
    
    const breakdown: CostBreakdown = {
      aiGeneration: 0,
      aiTriage: 0,
      testExecution: 0,
      jiraIntegration: 0,
      selfHealing: 0,
      total: 0
    };

    events.forEach(event => {
      const cost = event.metadata.cost || 0;
      breakdown.total += cost;
      
      switch (event.eventType) {
        case 'ai_generation':
          breakdown.aiGeneration += cost;
          break;
        case 'ai_triage':
          breakdown.aiTriage += cost;
          break;
        case 'test_execution':
          breakdown.testExecution += cost;
          break;
        case 'jira_integration':
          breakdown.jiraIntegration += cost;
          break;
        case 'self_healing':
          breakdown.selfHealing += cost;
          break;
      }
    });

    return breakdown;
  }

  async getUsageTrends(orgId: string, days: number = 30): Promise<UsageTrend[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    const events = this.getEventsByOrg(orgId, startDate, endDate);
    const trends: Map<string, UsageTrend> = new Map();

    events.forEach(event => {
      const dateKey = event.timestamp.toISOString().split('T')[0];
      
      if (!trends.has(dateKey)) {
        trends.set(dateKey, {
          date: dateKey,
          events: 0,
          cost: 0,
          tokens: 0,
          duration: 0
        });
      }
      
      const trend = trends.get(dateKey)!;
      trend.events++;
      trend.cost += event.metadata.cost || 0;
      trend.tokens += event.metadata.tokens || 0;
      trend.duration += event.metadata.duration || 0;
    });

    return Array.from(trends.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getProjectUsageMetrics(projectId: string, startDate?: Date, endDate?: Date): Promise<UsageMetrics> {
    const events = this.getEventsByProject(projectId, startDate, endDate);
    
    const metrics: UsageMetrics = {
      totalEvents: events.length,
      totalCost: 0,
      totalTokens: 0,
      totalDuration: 0,
      eventsByType: {},
      costByType: {},
      tokensByType: {},
      durationByType: {},
      successRate: 0,
      errorRate: 0
    };

    if (events.length === 0) return metrics;

    let successfulEvents = 0;
    let errorEvents = 0;

    events.forEach(event => {
      metrics.eventsByType[event.eventType] = (metrics.eventsByType[event.eventType] || 0) + 1;
      metrics.costByType[event.eventType] = (metrics.costByType[event.eventType] || 0) + (event.metadata.cost || 0);
      metrics.tokensByType[event.eventType] = (metrics.tokensByType[event.eventType] || 0) + (event.metadata.tokens || 0);
      metrics.durationByType[event.eventType] = (metrics.durationByType[event.eventType] || 0) + (event.metadata.duration || 0);
      
      metrics.totalCost += event.metadata.cost || 0;
      metrics.totalTokens += event.metadata.tokens || 0;
      metrics.totalDuration += event.metadata.duration || 0;
      
      if (event.metadata.success === true) {
        successfulEvents++;
      } else if (event.metadata.success === false || event.metadata.error) {
        errorEvents++;
      }
    });

    metrics.successRate = events.length > 0 ? (successfulEvents / events.length) * 100 : 0;
    metrics.errorRate = events.length > 0 ? (errorEvents / events.length) * 100 : 0;

    return metrics;
  }

  private getEventsByOrg(orgId: string, startDate?: Date, endDate?: Date): TelemetryEvent[] {
    return Array.from(this.events.values()).filter(event => {
      if (event.orgId !== orgId) return false;
      if (startDate && event.timestamp < startDate) return false;
      if (endDate && event.timestamp > endDate) return false;
      return true;
    });
  }

  private getEventsByProject(projectId: string, startDate?: Date, endDate?: Date): TelemetryEvent[] {
    return Array.from(this.events.values()).filter(event => {
      if (event.projectId !== projectId) return false;
      if (startDate && event.timestamp < startDate) return false;
      if (endDate && event.timestamp > endDate) return false;
      return true;
    });
  }

  async getTopUsers(orgId: string, limit: number = 10): Promise<Array<{ userId: string; events: number; cost: number }>> {
    const events = this.getEventsByOrg(orgId);
    const userStats = new Map<string, { events: number; cost: number }>();

    events.forEach(event => {
      if (!userStats.has(event.userId)) {
        userStats.set(event.userId, { events: 0, cost: 0 });
      }
      const stats = userStats.get(event.userId)!;
      stats.events++;
      stats.cost += event.metadata.cost || 0;
    });

    return Array.from(userStats.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.events - a.events)
      .slice(0, limit);
  }

  async getTopProjects(orgId: string, limit: number = 10): Promise<Array<{ projectId: string; events: number; cost: number }>> {
    const events = this.getEventsByOrg(orgId);
    const projectStats = new Map<string, { events: number; cost: number }>();

    events.forEach(event => {
      if (!projectStats.has(event.projectId)) {
        projectStats.set(event.projectId, { events: 0, cost: 0 });
      }
      const stats = projectStats.get(event.projectId)!;
      stats.events++;
      stats.cost += event.metadata.cost || 0;
    });

    return Array.from(projectStats.entries())
      .map(([projectId, stats]) => ({ projectId, ...stats }))
      .sort((a, b) => b.events - a.events)
      .slice(0, limit);
  }
}

export const telemetryService = new TelemetryService();
