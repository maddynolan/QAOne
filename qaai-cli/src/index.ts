#!/usr/bin/env node

/**
 * QA AI Platform CLI Tool
 * 
 * Usage:
 *   qaai-cli run --plan "Smoke Test" --wait --exit-code-on-fail
 *   qaai-cli status --run-id <run-id>
 *   qaai-cli plans --list
 */

import { Command } from 'commander';
import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

// Configuration
const API_BASE_URL = process.env.QAAI_API_URL || 'http://localhost:8000';
const API_KEY = process.env.QAAI_API_KEY || '';

interface RunOptions {
  plan: string;
  wait?: boolean;
  exitCodeOnFail?: boolean;
  environment?: string;
  browser?: string;
}

interface StatusOptions {
  runId: string;
}

interface PlansOptions {
  list?: boolean;
}

// Helper function to make API requests
async function apiRequest(method: string, endpoint: string, data?: any) {
  const headers: any = {
    'Content-Type': 'application/json'
  };
  
  if (API_KEY) {
    headers['Authorization'] = API_KEY.startsWith('Bearer ') ? API_KEY : `Bearer ${API_KEY}`;
  }
  
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers,
      data
    });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.data.detail || error.message}`);
    }
    throw new Error(`Network Error: ${error.message}`);
  }
}

// Run test plan
program
  .command('run')
  .description('Run a test plan')
  .requiredOption('--plan <name>', 'Test plan name')
  .option('--wait', 'Wait for execution to complete')
  .option('--exit-code-on-fail', 'Exit with non-zero code on failure')
  .option('--environment <env>', 'Environment (dev, staging, prod)', 'staging')
  .option('--browser <browser>', 'Browser (chromium, firefox, webkit)', 'chromium')
  .action(async (options: RunOptions) => {
    const spinner = ora('Running test plan...').start();
    
    try {
      // Find test plan by name
      spinner.text = `Finding test plan: ${options.plan}`;
      const plansResponse = await apiRequest('GET', '/api/test-plans');
      const plans = plansResponse.test_plans || [];
      const plan = plans.find((p: any) => p.name === options.plan);
      
      if (!plan) {
        spinner.fail(`Test plan "${options.plan}" not found`);
        process.exit(1);
      }
      
      // Create test run
      spinner.text = 'Creating test run...';
      const runResponse = await apiRequest('POST', '/api/test-runs', {
        test_plan_id: plan.test_plan_id,
        name: `CLI Run: ${options.plan}`,
        environment: options.environment,
        browser: options.browser,
        triggered_by: 'cli'
      });
      
      const testRunId = runResponse.test_run_id;
      spinner.text = `Test run created: ${testRunId}`;
      
      // Execute test run
      spinner.text = 'Executing test run...';
      const executeResponse = await apiRequest('POST', `/api/test-runs/${testRunId}/execute`);
      
      if (options.wait) {
        // Poll for status
        spinner.text = 'Waiting for execution to complete...';
        let status = 'running';
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes max
        
        while (status === 'running' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          const statusResponse = await apiRequest('GET', `/api/test-runs/${testRunId}`);
          status = statusResponse.test_run.status;
          
          if (status === 'running') {
            spinner.text = `Execution in progress... (${attempts * 2}s)`;
          }
          
          attempts++;
        }
        
        if (status === 'completed' || status === 'passed') {
          spinner.succeed(`Test run completed: ${status}`);
          
          // Get detailed results
          const detailsResponse = await apiRequest('GET', `/api/test-runs/${testRunId}`);
          const results = detailsResponse.test_run;
          
          console.log(chalk.cyan('\nTest Run Results:'));
          console.log(chalk.gray(`  Status: ${results.status}`));
          console.log(chalk.gray(`  Passed: ${results.passed_count || 0}`));
          console.log(chalk.gray(`  Failed: ${results.failed_count || 0}`));
          console.log(chalk.gray(`  Duration: ${results.duration_ms || 0}ms`));
        } else if (status === 'failed') {
          spinner.fail(`Test run failed`);
          
          // Get detailed results
          const detailsResponse = await apiRequest('GET', `/api/test-runs/${testRunId}`);
          const results = detailsResponse.test_run;
          
          console.log(chalk.red('\nTest Run Results:'));
          console.log(chalk.gray(`  Status: ${results.status}`));
          console.log(chalk.gray(`  Passed: ${results.passed_count || 0}`));
          console.log(chalk.gray(`  Failed: ${results.failed_count || 0}`));
          console.log(chalk.gray(`  Duration: ${results.duration_ms || 0}ms`));
          
          if (options.exitCodeOnFail) {
            process.exit(1);
          }
        } else {
          spinner.warn(`Test run status: ${status} (timeout after ${maxAttempts * 2}s)`);
        }
      } else {
        spinner.succeed(`Test run started: ${testRunId}`);
        console.log(chalk.cyan(`\nTest Run ID: ${testRunId}`));
        console.log(chalk.gray('Use "qaai-cli status --run-id ' + testRunId + '" to check status'));
      }
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Check status
program
  .command('status')
  .description('Check test run status')
  .requiredOption('--run-id <id>', 'Test run ID')
  .action(async (options: StatusOptions) => {
    const spinner = ora('Fetching test run status...').start();
    
    try {
      const response = await apiRequest('GET', `/api/test-runs/${options.runId}`);
      const testRun = response.test_run;
      
      spinner.stop();
      
      console.log(chalk.cyan('\nTest Run Status:'));
      console.log(chalk.gray(`  ID: ${testRun.test_run_id}`));
      console.log(chalk.gray(`  Name: ${testRun.name}`));
      console.log(chalk.gray(`  Status: ${testRun.status}`));
      console.log(chalk.gray(`  Passed: ${testRun.passed_count || 0}`));
      console.log(chalk.gray(`  Failed: ${testRun.failed_count || 0}`));
      console.log(chalk.gray(`  Duration: ${testRun.duration_ms || 0}ms`));
      
      if (testRun.status === 'failed') {
        console.log(chalk.red('\nTest run failed'));
        process.exit(1);
      } else if (testRun.status === 'completed' || testRun.status === 'passed') {
        console.log(chalk.green('\nTest run completed successfully'));
      }
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// List test plans
program
  .command('plans')
  .description('List test plans')
  .option('--list', 'List all test plans')
  .action(async (options: PlansOptions) => {
    const spinner = ora('Fetching test plans...').start();
    
    try {
      const response = await apiRequest('GET', '/api/test-plans');
      const plans = response.test_plans || [];
      
      spinner.stop();
      
      if (plans.length === 0) {
        console.log(chalk.yellow('No test plans found'));
        return;
      }
      
      console.log(chalk.cyan(`\nTest Plans (${plans.length}):`));
      plans.forEach((plan: any) => {
        console.log(chalk.gray(`  - ${plan.name} (ID: ${plan.test_plan_id})`));
      });
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Main
program
  .name('qaai-cli')
  .description('QA AI Platform CLI tool for CI/CD integration')
  .version('1.0.0');

program.parse();

