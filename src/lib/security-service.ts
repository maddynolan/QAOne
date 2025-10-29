export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'secrets' | 'permissions' | 'data' | 'network' | 'compliance';
  rules: SecurityRule[];
  lastEvaluated?: Date;
  lastResult?: 'pass' | 'fail' | 'warning';
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'regex' | 'pattern' | 'custom';
  pattern: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityScan {
  id: string;
  scanType: 'secrets' | 'permissions' | 'data' | 'network' | 'compliance';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  findings: SecurityFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface SecurityFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'secrets' | 'permissions' | 'data' | 'network' | 'compliance';
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  recommendation: string;
  status: 'open' | 'acknowledged' | 'fixed' | 'false_positive';
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  tags: string[];
}

export interface SecretScanResult {
  secretType: string;
  location: string;
  confidence: number;
  context: string;
  recommendation: string;
}

export class SecurityService {
  private policies: Map<string, SecurityPolicy> = new Map();
  private scans: Map<string, SecurityScan> = new Map();
  private findings: Map<string, SecurityFinding> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies() {
    const defaultPolicies: SecurityPolicy[] = [
      {
        id: 'secrets-policy',
        name: 'Secrets Detection',
        description: 'Detect and prevent secrets in code and configuration',
        enabled: true,
        severity: 'critical',
        category: 'secrets',
        rules: [
          {
            id: 'api-key-regex',
            name: 'API Key Detection',
            description: 'Detect API keys in code',
            enabled: true,
            type: 'regex',
            pattern: '(?i)(api[_-]?key|apikey|access[_-]?key|secret[_-]?key)\\s*[:=]\\s*["\']?[a-zA-Z0-9]{20,}["\']?',
            message: 'Potential API key detected',
            severity: 'high'
          },
          {
            id: 'password-regex',
            name: 'Password Detection',
            description: 'Detect passwords in code',
            enabled: true,
            type: 'regex',
            pattern: '(?i)(password|passwd|pwd)\\s*[:=]\\s*["\']?[^"\']{8,}["\']?',
            message: 'Potential password detected',
            severity: 'high'
          },
          {
            id: 'token-regex',
            name: 'Token Detection',
            description: 'Detect tokens in code',
            enabled: true,
            type: 'regex',
            pattern: '(?i)(token|bearer|jwt|oauth)\\s*[:=]\\s*["\']?[a-zA-Z0-9._-]{20,}["\']?',
            message: 'Potential token detected',
            severity: 'high'
          }
        ],
        lastResult: 'pass'
      },
      {
        id: 'permissions-policy',
        name: 'Permissions Audit',
        description: 'Audit user permissions and access controls',
        enabled: true,
        severity: 'high',
        category: 'permissions',
        rules: [
          {
            id: 'admin-check',
            name: 'Admin Access Check',
            description: 'Check for admin-level access',
            enabled: true,
            type: 'pattern',
            pattern: 'admin|root|superuser',
            message: 'Admin-level access detected',
            severity: 'medium'
          },
          {
            id: 'public-access',
            name: 'Public Access Check',
            description: 'Check for public access to sensitive resources',
            enabled: true,
            type: 'pattern',
            pattern: 'public|open|unrestricted',
            message: 'Public access to sensitive resource',
            severity: 'medium'
          }
        ],
        lastResult: 'pass'
      },
      {
        id: 'data-policy',
        name: 'Data Protection',
        description: 'Ensure data protection and privacy compliance',
        enabled: true,
        severity: 'high',
        category: 'data',
        rules: [
          {
            id: 'pii-detection',
            name: 'PII Detection',
            description: 'Detect personally identifiable information',
            enabled: true,
            type: 'regex',
            pattern: '(?i)(ssn|social security|credit card|phone|email|address)',
            message: 'Potential PII detected',
            severity: 'high'
          },
          {
            id: 'encryption-check',
            name: 'Encryption Check',
            description: 'Check for proper encryption usage',
            enabled: true,
            type: 'pattern',
            pattern: 'encrypt|hash|secure',
            message: 'Encryption usage check',
            severity: 'low'
          }
        ],
        lastResult: 'pass'
      }
    ];

    defaultPolicies.forEach(policy => {
      this.policies.set(policy.id, policy);
    });
  }

  async scanSecrets(content: string, filePath?: string): Promise<SecretScanResult[]> {
    const results: SecretScanResult[] = [];
    const secretsPolicy = this.policies.get('secrets-policy');
    
    if (!secretsPolicy || !secretsPolicy.enabled) {
      return results;
    }

    for (const rule of secretsPolicy.rules) {
      if (!rule.enabled) continue;

      const regex = new RegExp(rule.pattern, 'g');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        results.push({
          secretType: rule.name,
          location: filePath || 'unknown',
          confidence: this.calculateConfidence(match[0], rule.pattern),
          context: this.extractContext(content, match.index),
          recommendation: this.getSecretRecommendation(rule.name)
        });
      }
    }

