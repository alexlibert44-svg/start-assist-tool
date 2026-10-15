export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          character_id: string
          created_at: string
          id: string
          metadata: Json
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          metadata?: Json
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          completed_at: string
          habit_id: number | null
          habit_name: string
          id: number
          kind: string
          local_date: string
          points: number
          user_id: string | null
        }
        Insert: {
          completed_at?: string
          habit_id?: number | null
          habit_name: string
          id?: number
          kind: string
          local_date: string
          points: number
          user_id?: string | null
        }
        Update: {
          completed_at?: string
          habit_id?: number | null
          habit_name?: string
          id?: number
          kind?: string
          local_date?: string
          points?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          due_at: string | null
          id: number
          kind: string
          linked_character: string | null
          name: string
          points_awarded: boolean
          streak: number | null
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: number
          kind?: string
          linked_character?: string | null
          name: string
          points_awarded?: boolean
          streak?: number | null
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: number
          kind?: string
          linked_character?: string | null
          name?: string
          points_awarded?: boolean
          streak?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          character_id: string
          content: string
          conversation_id: string | null
          created_at: string | null
          id: number
          metadata: Json
          sender: string
          user_id: string | null
        }
        Insert: {
          character_id: string
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: number
          metadata?: Json
          sender: string
          user_id?: string | null
        }
        Update: {
          character_id?: string
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: number
          metadata?: Json
          sender?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          approved_at: string | null
          conversation_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          schedule: Json
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          schedule?: Json
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          schedule?: Json
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      profile: {
        Row: {
          agent_workflows: Json
          biggest_challenge: string | null
          current_situation: string | null
          focus_sessions: number | null
          id: number
          level: number | null
          member_since: string | null
          name: string
          onboarding_completed: boolean
          onboarding_step: number
          phone_time: number | null
          phone_usage: string | null
          preferred_name: string | null
          primary_goal: string | null
          team_setup_completed_at: string | null
          user_id: string | null
          xp: number | null
        }
        Insert: {
          agent_workflows?: Json
          biggest_challenge?: string | null
          current_situation?: string | null
          focus_sessions?: number | null
          id?: number
          level?: number | null
          member_since?: string | null
          name: string
          onboarding_completed?: boolean
          onboarding_step?: number
          phone_time?: number | null
          phone_usage?: string | null
          preferred_name?: string | null
          primary_goal?: string | null
          team_setup_completed_at?: string | null
          user_id?: string | null
          xp?: number | null
        }
        Update: {
          agent_workflows?: Json
          biggest_challenge?: string | null
          current_situation?: string | null
          focus_sessions?: number | null
          id?: number
          level?: number | null
          member_since?: string | null
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          phone_time?: number | null
          phone_usage?: string | null
          preferred_name?: string | null
          primary_goal?: string | null
          team_setup_completed_at?: string | null
          user_id?: string | null
          xp?: number | null
        }
        Relationships: []
      }
      specialist_profiles: {
        Row: {
          answers: Json
          character_id: string
          completed_at: string | null
          created_at: string
          id: string
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          character_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          character_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_agent_workflow: {
        Args: { p_key: string; p_state: Json; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
