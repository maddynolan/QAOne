#!/usr/bin/env tsx

/**
 * QAOne Seed Script
 * 
 * Usage:
 *   pnpm tsx scripts/seed.ts --org demo-org --project webapp
 *   pnpm tsx scripts/seed.ts --org demo-org --project webapp --users 5 --test-cases 20
 */

import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'
import { Command } from 'commander'

const program = new Command()

program
  .name('seed')
  .description('Seed QAOne database with demo data')
  .version('1.0.0')

program
  .option('-o, --org <name>', 'Organization name', 'demo-org')
  .option('-p, --project <name>', 'Project name', 'webapp')
  .option('-u, --users <count>', 'Number of users to create', '3')
  .option('-t, --test-cases <count>', 'Number of test cases to create', '10')
  .option('-r, --test-runs <count>', 'Number of test runs to create', '5')
  .option('--url <url>', 'Supabase URL', process.env.VITE_SUPABASE_URL || 'http://localhost:54321')
  .option('--key <key>', 'Supabase anon key', process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key')

program.parse()

const options = program.opts()

const supabase = createClient(options.url, options.key)

// Types
interface SeedData {
  orgId: string
  projectId: string
  userIds: string[]
  testCaseIds: string[]
  testRunIds: string[]
}

const testPriorities = ['P0', 'P1', 'P2', 'P3'] as const
const testTypes = ['manual', 'automated', 'api', 'ui', 'e2e', 'performance'] as const
const testStatuses = ['draft', 'active', 'archived', 'deprecated'] as const
const runStatuses = ['passed', 'failed', 'partial', 'error'] as const
const stepStatuses = ['passed', 'failed', 'skipped', 'error'] as const

// Helper functions
const randomChoice = <T>(array: readonly T[]): T => 
  array[Math.floor(Math.random() * array.length)]

const generateTestSteps = (testType: string) => {
  const stepTemplates = {
    manual: [
      { action: 'Navigate to the application homepage', expected: 'Homepage loads successfully' },
      { action: 'Click on the login button', expected: 'Login form is displayed' },
      { action: 'Enter valid credentials', expected: 'Credentials are accepted' },
      { action: 'Submit the login form', expected: 'User is redirected to dashboard' }
    ],
    automated: [
      { action: 'Load the page', expected: 'Page loads within 3 seconds' },
      { action: 'Find login form element', expected: 'Login form is visible' },
      { action: 'Fill username and password fields', expected: 'Fields are populated' },
      { action: 'Click submit button', expected: 'Form submission is successful' }
    ],
    api: [
      { action: 'Send POST request to /api/auth/login', expected: 'Response status 200' },
      { action: 'Verify response contains JWT token', expected: 'Token is present and valid' },
      { action: 'Use token for authenticated request', expected: 'Request succeeds with token' }
    ],
    ui: [
      { action: 'Open browser and navigate to app', expected: 'Application loads' },
      { action: 'Locate login form', expected: 'Form is visible and interactive' },
      { action: 'Enter test credentials', expected: 'Input fields accept data' },
      { action: 'Click login button', expected: 'User is authenticated' }
    ],
    e2e: [
      { action: 'Start browser session', expected: 'Browser opens successfully' },
      { action: 'Navigate to application URL', expected: 'Application loads' },
      { action: 'Complete login flow', expected: 'User is logged in' },
      { action: 'Verify dashboard access', expected: 'Dashboard is accessible' }
    ],
    performance: [
      { action: 'Load application homepage', expected: 'Page loads within 2 seconds' },
      { action: 'Measure resource usage', expected: 'Memory usage under 100MB' },
      { action: 'Test concurrent users', expected: 'Handles 50+ concurrent users' }
    ]
  }

  return stepTemplates[testType] || stepTemplates.manual
}

const generateArtifacts = (runId: string, stepId: string) => {
  const artifactTypes = ['screenshot', 'video', 'trace', 'har', 'log']
  const artifacts = []

  // Always include a screenshot for failed tests
  if (Math.random() < 0.3) { // 30% chance of failure
    artifacts.push({
      run_id: runId,
      step_id: stepId,
      type: 'screenshot',
      url: `https://storage.example.com/screenshots/${faker.string.uuid()}.png`,
      size_bytes: faker.number.int({ min: 50000, max: 500000 }),
      checksum: faker.string.alphanumeric(64),
      metadata: {
        viewport: '1920x1080',
        browser: 'chrome',
        timestamp: new Date().toISOString()
      }
    })
  }

  // Sometimes include a trace file
  if (Math.random() < 0.2) {
    artifacts.push({
      run_id: runId,
      step_id: stepId,
      type: 'trace',
      url: `https://storage.example.com/traces/${faker.string.uuid()}.zip`,
      size_bytes: faker.number.int({ min: 100000, max: 2000000 }),
      checksum: faker.string.alphanumeric(64),
      metadata: {
        duration: faker.number.int({ min: 1000, max: 10000 }),
        steps: faker.number.int({ min: 5, max: 50 })
      }
    })
  }

  return artifacts
}

// Main seed function
async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting QAOne database seeding...')
  console.log(`📊 Configuration:`)
  console.log(`   Organization: ${options.org}`)
  console.log(`   Project: ${options.project}`)
  console.log(`   Users: ${options.users}`)
  console.log(`   Test Cases: ${options.testCases}`)
  console.log(`   Test Runs: ${options.testRuns}`)

  const seedData: SeedData = {
    orgId: '',
    projectId: '',
    userIds: [],
    testCaseIds: [],
    testRunIds: []
  }

  try {
    // 1. Create Organization
    console.log('\n📁 Creating organization...')
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: options.org,
        slug: options.org.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: `Demo organization for ${options.org}`
      })
      .select()
      .single()

    if (orgError) throw orgError
    seedData.orgId = org.id
    console.log(`✅ Created organization: ${org.name} (${org.id})`)

    // 2. Create Project
    console.log('\n📂 Creating project...')
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        org_id: seedData.orgId,
        name: options.project,
        slug: options.project.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: `Demo project for ${options.project}`
      })
      .select()
      .single()

    if (projectError) throw projectError
    seedData.projectId = project.id
    console.log(`✅ Created project: ${project.name} (${project.id})`)

    // 3. Create Users
    console.log('\n👥 Creating users...')
    const users = []
    for (let i = 0; i < parseInt(options.users); i++) {
      const email = faker.internet.email()
      const name = faker.person.fullName()
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          avatar_url: faker.image.avatar(),
          preferences: {
            theme: randomChoice(['light', 'dark']),
            notifications: faker.datatype.boolean()
          }
        })
        .select()
        .single()

      if (userError) throw userError
      users.push(user)
      seedData.userIds.push(user.id)
    }
    console.log(`✅ Created ${users.length} users`)

    // 4. Create Organization Memberships
    console.log('\n🔗 Creating organization memberships...')
    for (const user of users) {
      const { error: membershipError } = await supabase
        .from('org_memberships')
        .insert({
          org_id: seedData.orgId,
          user_id: user.id,
          role: randomChoice(['owner', 'admin', 'member', 'viewer'])
        })

      if (membershipError) throw membershipError
    }
    console.log(`✅ Created organization memberships`)

    // 5. Create Test Cases
    console.log('\n📝 Creating test cases...')
    const testCases = []
    for (let i = 0; i < parseInt(options.testCases); i++) {
      const testType = randomChoice(testTypes)
      const steps = generateTestSteps(testType)
      
      const { data: testCase, error: testCaseError } = await supabase
        .from('test_cases')
        .insert({
          project_id: seedData.projectId,
          title: faker.lorem.sentence(4),
          description: faker.lorem.paragraph(),
          priority: randomChoice(testPriorities),
          test_type: testType,
          status: randomChoice(testStatuses),
          tags: faker.helpers.arrayElements(['smoke', 'regression', 'critical', 'api', 'ui', 'e2e'], { min: 1, max: 3 }),
          steps,
          preconditions: [faker.lorem.sentence()],
          test_data: {
            username: faker.internet.userName(),
            password: faker.internet.password()
          },
          estimated_time: faker.number.int({ min: 5, max: 60 }),
          created_by: randomChoice(seedData.userIds)
        })
        .select()
        .single()

      if (testCaseError) throw testCaseError
      testCases.push(testCase)
      seedData.testCaseIds.push(testCase.id)
    }
    console.log(`✅ Created ${testCases.length} test cases`)

    // 6. Create Test Runs
    console.log('\n🏃 Creating test runs...')
    const testRuns = []
    for (let i = 0; i < parseInt(options.testRuns); i++) {
      const status = randomChoice(runStatuses)
      const startedAt = faker.date.recent({ days: 7 })
      const completedAt = new Date(startedAt.getTime() + faker.number.int({ min: 30000, max: 300000 }))

      const { data: testRun, error: testRunError } = await supabase
        .from('test_runs')
        .insert({
          project_id: seedData.projectId,
          name: `Test Run ${i + 1} - ${faker.date.recent().toLocaleDateString()}`,
          status,
          environment: randomChoice(['ci', 'local', 'staging', 'prod']),
          branch: faker.git.branch(),
          commit: faker.git.commitSha(),
          runner_version: 'playwright-1.40.0',
          started_at: startedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          created_by: randomChoice(seedData.userIds)
        })
        .select()
        .single()

      if (testRunError) throw testRunError
      testRuns.push(testRun)
      seedData.testRunIds.push(testRun.id)
    }
    console.log(`✅ Created ${testRuns.length} test runs`)

    // 7. Create Test Run Steps
    console.log('\n📋 Creating test run steps...')
    let totalSteps = 0
    for (const testRun of testRuns) {
      const selectedTestCases = faker.helpers.arrayElements(testCases, { min: 2, max: 8 })
      
      for (const testCase of selectedTestCases) {
        const stepStatus = randomChoice(stepStatuses)
        const duration = faker.number.int({ min: 1000, max: 30000 })
        
        const { data: step, error: stepError } = await supabase
          .from('test_run_steps')
          .insert({
            run_id: testRun.id,
            case_id: testCase.id,
            title: testCase.title,
            status: stepStatus,
            duration_ms: duration,
            error_message: stepStatus === 'failed' ? faker.lorem.sentence() : null,
            stdout: faker.lorem.paragraph(),
            stderr: stepStatus === 'failed' ? faker.lorem.sentence() : null,
            started_at: testRun.started_at,
            completed_at: testRun.completed_at
          })
          .select()
          .single()

        if (stepError) throw stepError
        totalSteps++

        // Create artifacts for some steps
        const artifacts = generateArtifacts(testRun.id, step.id)
        if (artifacts.length > 0) {
          const { error: artifactError } = await supabase
            .from('artifacts')
            .insert(artifacts)

          if (artifactError) throw artifactError
        }
      }
    }
    console.log(`✅ Created ${totalSteps} test run steps`)

    // 8. Create Triage Analysis for failed runs
    console.log('\n🔍 Creating triage analysis...')
    let triageCount = 0
    for (const testRun of testRuns) {
      if (testRun.status === 'failed') {
        const { error: triageError } = await supabase
          .from('triage_analysis')
          .insert({
            run_id: testRun.id,
            summary: faker.lorem.sentence(),
            root_cause: faker.lorem.paragraph(),
            category: randomChoice(['locator', 'timing', 'network', 'data', 'enviro']),
            suggested_fixes: [
              faker.lorem.sentence(),
              faker.lorem.sentence()
            ],
            selector_suggestions: [
              faker.lorem.word(),
              faker.lorem.word()
            ],
            likelihood_flaky: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
            related_cases: faker.helpers.arrayElements(seedData.testCaseIds, { min: 0, max: 3 }),
            ai_model: 'gpt-4',
            confidence: faker.number.float({ min: 0.5, max: 1, fractionDigits: 2 })
          })

        if (triageError) throw triageError
        triageCount++
      }
    }
    console.log(`✅ Created ${triageCount} triage analyses`)

    // 9. Create AI Generation Audit
    console.log('\n🤖 Creating AI generation audit...')
    const { error: auditError } = await supabase
      .from('ai_generation_audit')
      .insert({
        project_id: seedData.projectId,
        user_id: randomChoice(seedData.userIds),
        operation: 'generate_tests',
        model: 'gpt-4',
        prompt_tokens: faker.number.int({ min: 100, max: 1000 }),
        completion_tokens: faker.number.int({ min: 200, max: 2000 }),
        cost_usd: faker.number.float({ min: 0.001, max: 0.1, fractionDigits: 4 }),
        latency_ms: faker.number.int({ min: 500, max: 5000 }),
        request_data: {
          requirements: faker.lorem.sentence(),
          context: { product_area: 'Authentication' }
        },
        response_data: {
          cases_generated: faker.number.int({ min: 1, max: 10 })
        }
      })

    if (auditError) throw auditError
    console.log(`✅ Created AI generation audit`)

    console.log('\n🎉 Database seeding completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`   Organization: ${options.org} (${seedData.orgId})`)
    console.log(`   Project: ${options.project} (${seedData.projectId})`)
    console.log(`   Users: ${seedData.userIds.length}`)
    console.log(`   Test Cases: ${seedData.testCaseIds.length}`)
    console.log(`   Test Runs: ${seedData.testRunIds.length}`)
    console.log(`   Total Steps: ${totalSteps}`)
    console.log(`   Triage Analyses: ${triageCount}`)

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

// Run the seed function
seedDatabase()


