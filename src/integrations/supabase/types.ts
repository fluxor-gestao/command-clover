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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      investment_audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      investment_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      investment_contributions: {
        Row: {
          amount: number
          cancelled_at: string | null
          contribution_date: string
          created_at: string
          created_by: string | null
          id: string
          last_synced_at: string | null
          notes: string | null
          operation_id: string
          source: string
          source_hash: string | null
          source_key: string | null
          type: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          contribution_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_synced_at?: string | null
          notes?: string | null
          operation_id: string
          source?: string
          source_hash?: string | null
          source_key?: string | null
          type?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          contribution_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_synced_at?: string | null
          notes?: string | null
          operation_id?: string
          source?: string
          source_hash?: string | null
          source_key?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_contributions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "investment_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_contributions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_operation_position"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      investment_import_issues: {
        Row: {
          created_at: string
          description: string
          id: string
          import_id: string | null
          issue_type: string
          operation_id: string | null
          raw_data: Json | null
          reference: string | null
          resolved_at: string | null
          source_row: string | null
          source_sheet: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          import_id?: string | null
          issue_type: string
          operation_id?: string | null
          raw_data?: Json | null
          reference?: string | null
          resolved_at?: string | null
          source_row?: string | null
          source_sheet?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          import_id?: string | null
          issue_type?: string
          operation_id?: string | null
          raw_data?: Json | null
          reference?: string | null
          resolved_at?: string | null
          source_row?: string | null
          source_sheet?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_import_issues_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "investment_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_import_issues_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "investment_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_import_issues_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_operation_position"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      investment_imports: {
        Row: {
          created_at: string
          created_by: string | null
          filename: string
          fingerprint: string | null
          finished_at: string | null
          id: string
          mode: string
          rows_error: number
          rows_existing: number
          rows_imported: number
          rows_pending: number
          rows_processed: number
          status: string
          summary: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filename: string
          fingerprint?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          rows_error?: number
          rows_existing?: number
          rows_imported?: number
          rows_pending?: number
          rows_processed?: number
          status?: string
          summary?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filename?: string
          fingerprint?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          rows_error?: number
          rows_existing?: number
          rows_imported?: number
          rows_pending?: number
          rows_processed?: number
          status?: string
          summary?: Json | null
        }
        Relationships: []
      }
      investment_installments: {
        Row: {
          competence: string
          created_at: string
          due_date: string
          expected_amount: number
          id: string
          installment_number: number
          operation_id: string
          received_amount: number
          source: string
          source_key: string | null
          status: string
          updated_at: string
        }
        Insert: {
          competence: string
          created_at?: string
          due_date: string
          expected_amount?: number
          id?: string
          installment_number: number
          operation_id: string
          received_amount?: number
          source?: string
          source_key?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          competence?: string
          created_at?: string
          due_date?: string
          expected_amount?: number
          id?: string
          installment_number?: number
          operation_id?: string
          received_amount?: number
          source?: string
          source_key?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_installments_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "investment_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_installments_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_operation_position"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      investment_operations: {
        Row: {
          cancelled_at: string | null
          category_id: string | null
          contracted_total: number | null
          created_at: string
          description: string | null
          due_day: number | null
          first_due_date: string | null
          id: string
          import_status: string
          initial_capital: number
          installment_count: number | null
          installment_value: number | null
          investment_date: string | null
          is_own_property: boolean
          last_due_date: string | null
          last_synced_at: string | null
          notes: string | null
          reference: string
          reference_id: string | null
          source: string
          source_hash: string | null
          source_key: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          category_id?: string | null
          contracted_total?: number | null
          created_at?: string
          description?: string | null
          due_day?: number | null
          first_due_date?: string | null
          id?: string
          import_status?: string
          initial_capital?: number
          installment_count?: number | null
          installment_value?: number | null
          investment_date?: string | null
          is_own_property?: boolean
          last_due_date?: string | null
          last_synced_at?: string | null
          notes?: string | null
          reference: string
          reference_id?: string | null
          source?: string
          source_hash?: string | null
          source_key?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          category_id?: string | null
          contracted_total?: number | null
          created_at?: string
          description?: string | null
          due_day?: number | null
          first_due_date?: string | null
          id?: string
          import_status?: string
          initial_capital?: number
          installment_count?: number | null
          installment_value?: number | null
          investment_date?: string | null
          is_own_property?: boolean
          last_due_date?: string | null
          last_synced_at?: string | null
          notes?: string | null
          reference?: string
          reference_id?: string | null
          source?: string
          source_hash?: string | null
          source_key?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_operations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "investment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_operations_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "investment_references"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_receipt_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          installment_id: string
          receipt_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          installment_id: string
          receipt_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          installment_id?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_receipt_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "investment_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_receipt_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "investment_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_receipts: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          id: string
          last_synced_at: string | null
          notes: string | null
          operation_id: string
          receipt_date: string
          source: string
          source_hash: string | null
          source_key: string | null
          total_amount: number
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_synced_at?: string | null
          notes?: string | null
          operation_id: string
          receipt_date: string
          source?: string
          source_hash?: string | null
          source_key?: string | null
          total_amount: number
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_synced_at?: string | null
          notes?: string | null
          operation_id?: string
          receipt_date?: string
          source?: string
          source_hash?: string | null
          source_key?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_receipts_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "investment_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_receipts_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_operation_position"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      investment_references: {
        Row: {
          active: boolean | null
          archived_at: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          source: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_references_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "investment_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_memberships: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          operation_id: string
          portfolio_year: number
          source: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          operation_id: string
          portfolio_year: number
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          operation_id?: string
          portfolio_year?: number
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_memberships_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "investment_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_memberships_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_operation_position"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      rental_properties: {
        Row: {
          contract_end: string | null
          contract_start: string | null
          created_at: string
          current_rent: number
          due_day: number | null
          id: string
          last_synced_at: string | null
          name: string
          next_adjustment_date: string | null
          notes: string | null
          reference_id: string | null
          source: string
          source_hash: string | null
          source_key: string | null
          status: string
          tenant_name: string | null
          updated_at: string
        }
        Insert: {
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          current_rent?: number
          due_day?: number | null
          id?: string
          last_synced_at?: string | null
          name: string
          next_adjustment_date?: string | null
          notes?: string | null
          reference_id?: string | null
          source?: string
          source_hash?: string | null
          source_key?: string | null
          status?: string
          tenant_name?: string | null
          updated_at?: string
        }
        Update: {
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          current_rent?: number
          due_day?: number | null
          id?: string
          last_synced_at?: string | null
          name?: string
          next_adjustment_date?: string | null
          notes?: string | null
          reference_id?: string | null
          source?: string
          source_hash?: string | null
          source_key?: string | null
          status?: string
          tenant_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_properties_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "investment_references"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_receipts: {
        Row: {
          amount: number
          cancelled_at: string | null
          competence: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          property_id: string
          receipt_date: string
          source: string
          source_key: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          competence: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          property_id: string
          receipt_date?: string
          source?: string
          source_key?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          competence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          receipt_date?: string
          source?: string
          source_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_receipts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "rental_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_receipts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_rental_position"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          filename: string
          id: string
          mode: string
          source_fingerprint: string | null
          status: string
          summary: Json | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          filename: string
          id?: string
          mode?: string
          source_fingerprint?: string | null
          status?: string
          summary?: Json | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          filename?: string
          id?: string
          mode?: string
          source_fingerprint?: string | null
          status?: string
          summary?: Json | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_installments: {
        Row: {
          category: string | null
          competence: string | null
          created_at: string | null
          days_overdue: number | null
          due_date: string | null
          expected_amount: number | null
          financial_status: string | null
          id: string | null
          installment_number: number | null
          operation_id: string | null
          outstanding_amount: number | null
          payment_status: string | null
          received_amount: number | null
          reference: string | null
          source: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_installments_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "investment_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_installments_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_operation_position"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      v_monthly_flow: {
        Row: {
          competence: string | null
          difference: number | null
          expected: number | null
          future_receivable: number | null
          installments_count: number | null
          overdue: number | null
          realization_percentage: number | null
          received: number | null
        }
        Relationships: []
      }
      v_operation_position: {
        Row: {
          capital_to_recover: number | null
          category: string | null
          financial_status: string | null
          future_receivable: number | null
          initial_capital: number | null
          last_installment_due: string | null
          operation_id: string | null
          outstanding_amount: number | null
          overdue_installments: number | null
          overdue_receivable: number | null
          recovery_percentage: number | null
          reference: string | null
          total_contributions: number | null
          total_invested: number | null
          total_received: number | null
        }
        Relationships: []
      }
      v_portfolio_memberships: {
        Row: {
          category_name: string | null
          created_at: string | null
          id: string | null
          initial_capital: number | null
          investment_date: string | null
          is_active: boolean | null
          operation_id: string | null
          operation_status: string | null
          portfolio_year: number | null
          reference: string | null
          reference_name: string | null
          source: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_memberships_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "investment_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_memberships_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_operation_position"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      v_portfolio_summary: {
        Row: {
          capital_to_recover: number | null
          closed_operations: number | null
          future_receivable: number | null
          overdue_installments: number | null
          overdue_operations: number | null
          overdue_receivable: number | null
          projected_result: number | null
          realized_profit: number | null
          recovery_percentage: number | null
          review_operations: number | null
          total_a_receber: number | null
          total_installments: number | null
          total_invested: number | null
          total_operations: number | null
          total_previsto_carteira: number | null
          total_received: number | null
        }
        Relationships: []
      }
      v_rental_position: {
        Row: {
          contract_end: string | null
          contract_start: string | null
          created_at: string | null
          current_rent: number | null
          due_day: number | null
          id: string | null
          last_synced_at: string | null
          name: string | null
          next_adjustment_date: string | null
          notes: string | null
          receivable_year: number | null
          received_year: number | null
          reference_id: string | null
          source: string | null
          source_hash: string | null
          source_key: string | null
          status: string | null
          tenant_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_properties_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "investment_references"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_receipt: { Args: { p_receipt_id: string }; Returns: undefined }
      check_sync_conflict: {
        Args: { p_incoming_hash: string; p_operation_id: string }
        Returns: string
      }
      clear_portfolio_data: { Args: { p_year: number }; Returns: undefined }
      generate_schedule: { Args: { p_operation_id: string }; Returns: number }
      get_overdue_breakdown: {
        Args: { p_cutoff_competence?: string; p_year?: number }
        Returns: {
          amount: number
          competence: string
          reference: string
        }[]
      }
      get_portfolio_metrics:
        | { Args: { p_year?: number }; Returns: Json[] }
        | {
            Args: { p_cutoff_competence?: string; p_year?: number }
            Returns: Json
          }
        | {
            Args: { p_management_mode?: boolean; p_year?: number }
            Returns: Json
          }
      get_portfolio_projection: {
        Args: { p_year?: number }
        Returns: {
          competence: string
          expected: number
          future_receivable: number
          installments_count: number
          overdue: number
          received: number
        }[]
      }
      get_portfolio_years: {
        Args: never
        Returns: {
          year: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      register_receipt: {
        Args: {
          p_allocations: Json
          p_notes?: string
          p_operation_id: string
          p_receipt_date: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