    return results;
  }

  private calculateConfidence(secret: string, pattern: string): number {
    // Simple confidence calculation based on length and pattern complexity
    let confidence = 0.5;
    
    if (secret.length > 20) confidence += 0.2;
    if (secret.length > 40) confidence += 0.1;
    if (pattern.includes('api') || pattern.includes('key')) confidence += 0.1;
    if (pattern.includes('token') || pattern.includes('bearer')) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private extractContext(content: string, index: number): string {
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + 50);
    return content.substring(start, end);
  }

  private getSecretRecommendation(secretType: string): string {
    switch (secretType) {
      case 'API Key Detection':
        return 'Use environment variables or secure secret management';
      case 'Password Detection':
        return 'Use secure password hashing and avoid hardcoding';
      case 'Token Detection':
        return 'Use secure token storage and rotation';
      default:
        return 'Review and secure sensitive information';
    }
  }

  async runSecurityScan(scanType: SecurityScan['scanType']): Promise<string> {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    
    const scan: SecurityScan = {
      id: scanId,
      scanType,
      status: 'running',
      startTime,
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };

    this.scans.set(scanId, scan);

    try {
      // Simulate scan execution
      await this.simulateScanExecution(scan);
      
      scan.status = 'completed';
      scan.endTime = new Date();
      scan.duration = scan.endTime.getTime() - scan.startTime.getTime();
      
      // Update summary
      scan.summary = this.calculateScanSummary(scan.findings);
      
    } catch (error) {
      scan.status = 'failed';
      scan.endTime = new Date();
      scan.duration = scan.endTime.getTime() - scan.startTime.getTime();
    }

    return scanId;
  }

  private async simulateScanExecution(scan: SecurityScan): Promise<void> {
    // Simulate scan execution with random findings
    const findings: SecurityFinding[] = [];
    
    // Generate random findings based on scan type
    const numFindings = Math.floor(Math.random() * 10) + 1;
    
    for (let i = 0; i < numFindings; i++) {
      const finding = this.generateRandomFinding(scan.scanType);
      findings.push(finding);
      this.findings.set(finding.id, finding);
    }
    
    scan.findings = findings;
  }

  private generateRandomFinding(scanType: SecurityScan['scanType']): SecurityFinding {
    const id = `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const severities: SecurityFinding['severity'][] = ['low', 'medium', 'high', 'critical'];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    
    const finding: SecurityFinding = {
      id,
      ruleId: `rule_${Math.random().toString(36).substr(2, 9)}`,
      ruleName: `${scanType} Rule`,
      severity,
      category: scanType,
      title: `${severity.toUpperCase()} ${scanType} finding`,
      description: `This is a ${severity} severity finding related to ${scanType}`,
      file: `src/file${Math.floor(Math.random() * 10)}.ts`,
      line: Math.floor(Math.random() * 100) + 1,
      column: Math.floor(Math.random() * 50) + 1,
      code: 'const secret = "example-secret";',
      recommendation: `Fix this ${scanType} issue by following security best practices`,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [scanType, severity]
    };

    return finding;
  }

  private calculateScanSummary(findings: SecurityFinding[]): SecurityScan['summary'] {
    const summary = {
      total: findings.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          summary.critical++;
          break;
        case 'high':
          summary.high++;
          break;
        case 'medium':
          summary.medium++;
          break;
        case 'low':
          summary.low++;
          break;
      }
    });

    return summary;
  }

  getSecurityPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values());
  }

  getSecurityScans(): SecurityScan[] {
    return Array.from(this.scans.values());
  }

  getSecurityFindings(): SecurityFinding[] {
    return Array.from(this.findings.values());
  }

  getSecurityScan(scanId: string): SecurityScan | undefined {
    return this.scans.get(scanId);
  }

  getSecurityFinding(findingId: string): SecurityFinding | undefined {
    return this.findings.get(findingId);
  }

  updateSecurityPolicy(policyId: string, updates: Partial<SecurityPolicy>): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    Object.assign(policy, updates);
    return true;
  }

  updateSecurityFinding(findingId: string, updates: Partial<SecurityFinding>): boolean {
    const finding = this.findings.get(findingId);
    if (!finding) return false;

    Object.assign(finding, updates);
    finding.updatedAt = new Date();
    return true;
  }

  createSecurityPolicy(policy: Omit<SecurityPolicy, 'id' | 'lastEvaluated' | 'lastResult'>): string {
    const id = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newPolicy: SecurityPolicy = {
      ...policy,
      id,
      lastResult: 'pass'
    };
    
    this.policies.set(id, newPolicy);
    return id;
  }

  deleteSecurityPolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  async validateSecrets(secrets: string[]): Promise<{ valid: string[]; invalid: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const secret of secrets) {
      // Simple validation - in real implementation, this would check against actual secret patterns
      if (secret.length >= 8 && /[A-Za-z0-9]/.test(secret)) {
        valid.push(secret);
      } else {
        invalid.push(secret);
      }
    }

    return { valid, invalid };
  }

  async generateSecurityReport(orgId: string): Promise<{
    totalPolicies: number;
    activePolicies: number;
    totalScans: number;
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    lastScanDate?: Date;
  }> {
    const policies = this.getSecurityPolicies();
    const scans = this.getSecurityScans();
    const findings = this.getSecurityFindings();

    const report = {
      totalPolicies: policies.length,
      activePolicies: policies.filter(p => p.enabled).length,
      totalScans: scans.length,
      totalFindings: findings.length,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
      highFindings: findings.filter(f => f.severity === 'high').length,
      mediumFindings: findings.filter(f => f.severity === 'medium').length,
      lowFindings: findings.filter(f => f.severity === 'low').length,
      lastScanDate: scans.length > 0 ? scans[scans.length - 1].startTime : undefined
    };

    return report;
  }
}

export const securityService = new SecurityService();
