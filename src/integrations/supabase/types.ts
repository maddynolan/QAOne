export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer'
export type TestStatus = 'draft' | 'active' | 'archived' | 'deprecated'
export type TestPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type TestType = 'manual' | 'automated' | 'api' | 'ui' | 'e2e' | 'performance'
export type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'partial' | 'error' | 'cancelled'
export type StepStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'error'
export type ArtifactType = 'screenshot' | 'video' | 'trace' | 'har' | 'log' | 'other'
export type TriageCategory = 'locator' | 'timing' | 'network' | 'data' | 'enviro'

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          org_id: string
          name: string
          slug: string
          description: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          slug: string
          description?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          slug?: string
          description?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          avatar_url?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      org_memberships: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: UserRole
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role?: UserRole
          invited_by?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: UserRole
          invited_by?: string | null
          joined_at?: string
        }
      }
      project_memberships: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: UserRole
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: UserRole
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: UserRole
        }
      }
      test_plans: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          status: TestStatus
          settings: Json
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string | null
          status?: TestStatus
          settings?: Json
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          status?: TestStatus
          settings?: Json
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      test_cases: {
        Row: {
          id: string
          project_id: string
          plan_id: string | null
          title: string
          description: string | null
          priority: TestPriority
          test_type: TestType
          status: TestStatus
          tags: string[]
          steps: Json
          preconditions: string[]
          test_data: Json
          estimated_time: number
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          plan_id?: string | null
          title: string
          description?: string | null
          priority?: TestPriority
          test_type?: TestType
          status?: TestStatus
          tags?: string[]
          steps?: Json
          preconditions?: string[]
          test_data?: Json
          estimated_time?: number
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          plan_id?: string | null
          title?: string
          description?: string | null
          priority?: TestPriority
          test_type?: TestType
          status?: TestStatus
          tags?: string[]
          steps?: Json
          preconditions?: string[]
          test_data?: Json
          estimated_time?: number
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      test_runs: {
        Row: {
          id: string
          project_id: string
          plan_id: string | null
          name: string
          status: RunStatus
          environment: string
          branch: string | null
          commit: string | null
          runner_version: string | null
          started_at: string | null
          completed_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          plan_id?: string | null
          name: string
          status?: RunStatus
          environment?: string
          branch?: string | null
          commit?: string | null
          runner_version?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          plan_id?: string | null
          name?: string
          status?: RunStatus
          environment?: string
          branch?: string | null
          commit?: string | null
          runner_version?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      test_run_steps: {
        Row: {
          id: string
          run_id: string
          case_id: string
          title: string
          status: StepStatus
          duration_ms: number
          error_message: string | null
          stdout: string | null
          stderr: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          run_id: string
          case_id: string
          title: string
          status?: StepStatus
          duration_ms?: number
          error_message?: string | null
          stdout?: string | null
          stderr?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          run_id?: string
          case_id?: string
          title?: string
          status?: StepStatus
          duration_ms?: number
          error_message?: string | null
          stdout?: string | null
          stderr?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
      artifacts: {
        Row: {
          id: string
          run_id: string | null
          step_id: string | null
          type: ArtifactType
          url: string
          size_bytes: number | null
          checksum: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          run_id?: string | null
          step_id?: string | null
          type: ArtifactType
          url: string
          size_bytes?: number | null
          checksum?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          run_id?: string | null
          step_id?: string | null
          type?: ArtifactType
          url?: string
          size_bytes?: number | null
          checksum?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      triage_analysis: {
        Row: {
          id: string
          run_id: string
          step_id: string | null
          summary: string
          root_cause: string
          category: TriageCategory | null
          suggested_fixes: string[]
          selector_suggestions: string[]
          likelihood_flaky: number
          related_cases: string[]
          ai_model: string | null
          confidence: number
          created_at: string
        }
        Insert: {
          id?: string
          run_id: string
          step_id?: string | null
          summary: string
          root_cause: string
          category?: TriageCategory | null
          suggested_fixes?: string[]
          selector_suggestions?: string[]
          likelihood_flaky?: number
          related_cases?: string[]
          ai_model?: string | null
          confidence?: number
          created_at?: string
        }
        Update: {
          id?: string
          run_id?: string
          step_id?: string | null
          summary?: string
          root_cause?: string
          category?: TriageCategory | null
          suggested_fixes?: string[]
          selector_suggestions?: string[]
          likelihood_flaky?: number
          related_cases?: string[]
          ai_model?: string | null
          confidence?: number
          created_at?: string
        }
      }
      defects: {
        Row: {
          id: string
          project_id: string
          run_id: string | null
          step_id: string | null
          title: string
          description: string | null
          priority: TestPriority
          status: string
          assigned_to: string | null
          jira_id: string | null
          triage_analysis_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          run_id?: string | null
          step_id?: string | null
          title: string
          description?: string | null
          priority?: TestPriority
          status?: string
          assigned_to?: string | null
          jira_id?: string | null
          triage_analysis_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          run_id?: string | null
          step_id?: string | null
          title?: string
          description?: string | null
          priority?: TestPriority
          status?: string
          assigned_to?: string | null
          jira_id?: string | null
          triage_analysis_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      ai_generation_audit: {
        Row: {
          id: string
          project_id: string
          user_id: string
          operation: string
          model: string
          prompt_tokens: number
          completion_tokens: number
          cost_usd: number
          latency_ms: number
          request_data: Json
          response_data: Json
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          operation: string
          model: string
          prompt_tokens: number
          completion_tokens: number
          cost_usd: number
          latency_ms: number
          request_data?: Json
          response_data?: Json
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          operation?: string
          model?: string
          prompt_tokens?: number
          completion_tokens?: number
          cost_usd?: number
          latency_ms?: number
          request_data?: Json
          response_data?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_ids: {
        Args: {
          user_uuid: string
        }
        Returns: string[]
      }
      get_user_project_ids: {
        Args: {
          user_uuid: string
        }
        Returns: string[]
      }
    }
    Enums: {
      user_role: UserRole
      test_status: TestStatus
      test_priority: TestPriority
      test_type: TestType
      run_status: RunStatus
      step_status: StepStatus
      artifact_type: ArtifactType
      triage_category: TriageCategory
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const