import { createClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert, TablesUpdate } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://fimqstvogqqnkvasorlj.supabase.co"
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbXFzdHZvZ3Fxbmt2YXNvcmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NjAzNjgsImV4cCI6MjA3NzIzNjM2OH0.lbZ33NzOOE-eO8vj0Vg79Y1BKt0nYxz6v1g3a4aYTEk"

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Type aliases for easier usage
export type Organization = Tables<'organizations'>
export type Project = Tables<'projects'>
export type User = Tables<'users'>
export type TestPlan = Tables<'test_plans'>
export type TestCase = Tables<'test_cases'>
export type TestRun = Tables<'test_runs'>
export type TestRunStep = Tables<'test_run_steps'>
export type Artifact = Tables<'artifacts'>
export type TriageAnalysis = Tables<'triage_analysis'>
export type Defect = Tables<'defects'>
export type AIGenerationAudit = Tables<'ai_generation_audit'>

export type OrganizationInsert = TablesInsert<'organizations'>
export type ProjectInsert = TablesInsert<'projects'>
export type UserInsert = TablesInsert<'users'>
export type TestPlanInsert = TablesInsert<'test_plans'>
export type TestCaseInsert = TablesInsert<'test_cases'>
export type TestRunInsert = TablesInsert<'test_runs'>
export type TestRunStepInsert = TablesInsert<'test_run_steps'>
export type ArtifactInsert = TablesInsert<'artifacts'>
export type TriageAnalysisInsert = TablesInsert<'triage_analysis'>
export type DefectInsert = TablesInsert<'defects'>
export type AIGenerationAuditInsert = TablesInsert<'ai_generation_audit'>

export type OrganizationUpdate = TablesUpdate<'organizations'>
export type ProjectUpdate = TablesUpdate<'projects'>
export type UserUpdate = TablesUpdate<'users'>
export type TestPlanUpdate = TablesUpdate<'test_plans'>
export type TestCaseUpdate = TablesUpdate<'test_cases'>
export type TestRunUpdate = TablesUpdate<'test_runs'>
export type TestRunStepUpdate = TablesUpdate<'test_run_steps'>
export type ArtifactUpdate = TablesUpdate<'artifacts'>
export type TriageAnalysisUpdate = TablesUpdate<'triage_analysis'>
export type DefectUpdate = TablesUpdate<'defects'>
export type AIGenerationAuditUpdate = TablesUpdate<'ai_generation_audit'>

// Organization Service
export class OrganizationService {
  static async getOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async getOrganization(id: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async createOrganization(org: OrganizationInsert): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .insert(org)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateOrganization(id: string, updates: OrganizationUpdate): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteOrganization(id: string): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Project Service
export class ProjectService {
  static async getProjects(orgId?: string): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  static async getProject(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async createProject(project: ProjectInsert): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateProject(id: string, updates: ProjectUpdate): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Test Case Service
export class TestCaseService {
  static async getTestCases(projectId?: string): Promise<TestCase[]> {
    let query = supabase
      .from('test_cases')
      .select(`
        *,
        test_plans(name),
        projects(name, org_id)
      `)
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  static async getTestCase(id: string): Promise<TestCase | null> {
    const { data, error } = await supabase
      .from('test_cases')
      .select(`
        *,
        test_plans(name),
        projects(name, org_id)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async createTestCase(testCase: TestCaseInsert): Promise<TestCase> {
    const { data, error } = await supabase
      .from('test_cases')
      .insert(testCase)
      .select(`
        *,
        test_plans(name),
        projects(name, org_id)
      `)
      .single()

    if (error) throw error
    return data
  }

  static async updateTestCase(id: string, updates: TestCaseUpdate): Promise<TestCase> {
    const { data, error } = await supabase
      .from('test_cases')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        test_plans(name),
        projects(name, org_id)
      `)
      .single()

    if (error) throw error
    return data
  }

  static async deleteTestCase(id: string): Promise<void> {
    const { error } = await supabase
      .from('test_cases')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Test Run Service
export class TestRunService {
  static async getTestRuns(projectId?: string): Promise<TestRun[]> {
    let query = supabase
      .from('test_runs')
      .select(`
        *,
        test_plans(name),
        projects(name, org_id)
      `)
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  static async getTestRun(id: string): Promise<TestRun | null> {
    const { data, error } = await supabase
      .from('test_runs')
      .select(`
        *,
        test_plans(name),
        projects(name, org_id)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async createTestRun(testRun: TestRunInsert): Promise<TestRun> {
    const { data, error } = await supabase
      .from('test_runs')
      .insert(testRun)
      .select(`
        *,
        test_plans(name),
        projects(name, org_id)
      `)
      .single()

    if (error) throw error
    return data
  }

  static async updateTestRun(id: string, updates: TestRunUpdate): Promise<TestRun> {
    const { data, error } = await supabase
      .from('test_runs')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        test_plans(name),
        projects(name, org_id)
      `)
      .single()

    if (error) throw error
    return data
  }

  static async deleteTestRun(id: string): Promise<void> {
    const { error } = await supabase
      .from('test_runs')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Triage Analysis Service
export class TriageAnalysisService {
  static async getTriageAnalysis(runId: string): Promise<TriageAnalysis[]> {
    const { data, error } = await supabase
      .from('triage_analysis')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createTriageAnalysis(analysis: TriageAnalysisInsert): Promise<TriageAnalysis> {
    const { data, error } = await supabase
      .from('triage_analysis')
      .insert(analysis)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// AI Generation Audit Service
export class AIGenerationAuditService {
  static async createAudit(audit: AIGenerationAuditInsert): Promise<AIGenerationAudit> {
    const { data, error } = await supabase
      .from('ai_generation_audit')
      .insert(audit)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getAuditByProject(projectId: string): Promise<AIGenerationAudit[]> {
    const { data, error } = await supabase
      .from('ai_generation_audit')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}

// Auth Service
export class AuthService {
  static async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return data
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  static async signUp(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (error) throw error
    return data
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  static async onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null)
    })
  }
}
