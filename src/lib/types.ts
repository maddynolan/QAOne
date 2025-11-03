export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          slug?: string
          description?: string | null
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      test_cases: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          priority: string
          tags: string[]
          steps: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          priority?: string
          tags?: string[]
          steps?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string | null
          priority?: string
          tags?: string[]
          steps?: Json
          created_at?: string
          updated_at?: string
        }
      }
      test_plans: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          test_case_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string | null
          test_case_ids?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          test_case_ids?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      test_runs: {
        Row: {
          id: string
          project_id: string
          name: string
          status: string
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          status?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          status?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      test_run_steps: {
        Row: {
          id: string
          test_run_id: string
          test_case_id: string
          status: string
          duration: number | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          test_run_id: string
          test_case_id: string
          status?: string
          duration?: number | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          test_run_id?: string
          test_case_id?: string
          status?: string
          duration?: number | null
          error_message?: string | null
          created_at?: string
        }
      }
      artifacts: {
        Row: {
          id: string
          test_run_id: string
          type: string
          data: Json
          created_at: string
        }
        Insert: {
          id?: string
          test_run_id: string
          type: string
          data: Json
          created_at?: string
        }
        Update: {
          id?: string
          test_run_id?: string
          type?: string
          data?: Json
          created_at?: string
        }
      }
      triage_analysis: {
        Row: {
          id: string
          test_run_id: string
          summary: string
          root_cause: string
          suggested_fixes: string[]
          created_at: string
        }
        Insert: {
          id?: string
          test_run_id: string
          summary: string
          root_cause: string
          suggested_fixes?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          test_run_id?: string
          summary?: string
          root_cause?: string
          suggested_fixes?: string[]
          created_at?: string
        }
      }
      defects: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          status: string
          priority: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          status?: string
          priority?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string | null
          status?: string
          priority?: string
          created_at?: string
          updated_at?: string
        }
      }
      ai_generation_audit: {
        Row: {
          id: string
          org_id: string
          project_id: string
          operation_type: string
          model: string
          prompt_tokens: number
          completion_tokens: number
          cost_usd: number
          latency_ms: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          operation_type: string
          model: string
          prompt_tokens: number
          completion_tokens: number
          cost_usd: number
          latency_ms: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          operation_type?: string
          model?: string
          prompt_tokens?: number
          completion_tokens?: number
          cost_usd?: number
          latency_ms?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never


