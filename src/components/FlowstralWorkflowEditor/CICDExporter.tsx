/**
 * CI/CD Exporter - Generate pipeline configurations from workflows
 * Supports GitHub Actions, GitLab CI, Jenkins, Azure Pipelines
 */

import React, { useState } from 'react';
import {
  GitBranch, Download, Copy, Check, Settings, Clock,
  Server, RefreshCw, AlertCircle, Loader2, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { TestSuite } from './TestSuiteManager';

interface CICDExporterProps {
  workflowName: string;
  workflowScript: string;
  testSuites: TestSuite[];
  onExport?: (config: string, provider: string) => void;
}

interface CICDConfig {
  provider: 'github' | 'gitlab' | 'jenkins' | 'azure' | 'bitbucket';
  schedule?: string;
  triggers: ('push' | 'pr' | 'schedule' | 'manual')[];
  branches: string[];
  browsers: ('chromium' | 'firefox' | 'webkit')[];
  parallelism: number;
  retries: number;
  environment: string;
  artifactRetention: number;
  notifications: {
    slack?: string;
    email?: string;
  };
}

const DEFAULT_CONFIG: CICDConfig = {
  provider: 'github',
  schedule: '0 6 * * *',
  triggers: ['push', 'pr'],
  branches: ['main', 'develop'],
  browsers: ['chromium'],
  parallelism: 1,
  retries: 2,
  environment: 'qa',
  artifactRetention: 30,
  notifications: {},
};

export default function CICDExporter({
  workflowName,
  workflowScript,
  testSuites,
  onExport,
}: CICDExporterProps) {
  const [config, setConfig] = useState<CICDConfig>(DEFAULT_CONFIG);
  const [generatedConfig, setGeneratedConfig] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const providers = [
    { id: 'github', name: 'GitHub Actions', icon: '🐙' },
    { id: 'gitlab', name: 'GitLab CI', icon: '🦊' },
    { id: 'jenkins', name: 'Jenkins', icon: '🤖' },
    { id: 'azure', name: 'Azure Pipelines', icon: '☁️' },
    { id: 'bitbucket', name: 'Bitbucket Pipelines', icon: '🪣' },
  ];

  const generateGitHubActions = (): string => {
    const triggers: string[] = [];
    
    if (config.triggers.includes('push')) {
      triggers.push(`  push:
    branches: [${config.branches.map(b => `'${b}'`).join(', ')}]`);
    }
    
    if (config.triggers.includes('pr')) {
      triggers.push(`  pull_request:
    branches: [${config.branches.map(b => `'${b}'`).join(', ')}]`);
    }
    
    if (config.triggers.includes('schedule') && config.schedule) {
      triggers.push(`  schedule:
    - cron: '${config.schedule}'`);
    }
    
    if (config.triggers.includes('manual')) {
      triggers.push(`  workflow_dispatch:`);
    }

    return `name: ${workflowName} Tests

on:
${triggers.join('\n')}

env:
  CI: true
  NODE_ENV: test
  TEST_ENVIRONMENT: ${config.environment}

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        browser: [${config.browsers.map(b => `'${b}'`).join(', ')}]
        shard: [${Array.from({ length: config.parallelism }, (_, i) => i + 1).join(', ')}]
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps \${{ matrix.browser }}

      - name: Run Playwright tests
        run: npx playwright test --project=\${{ matrix.browser }} --shard=\${{ matrix.shard }}/${config.parallelism} --retries=${config.retries}
        env:
          PLAYWRIGHT_TEST_BASE_URL: \${{ secrets.TEST_BASE_URL }}
          TEST_USER_EMAIL: \${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: \${{ secrets.TEST_USER_PASSWORD }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-\${{ matrix.browser }}-\${{ matrix.shard }}
          path: playwright-report/
          retention-days: ${config.artifactRetention}

      - name: Upload test videos
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-videos-\${{ matrix.browser }}-\${{ matrix.shard }}
          path: test-results/
          retention-days: ${config.artifactRetention}
${config.notifications.slack ? `
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1.25.0
        if: failure()
        with:
          channel-id: 'test-alerts'
          slack-message: '❌ Tests failed for $\{{ github.repository }} on $\{{ github.ref }}'
        env:
          SLACK_BOT_TOKEN: \${{ secrets.SLACK_BOT_TOKEN }}
` : ''}
  merge-reports:
    needs: test
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: all-reports

      - name: Merge reports
        run: |
          npm install -g playwright-merge-html-reports
          merge-html-reports all-reports playwright-report-*/

      - name: Upload merged report
        uses: actions/upload-artifact@v4
        with:
          name: playwright-merged-report
          path: playwright-report/
          retention-days: ${config.artifactRetention}
`;
  };

  const generateGitLabCI = (): string => {
    return `stages:
  - test
  - report

variables:
  CI: "true"
  TEST_ENVIRONMENT: "${config.environment}"

.playwright_base:
  image: mcr.microsoft.com/playwright:v1.40.0-jammy
  before_script:
    - npm ci
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
    expire_in: ${config.artifactRetention} days
  retry:
    max: ${config.retries}
    when: always

${config.browsers.map((browser, idx) => `
test_${browser}:
  extends: .playwright_base
  stage: test
  parallel: ${config.parallelism}
  script:
    - npx playwright test --project=${browser} --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"
      when: always
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: always
    - if: $CI_PIPELINE_SOURCE == "schedule"
      when: always
`).join('')}

merge_reports:
  stage: report
  image: node:20
  needs:
    - test_chromium
  script:
    - npm install -g playwright-merge-html-reports
    - merge-html-reports playwright-report-*/
  artifacts:
    paths:
      - playwright-report/
    expire_in: ${config.artifactRetention} days
  rules:
    - when: always
`;
  };

  const generateJenkinsfile = (): string => {
    return `pipeline {
    agent any
    
    environment {
        CI = 'true'
        TEST_ENVIRONMENT = '${config.environment}'
        PLAYWRIGHT_BROWSERS_PATH = '0'
    }
    
    options {
        timeout(time: 60, unit: 'MINUTES')
        retry(${config.retries})
    }
    
    triggers {
        ${config.triggers.includes('schedule') && config.schedule ? `cron('${config.schedule}')` : ''}
        ${config.triggers.includes('push') ? `pollSCM('H/5 * * * *')` : ''}
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
                sh 'npx playwright install --with-deps'
            }
        }
        
        stage('Test') {
            matrix {
                axes {
                    axis {
                        name 'BROWSER'
                        values ${config.browsers.map(b => `'${b}'`).join(', ')}
                    }
                }
                stages {
                    stage('Run Tests') {
                        steps {
                            sh 'npx playwright test --project=\${BROWSER} --retries=${config.retries}'
                        }
                    }
                }
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'playwright-report/**/*', allowEmptyArchive: true
            archiveArtifacts artifacts: 'test-results/**/*', allowEmptyArchive: true
            
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Report'
            ])
        }
        
        failure {
            ${config.notifications.email ? `emailext(
                subject: "❌ \${env.JOB_NAME} - Build #\${env.BUILD_NUMBER} Failed",
                body: "Tests failed. Check the report at \${env.BUILD_URL}",
                to: "${config.notifications.email}"
            )` : '// Add notification configuration'}
        }
    }
}
`;
  };

  const generateAzurePipelines = (): string => {
    return `trigger:
  branches:
    include:
${config.branches.map(b => `      - ${b}`).join('\n')}

${config.triggers.includes('pr') ? `pr:
  branches:
    include:
${config.branches.map(b => `      - ${b}`).join('\n')}
` : ''}

${config.triggers.includes('schedule') && config.schedule ? `schedules:
  - cron: "${config.schedule}"
    displayName: Daily test run
    branches:
      include:
        - main
    always: true
` : ''}

pool:
  vmImage: 'ubuntu-latest'

variables:
  CI: 'true'
  TEST_ENVIRONMENT: '${config.environment}'

strategy:
  matrix:
${config.browsers.map(browser => `    ${browser}:
      BROWSER: '${browser}'`).join('\n')}
  maxParallel: ${config.parallelism}

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npx playwright install --with-deps $(BROWSER)
    displayName: 'Install Playwright browsers'

  - script: npx playwright test --project=$(BROWSER) --retries=${config.retries}
    displayName: 'Run Playwright tests'
    env:
      TEST_BASE_URL: $(TEST_BASE_URL)
      TEST_USER_EMAIL: $(TEST_USER_EMAIL)
      TEST_USER_PASSWORD: $(TEST_USER_PASSWORD)

  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: 'JUnit'
      testResultsFiles: 'test-results/junit.xml'
      mergeTestResults: true
      testRunTitle: 'Playwright Tests - $(BROWSER)'

  - task: PublishPipelineArtifact@1
    condition: always()
    inputs:
      targetPath: 'playwright-report'
      artifact: 'playwright-report-$(BROWSER)'
`;
  };

  const generateBitbucketPipelines = (): string => {
    return `image: mcr.microsoft.com/playwright:v1.40.0-jammy

definitions:
  caches:
    npm: $HOME/.npm
    
  steps:
    - step: &test-chromium
        name: Test Chromium
        caches:
          - npm
          - node
        script:
          - npm ci
          - npx playwright test --project=chromium --retries=${config.retries}
        artifacts:
          - playwright-report/**
          - test-results/**

pipelines:
  default:
    - step: *test-chromium

  branches:
${config.branches.map(branch => `    ${branch}:
      - parallel:
${config.browsers.map(browser => `          - step:
              name: Test ${browser}
              caches:
                - npm
              script:
                - npm ci
                - npx playwright install --with-deps ${browser}
                - npx playwright test --project=${browser} --retries=${config.retries}
              artifacts:
                - playwright-report/**
                - test-results/**`).join('\n')}`).join('\n')}

  pull-requests:
    '**':
      - step: *test-chromium
`;
  };

  const generateConfig = () => {
    let generated = '';
    
    switch (config.provider) {
      case 'github':
        generated = generateGitHubActions();
        break;
      case 'gitlab':
        generated = generateGitLabCI();
        break;
      case 'jenkins':
        generated = generateJenkinsfile();
        break;
      case 'azure':
        generated = generateAzurePipelines();
        break;
      case 'bitbucket':
        generated = generateBitbucketPipelines();
        break;
    }
    
    setGeneratedConfig(generated);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Configuration copied to clipboard');
  };

  const downloadConfig = () => {
    const fileNames: Record<string, string> = {
      github: '.github/workflows/playwright.yml',
      gitlab: '.gitlab-ci.yml',
      jenkins: 'Jenkinsfile',
      azure: 'azure-pipelines.yml',
      bitbucket: 'bitbucket-pipelines.yml',
    };
    
    const blob = new Blob([generatedConfig], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNames[config.provider].split('/').pop()!;
    a.click();
    URL.revokeObjectURL(url);
    
    onExport?.(generatedConfig, config.provider);
    toast.success(`Downloaded ${fileNames[config.provider]}`);
  };

  return (
    <>
      <Button onClick={() => setShowDialog(true)} variant="outline">
        <GitBranch className="h-4 w-4 mr-2" />
        CI/CD Export
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Export to CI/CD Pipeline</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Configuration Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">CI/CD Provider</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {providers.map(provider => (
                      <Button
                        key={provider.id}
                        variant={config.provider === provider.id ? 'default' : 'outline'}
                        className="justify-start"
                        onClick={() => {
                          setConfig({ ...config, provider: provider.id as CICDConfig['provider'] });
                          setGeneratedConfig('');
                        }}
                      >
                        <span className="mr-2">{provider.icon}</span>
                        {provider.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Triggers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(['push', 'pr', 'schedule', 'manual'] as const).map(trigger => (
                      <Badge
                        key={trigger}
                        variant={config.triggers.includes(trigger) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          const newTriggers = config.triggers.includes(trigger)
                            ? config.triggers.filter(t => t !== trigger)
                            : [...config.triggers, trigger];
                          setConfig({ ...config, triggers: newTriggers });
                        }}
                      >
                        {trigger === 'push' && '📤 Push'}
                        {trigger === 'pr' && '🔀 PR'}
                        {trigger === 'schedule' && '⏰ Schedule'}
                        {trigger === 'manual' && '👆 Manual'}
                      </Badge>
                    ))}
                  </div>
                  
                  {config.triggers.includes('schedule') && (
                    <div>
                      <Label>Cron Schedule</Label>
                      <Input
                        value={config.schedule}
                        onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
                        placeholder="0 6 * * * (6 AM daily)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: minute hour day month weekday
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Test Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Browsers</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(['chromium', 'firefox', 'webkit'] as const).map(browser => (
                        <Badge
                          key={browser}
                          variant={config.browsers.includes(browser) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            const newBrowsers = config.browsers.includes(browser)
                              ? config.browsers.filter(b => b !== browser)
                              : [...config.browsers, browser];
                            setConfig({ ...config, browsers: newBrowsers });
                          }}
                        >
                          {browser}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Parallelism</Label>
                      <Input
                        type="number"
                        value={config.parallelism}
                        onChange={(e) => setConfig({ ...config, parallelism: parseInt(e.target.value) || 1 })}
                        min={1}
                        max={10}
                      />
                    </div>
                    <div>
                      <Label>Retries</Label>
                      <Input
                        type="number"
                        value={config.retries}
                        onChange={(e) => setConfig({ ...config, retries: parseInt(e.target.value) || 0 })}
                        min={0}
                        max={5}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Branches</Label>
                    <Input
                      value={config.branches.join(', ')}
                      onChange={(e) => setConfig({ 
                        ...config, 
                        branches: e.target.value.split(',').map(b => b.trim()).filter(Boolean)
                      })}
                      placeholder="main, develop"
                    />
                  </div>
                </CardContent>
              </Card>

              <Button onClick={generateConfig} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Configuration
              </Button>
            </div>

            {/* Generated Config Preview */}
            <div className="space-y-4">
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Generated Configuration</CardTitle>
                  {generatedConfig && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={downloadConfig}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {generatedConfig ? (
                    <Textarea
                      value={generatedConfig}
                      readOnly
                      className="font-mono text-xs h-[400px]"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      <div className="text-center">
                        <GitBranch className="h-8 w-8 mx-auto mb-2" />
                        <p>Configure options and click "Generate"</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Close
            </Button>
            {generatedConfig && (
              <Button onClick={downloadConfig}>
                <Download className="h-4 w-4 mr-2" />
                Download Configuration
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

