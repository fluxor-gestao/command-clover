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
      allergens: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      batch_ingredient_lots: {
        Row: {
          batch_id: string
          ingredient_id: string
          lot_id: string
          quantity: number
        }
        Insert: {
          batch_id: string
          ingredient_id: string
          lot_id: string
          quantity: number
        }
        Update: {
          batch_id?: string
          ingredient_id?: string
          lot_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_ingredient_lots_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_cost"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_labels"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "ingredient_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "v_stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ingredient_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["ingredient_lot_id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          address: string | null
          anonymized_at: string | null
          created_at: string
          customer_id: string
          delivery_notes: string | null
          full_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          anonymized_at?: string | null
          created_at?: string
          customer_id: string
          delivery_notes?: string | null
          full_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          anonymized_at?: string | null
          created_at?: string
          customer_id?: string
          delivery_notes?: string | null
          full_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          activity_level: string
          age_range: string | null
          allergies: string[]
          avoid_ingredient_ids: string[]
          consent_at: string | null
          customer_id: string
          delivery_weekdays: number[]
          goal: string
          height_cm: number | null
          meal_types: string[]
          personalization_mode: string
          preferences: string[]
          restrictions: string[]
          training_frequency: number | null
          training_type: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string
          age_range?: string | null
          allergies?: string[]
          avoid_ingredient_ids?: string[]
          consent_at?: string | null
          customer_id: string
          delivery_weekdays?: number[]
          goal?: string
          height_cm?: number | null
          meal_types?: string[]
          personalization_mode?: string
          preferences?: string[]
          restrictions?: string[]
          training_frequency?: number | null
          training_type?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string
          age_range?: string | null
          allergies?: string[]
          avoid_ingredient_ids?: string[]
          consent_at?: string | null
          customer_id?: string
          delivery_weekdays?: number[]
          goal?: string
          height_cm?: number | null
          meal_types?: string[]
          personalization_mode?: string
          preferences?: string[]
          restrictions?: string[]
          training_frequency?: number | null
          training_type?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      dish_items: {
        Row: {
          dish_id: string
          id: string
          ingredient_id: string
          prep_loss_pct: number | null
          quantity: number
        }
        Insert: {
          dish_id: string
          id?: string
          ingredient_id: string
          prep_loss_pct?: number | null
          quantity: number
        }
        Update: {
          dish_id?: string
          id?: string
          ingredient_id?: string
          prep_loss_pct?: number | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "dish_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_dish_facts"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "dish_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "dish_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "dish_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "dish_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "dish_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
        ]
      }
      dish_prices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cost_snapshot: Json
          created_at: string
          created_by: string | null
          dish_id: string
          id: string
          price: number
          status: string
          suggested_price: number | null
          valid_from: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cost_snapshot?: Json
          created_at?: string
          created_by?: string | null
          dish_id: string
          id?: string
          price: number
          status?: string
          suggested_price?: number | null
          valid_from?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cost_snapshot?: Json
          created_at?: string
          created_by?: string | null
          dish_id?: string
          id?: string
          price?: number
          status?: string
          suggested_price?: number | null
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_prices_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_prices_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_dish_facts"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "dish_prices_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "dish_prices_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["dish_id"]
          },
        ]
      }
      dishes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_note: string | null
          code: string | null
          created_at: string
          cross_contact_risk: string[]
          description: string | null
          final_yield_g: number
          id: string
          labor_minutes: number
          meal_type: string
          name: string
          packaging_cost: number
          packaging_desc: string | null
          portions: number
          product_line: string
          shelf_life_days: number
          status: string
          storage_instructions: string
          tags: string[]
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          change_note?: string | null
          code?: string | null
          created_at?: string
          cross_contact_risk?: string[]
          description?: string | null
          final_yield_g?: number
          id?: string
          labor_minutes?: number
          meal_type: string
          name: string
          packaging_cost?: number
          packaging_desc?: string | null
          portions?: number
          product_line?: string
          shelf_life_days?: number
          status?: string
          storage_instructions?: string
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_note?: string | null
          code?: string | null
          created_at?: string
          cross_contact_risk?: string[]
          description?: string | null
          final_yield_g?: number
          id?: string
          labor_minutes?: number
          meal_type?: string
          name?: string
          packaging_cost?: number
          packaging_desc?: string | null
          portions?: number
          product_line?: string
          shelf_life_days?: number
          status?: string
          storage_instructions?: string
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          category: string | null
          competence_date: string
          created_at: string
          created_by: string | null
          description: string
          direction: string
          due_date: string | null
          id: string
          kind: string
          nfe_import_id: string | null
          order_id: string | null
          payment_id: string | null
          payout_id: string | null
          settled_date: string | null
          status: string
          supplier_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          competence_date?: string
          created_at?: string
          created_by?: string | null
          description: string
          direction: string
          due_date?: string | null
          id?: string
          kind: string
          nfe_import_id?: string | null
          order_id?: string | null
          payment_id?: string | null
          payout_id?: string | null
          settled_date?: string | null
          status?: string
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          competence_date?: string
          created_at?: string
          created_by?: string | null
          description?: string
          direction?: string
          due_date?: string | null
          id?: string
          kind?: string
          nfe_import_id?: string | null
          order_id?: string | null
          payment_id?: string | null
          payout_id?: string | null
          settled_date?: string | null
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_nfe_import_id_fkey"
            columns: ["nfe_import_id"]
            isOneToOne: false
            referencedRelation: "nfe_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "financial_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "provider_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "v_payout_reconciliation"
            referencedColumns: ["payout_id"]
          },
          {
            foreignKeyName: "financial_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_lots: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          ingredient_id: string
          lot_code: string
          manufactured_at: string | null
          nfe_item_id: string | null
          notes: string | null
          quantity_on_hand: number
          quantity_received: number
          received_at: string
          status: string
          storage: string | null
          supplier_id: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          ingredient_id: string
          lot_code: string
          manufactured_at?: string | null
          nfe_item_id?: string | null
          notes?: string | null
          quantity_on_hand: number
          quantity_received: number
          received_at?: string
          status?: string
          storage?: string | null
          supplier_id?: string | null
          unit_cost?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          ingredient_id?: string
          lot_code?: string
          manufactured_at?: string | null
          nfe_item_id?: string | null
          notes?: string | null
          quantity_on_hand?: number
          quantity_received?: number
          received_at?: string
          status?: string
          storage?: string | null
          supplier_id?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "ingredient_lots_nfe_item_id_fkey"
            columns: ["nfe_item_id"]
            isOneToOne: false
            referencedRelation: "nfe_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          allergen_info_complete: boolean
          allergens: string[]
          carbs_per_100g: number
          conversion_factor: number
          created_at: string
          default_supplier_id: string | null
          fat_per_100g: number
          fiber_per_100g: number
          id: string
          kcal_per_100g: number
          may_contain: string[]
          name: string
          protein_per_100g: number
          purchase_unit: string
          sodium_mg_per_100g: number
          storage: string
          unit_cost: number
          updated_at: string
          usage_unit: string
          usage_unit_grams: number
          yield_pct: number
        }
        Insert: {
          active?: boolean
          allergen_info_complete?: boolean
          allergens?: string[]
          carbs_per_100g?: number
          conversion_factor?: number
          created_at?: string
          default_supplier_id?: string | null
          fat_per_100g?: number
          fiber_per_100g?: number
          id?: string
          kcal_per_100g?: number
          may_contain?: string[]
          name: string
          protein_per_100g?: number
          purchase_unit?: string
          sodium_mg_per_100g?: number
          storage?: string
          unit_cost?: number
          updated_at?: string
          usage_unit?: string
          usage_unit_grams?: number
          yield_pct?: number
        }
        Update: {
          active?: boolean
          allergen_info_complete?: boolean
          allergens?: string[]
          carbs_per_100g?: number
          conversion_factor?: number
          created_at?: string
          default_supplier_id?: string | null
          fat_per_100g?: number
          fiber_per_100g?: number
          id?: string
          kcal_per_100g?: number
          may_contain?: string[]
          name?: string
          protein_per_100g?: number
          purchase_unit?: string
          sodium_mg_per_100g?: number
          storage?: string
          unit_cost?: number
          updated_at?: string
          usage_unit?: string
          usage_unit_grams?: number
          yield_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      menu_cycle_days: {
        Row: {
          capacity_portions: number
          cycle_id: string
          delivery_date: string
          id: string
          production_date: string
        }
        Insert: {
          capacity_portions: number
          cycle_id: string
          delivery_date: string
          id?: string
          production_date: string
        }
        Update: {
          capacity_portions?: number
          cycle_id?: string
          delivery_date?: string
          id?: string
          production_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_cycle_days_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_cycles: {
        Row: {
          created_at: string
          cutoff_at: string
          id: string
          name: string
          sales_start: string
          status: string
        }
        Insert: {
          created_at?: string
          cutoff_at: string
          id?: string
          name: string
          sales_start: string
          status?: string
        }
        Update: {
          created_at?: string
          cutoff_at?: string
          id?: string
          name?: string
          sales_start?: string
          status?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          cycle_id: string
          dish_id: string
          id: string
          max_portions: number | null
        }
        Insert: {
          cycle_id: string
          dish_id: string
          id?: string
          max_portions?: number | null
        }
        Update: {
          cycle_id?: string
          dish_id?: string
          id?: string
          max_portions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_dish_facts"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "menu_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "menu_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["dish_id"]
          },
        ]
      }
      nfe_imports: {
        Row: {
          access_key: string | null
          checked_at: string | null
          checked_by: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          issued_at: string | null
          number: string | null
          raw_xml: string | null
          series: string | null
          status: string
          supplier_cnpj: string | null
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number | null
        }
        Insert: {
          access_key?: string | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          issued_at?: string | null
          number?: string | null
          raw_xml?: string | null
          series?: string | null
          status?: string
          supplier_cnpj?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
        }
        Update: {
          access_key?: string | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          issued_at?: string | null
          number?: string | null
          raw_xml?: string | null
          series?: string | null
          status?: string
          supplier_cnpj?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_imports_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_items: {
        Row: {
          conversion_factor: number | null
          description: string
          divergence_note: string | null
          id: string
          import_id: string
          ingredient_id: string | null
          item_number: number
          lots: Json
          ncm: string | null
          quantity: number
          status: string
          supplier_code: string | null
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          conversion_factor?: number | null
          description: string
          divergence_note?: string | null
          id?: string
          import_id: string
          ingredient_id?: string | null
          item_number: number
          lots?: Json
          ncm?: string | null
          quantity: number
          status?: string
          supplier_code?: string | null
          total: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          conversion_factor?: number | null
          description?: string
          divergence_note?: string | null
          id?: string
          import_id?: string
          ingredient_id?: string | null
          item_number?: number
          lots?: Json
          ncm?: string | null
          quantity?: number
          status?: string
          supplier_code?: string | null
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfe_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "nfe_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "nfe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "nfe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          kind: string
          message: string
          read_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          kind: string
          message: string
          read_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
        }
        Relationships: []
      }
      nutrition_parameters: {
        Row: {
          activity_level: string
          carbs_pct: number
          fat_pct: number
          goal: string
          kcal_per_kg: number
          protein_g_per_kg: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_level: string
          carbs_pct: number
          fat_pct: number
          goal: string
          kcal_per_kg: number
          protein_g_per_kg: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_level?: string
          carbs_pct?: number
          fat_pct?: number
          goal?: string
          kcal_per_kg?: number
          protein_g_per_kg?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      nutrition_plans: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          meal_distribution: Json
          notes: string | null
          origin: string
          portion_adjustments: Json
          profile_snapshot: Json
          published_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          substitutions: Json
          targets: Json
          version: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          meal_distribution?: Json
          notes?: string | null
          origin?: string
          portion_adjustments?: Json
          profile_snapshot?: Json
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          substitutions?: Json
          targets?: Json
          version: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          meal_distribution?: Json
          notes?: string | null
          origin?: string
          portion_adjustments?: Json
          profile_snapshot?: Json
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          substitutions?: Json
          targets?: Json
          version?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          cycle_day_id: string
          dish_id: string
          id: string
          meal_type: string
          order_id: string
          production_batch_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          cycle_day_id: string
          dish_id: string
          id?: string
          meal_type: string
          order_id: string
          production_batch_id?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          cycle_day_id?: string
          dish_id?: string
          id?: string
          meal_type?: string
          order_id?: string
          production_batch_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_batch_fk"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_batch_fk"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_cost"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "order_items_batch_fk"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_labels"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "order_items_batch_fk"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "order_items_cycle_day_id_fkey"
            columns: ["cycle_day_id"]
            isOneToOne: false
            referencedRelation: "menu_cycle_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_cycle_day_id_fkey"
            columns: ["cycle_day_id"]
            isOneToOne: false
            referencedRelation: "v_cycle_capacity"
            referencedColumns: ["cycle_day_id"]
          },
          {
            foreignKeyName: "order_items_cycle_day_id_fkey"
            columns: ["cycle_day_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["cycle_day_id"]
          },
          {
            foreignKeyName: "order_items_cycle_day_id_fkey"
            columns: ["cycle_day_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["cycle_day_id"]
          },
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_dish_facts"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          code: string
          created_at: string
          customer_id: string
          cycle_id: string
          delivery_address: string | null
          delivery_fee: number
          discount: number
          id: string
          needs_attention: string | null
          payment_method: string | null
          pricing_snapshot: Json
          status: string
          subscription_id: string | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          code?: string
          created_at?: string
          customer_id: string
          cycle_id: string
          delivery_address?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          needs_attention?: string | null
          payment_method?: string | null
          pricing_snapshot?: Json
          status?: string
          subscription_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          code?: string
          created_at?: string
          customer_id?: string
          cycle_id?: string
          delivery_address?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          needs_attention?: string | null
          payment_method?: string | null
          pricing_snapshot?: Json
          status?: string
          subscription_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          event_id: string
          id: string
          payload: Json | null
          provider: string
          provider_charge_id: string | null
          received_at: string
          result: string | null
          status: string
        }
        Insert: {
          event_id: string
          id?: string
          payload?: Json | null
          provider: string
          provider_charge_id?: string | null
          received_at?: string
          result?: string | null
          status: string
        }
        Update: {
          event_id?: string
          id?: string
          payload?: Json | null
          provider?: string
          provider_charge_id?: string | null
          received_at?: string
          result?: string | null
          status?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          attempts: number
          created_at: string
          customer_id: string
          expires_at: string | null
          fee_amount: number
          id: string
          method: string
          net_amount: number | null
          next_retry_at: string | null
          order_id: string
          paid_at: string | null
          payout_id: string | null
          provider: string
          provider_charge_id: string
          receipt_url: string | null
          refunded_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          attempts?: number
          created_at?: string
          customer_id: string
          expires_at?: string | null
          fee_amount?: number
          id?: string
          method: string
          net_amount?: number | null
          next_retry_at?: string | null
          order_id: string
          paid_at?: string | null
          payout_id?: string | null
          provider?: string
          provider_charge_id: string
          receipt_url?: string | null
          refunded_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          attempts?: number
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          fee_amount?: number
          id?: string
          method?: string
          net_amount?: number | null
          next_retry_at?: string | null
          order_id?: string
          paid_at?: string | null
          payout_id?: string | null
          provider?: string
          provider_charge_id?: string
          receipt_url?: string | null
          refunded_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "provider_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "v_payout_reconciliation"
            referencedColumns: ["payout_id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          avg_portions_per_order: number
          business_name: string
          card_fee_pct: number
          delivery_cost_per_order: number
          delivery_included_in_price: boolean
          delivery_price: number
          expiry_alert_days: number
          id: boolean
          labor_cost_per_hour: number
          min_margin_pct: number
          payment_max_retries: number
          payment_retry_hours: number
          pix_expiration_minutes: number
          pix_fee_pct: number
          release_reservation_on_failure: boolean
          target_margin_pct: number
          tax_pct: number
          updated_at: string
        }
        Insert: {
          avg_portions_per_order?: number
          business_name?: string
          card_fee_pct?: number
          delivery_cost_per_order?: number
          delivery_included_in_price?: boolean
          delivery_price?: number
          expiry_alert_days?: number
          id?: boolean
          labor_cost_per_hour?: number
          min_margin_pct?: number
          payment_max_retries?: number
          payment_retry_hours?: number
          pix_expiration_minutes?: number
          pix_fee_pct?: number
          release_reservation_on_failure?: boolean
          target_margin_pct?: number
          tax_pct?: number
          updated_at?: string
        }
        Update: {
          avg_portions_per_order?: number
          business_name?: string
          card_fee_pct?: number
          delivery_cost_per_order?: number
          delivery_included_in_price?: boolean
          delivery_price?: number
          expiry_alert_days?: number
          id?: boolean
          labor_cost_per_hour?: number
          min_margin_pct?: number
          payment_max_retries?: number
          payment_retry_hours?: number
          pix_expiration_minutes?: number
          pix_fee_pct?: number
          release_reservation_on_failure?: boolean
          target_margin_pct?: number
          tax_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
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
      privacy_requests: {
        Row: {
          created_at: string
          customer_id: string
          details: string | null
          id: string
          kind: string
          resolved_at: string | null
          resolved_by: string | null
          response: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          details?: string | null
          id?: string
          kind: string
          resolved_at?: string | null
          resolved_by?: string | null
          response?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          details?: string | null
          id?: string
          kind?: string
          resolved_at?: string | null
          resolved_by?: string | null
          response?: string | null
          status?: string
        }
        Relationships: []
      }
      production_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          cycle_day_id: string
          dish_id: string
          dish_version: number
          expires_at: string
          id: string
          lot_code: string
          portions_planned: number
          portions_produced: number | null
          produced_by: string | null
          production_date: string
          status: string
          storage_instructions: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cycle_day_id: string
          dish_id: string
          dish_version: number
          expires_at: string
          id?: string
          lot_code: string
          portions_planned: number
          portions_produced?: number | null
          produced_by?: string | null
          production_date: string
          status?: string
          storage_instructions: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cycle_day_id?: string
          dish_id?: string
          dish_version?: number
          expires_at?: string
          id?: string
          lot_code?: string
          portions_planned?: number
          portions_produced?: number | null
          produced_by?: string | null
          production_date?: string
          status?: string
          storage_instructions?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_cycle_day_id_fkey"
            columns: ["cycle_day_id"]
            isOneToOne: false
            referencedRelation: "menu_cycle_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_cycle_day_id_fkey"
            columns: ["cycle_day_id"]
            isOneToOne: false
            referencedRelation: "v_cycle_capacity"
            referencedColumns: ["cycle_day_id"]
          },
          {
            foreignKeyName: "production_batches_cycle_day_id_fkey"
            columns: ["cycle_day_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["cycle_day_id"]
          },
          {
            foreignKeyName: "production_batches_cycle_day_id_fkey"
            columns: ["cycle_day_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["cycle_day_id"]
          },
          {
            foreignKeyName: "production_batches_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_dish_facts"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "production_batches_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "production_batches_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["dish_id"]
          },
        ]
      }
      provider_payouts: {
        Row: {
          created_at: string
          fee_amount: number
          gross_amount: number
          id: string
          net_amount: number
          payout_date: string
          payout_ref: string
          provider: string
          refund_amount: number
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          payout_date: string
          payout_ref: string
          provider?: string
          refund_amount?: number
        }
        Update: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          payout_date?: string
          payout_ref?: string
          provider?: string
          refund_amount?: number
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          id: string
          ingredient_id: string
          purchase_order_id: string
          quantity: number
          quantity_received: number
          unit_cost: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          purchase_order_id: string
          quantity: number
          quantity_received?: number
          unit_cost?: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          purchase_order_id?: string
          quantity?: number
          quantity_received?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "purchase_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "purchase_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string
          id: string
          notes: string | null
          status: string
          supplier_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date: string
          id?: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string
          id?: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          ingredient_id: string
          kind: string
          lot_id: string | null
          quantity: number
          reason: string | null
          reference: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          ingredient_id: string
          kind: string
          lot_id?: string | null
          quantity: number
          reason?: string | null
          reference?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          ingredient_id?: string
          kind?: string
          lot_id?: string | null
          quantity?: number
          reason?: string | null
          reference?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "ingredient_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "v_stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["ingredient_lot_id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          lot_id: string | null
          needed_by: string
          order_id: string
          order_item_id: string
          purchase_item_id: string | null
          quantity: number
          released_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          lot_id?: string | null
          needed_by: string
          order_id: string
          order_item_id: string
          purchase_item_id?: string | null
          quantity: number
          released_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          lot_id?: string | null
          needed_by?: string
          order_id?: string
          order_item_id?: string
          purchase_item_id?: string | null
          quantity?: number
          released_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "stock_reservations_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "stock_reservations_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "stock_reservations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "ingredient_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "v_stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["ingredient_lot_id"]
          },
          {
            foreignKeyName: "stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_reservations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "stock_reservations_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_cycles: {
        Row: {
          cycle_id: string
          id: string
          note: string | null
          order_id: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          cycle_id: string
          id?: string
          note?: string | null
          order_id?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          cycle_id?: string
          id?: string
          note?: string | null
          order_id?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cycles_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cycles_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cycles_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "subscription_cycles_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          meal_types: string[]
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          meal_types?: string[]
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          meal_types?: string[]
          name?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          customer_id: string
          id: string
          kit_template: Json
          paused_until: string | null
          payment_method: string
          plan_id: string
          provider_subscription_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          kit_template?: Json
          paused_until?: string | null
          payment_method?: string
          plan_id: string
          provider_subscription_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          kit_template?: Json
          paused_until?: string | null
          payment_method?: string
          plan_id?: string
          provider_subscription_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_item_map: {
        Row: {
          conversion_factor: number
          ingredient_id: string
          supplier_code: string
          supplier_id: string
        }
        Insert: {
          conversion_factor: number
          ingredient_id: string
          supplier_code: string
          supplier_id: string
        }
        Update: {
          conversion_factor?: number
          ingredient_id?: string
          supplier_code?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_item_map_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_item_map_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "supplier_item_map_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "supplier_item_map_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "supplier_item_map_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          cnpj: string | null
          contact: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          cnpj?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          cnpj?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
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
      v_batch_cost: {
        Row: {
          actual_cost: number | null
          batch_id: string | null
          dish_id: string | null
          expected_cost: number | null
          lot_code: string | null
          portions: number | null
          portions_planned: number | null
          production_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_dish_facts"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "production_batches_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "production_batches_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["dish_id"]
          },
        ]
      }
      v_batch_labels: {
        Row: {
          allergens: string[] | null
          batch_id: string | null
          carbs_g: number | null
          delivery_date: string | null
          dish_name: string | null
          expires_at: string | null
          fat_g: number | null
          kcal: number | null
          lot_code: string | null
          may_contain: string[] | null
          meal_type: string | null
          portion_weight_g: number | null
          portions_planned: number | null
          portions_produced: number | null
          production_date: string | null
          protein_g: number | null
          status: string | null
          storage_instructions: string | null
        }
        Relationships: []
      }
      v_cycle_capacity: {
        Row: {
          capacity_portions: number | null
          cycle_day_id: string | null
          cycle_id: string | null
          delivery_date: string | null
          production_date: string | null
          used_portions: number | null
        }
        Insert: {
          capacity_portions?: number | null
          cycle_day_id?: string | null
          cycle_id?: string | null
          delivery_date?: string | null
          production_date?: string | null
          used_portions?: never
        }
        Update: {
          capacity_portions?: number | null
          cycle_day_id?: string | null
          cycle_id?: string | null
          delivery_date?: string | null
          production_date?: string | null
          used_portions?: never
        }
        Relationships: [
          {
            foreignKeyName: "menu_cycle_days_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dish_facts: {
        Row: {
          allergen_info_incomplete: boolean | null
          allergens: string[] | null
          carbs_g: number | null
          code: string | null
          cost_per_portion: number | null
          dish_id: string | null
          fat_g: number | null
          fiber_g: number | null
          final_yield_g: number | null
          ingredient_cost_per_portion: number | null
          kcal: number | null
          labor_cost_per_portion: number | null
          may_contain: string[] | null
          meal_type: string | null
          name: string | null
          packaging_cost_per_portion: number | null
          portion_weight_g: number | null
          portions: number | null
          protein_g: number | null
          sodium_mg: number | null
          status: string | null
          version: number | null
        }
        Relationships: []
      }
      v_dish_margin: {
        Row: {
          dish_id: string | null
          dish_name: string | null
          expected_cost: number | null
          gross_margin: number | null
          month: string | null
          portions: number | null
          revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_dish_facts"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["dish_id"]
          },
        ]
      }
      v_finance_payments: {
        Row: {
          amount: number | null
          attempts: number | null
          cash_status: string | null
          created_at: string | null
          customer_id: string | null
          cycle_id: string | null
          expires_at: string | null
          fee_amount: number | null
          id: string | null
          method: string | null
          net_amount: number | null
          next_retry_at: string | null
          order_code: string | null
          order_id: string | null
          paid_at: string | null
          payout_date: string | null
          payout_id: string | null
          payout_ref: string | null
          provider: string | null
          provider_charge_id: string | null
          receipt_url: string | null
          refunded_at: string | null
          status: string | null
          subscription_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trace"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "provider_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "v_payout_reconciliation"
            referencedColumns: ["payout_id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
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
          installment_count: number | null
          installment_value: number | null
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
      v_payout_reconciliation: {
        Row: {
          deposited_net: number | null
          difference: number | null
          expected_net: number | null
          payments: number | null
          payout_date: string | null
          payout_id: string | null
          payout_ref: string | null
          provider: string | null
          reported_fees: number | null
          reported_gross: number | null
          reported_refunds: number | null
          sales_fees: number | null
          sales_gross: number | null
          sales_refunds: number | null
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
      v_production_ingredients: {
        Row: {
          cycle_day_id: string | null
          cycle_id: string | null
          dish_id: string | null
          dish_name: string | null
          gross_quantity: number | null
          ingredient_id: string | null
          ingredient_name: string | null
          portions: number | null
          prep_loss_pct: number | null
          production_date: string | null
          usage_unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_cycle_days_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_production_plan: {
        Row: {
          batch_id: string | null
          batch_lot_code: string | null
          batch_status: string | null
          cycle_day_id: string | null
          cycle_id: string | null
          delivery_date: string | null
          dish_id: string | null
          dish_name: string | null
          meal_type: string | null
          orders: number | null
          portions: number | null
          production_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_cycle_days_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
        ]
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
      v_shopping_list: {
        Row: {
          awaiting_purchase: number | null
          consumed: number | null
          conversion_factor: number | null
          cycle_id: string | null
          first_needed_by: string | null
          ingredient_id: string | null
          ingredient_name: string | null
          needed: number | null
          purchase_unit: string | null
          reserved_in_stock: number | null
          usage_unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "menu_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_ingredients: {
        Row: {
          available: number | null
          expired: number | null
          expiring_soon: number | null
          ingredient_id: string | null
          name: string | null
          pending_purchase: number | null
          physical: number | null
          reserved: number | null
          reserved_on_purchase: number | null
          unit_cost: number | null
          usage_unit: string | null
        }
        Relationships: []
      }
      v_stock_lots: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          expiring_soon: boolean | null
          id: string | null
          ingredient_id: string | null
          ingredient_name: string | null
          is_expired: boolean | null
          lot_code: string | null
          manufactured_at: string | null
          nfe_item_id: string | null
          notes: string | null
          quantity_available: number | null
          quantity_on_hand: number | null
          quantity_received: number | null
          quantity_reserved: number | null
          received_at: string | null
          status: string | null
          storage: string | null
          supplier_id: string | null
          supplier_name: string | null
          unit_cost: number | null
          usage_unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_shopping_list"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "ingredient_lots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "v_stock_ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "ingredient_lots_nfe_item_id_fkey"
            columns: ["nfe_item_id"]
            isOneToOne: false
            referencedRelation: "nfe_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_trace: {
        Row: {
          batch_expires_at: string | null
          batch_id: string | null
          batch_lot_code: string | null
          batch_lot_quantity: number | null
          customer_id: string | null
          delivery_date: string | null
          dish_name: string | null
          ingredient_lot_code: string | null
          ingredient_lot_expires_at: string | null
          ingredient_lot_id: string | null
          ingredient_name: string | null
          order_code: string | null
          order_id: string | null
          order_item_id: string | null
          order_status: string | null
          production_date: string | null
          supplier_name: string | null
        }
        Relationships: []
      }
      v_upcoming_price_changes: {
        Row: {
          current_price: number | null
          dish_id: string | null
          dish_name: string | null
          new_price: number | null
          valid_from: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dish_prices_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_prices_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_dish_facts"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "dish_prices_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_ingredients"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "dish_prices_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "v_production_plan"
            referencedColumns: ["dish_id"]
          },
        ]
      }
    }
    Functions: {
      _create_order: {
        Args: {
          p_customer_id: string
          p_cycle_id: string
          p_items: Json
          p_payment_method: string
          p_subscription_id?: string
        }
        Returns: string
      }
      _finish_nfe_if_done: { Args: { p_import_id: string }; Returns: undefined }
      _generate_plan_proposal: {
        Args: { p_customer_id: string; p_origin: string }
        Returns: string
      }
      _reallocate_pending_reservations: {
        Args: { p_ingredient_id: string }
        Returns: undefined
      }
      _receive_lot: {
        Args: {
          p_expires_at: string
          p_ingredient_id: string
          p_lot_code: string
          p_manufactured_at: string
          p_nfe_item_id: string
          p_qty_usage: number
          p_reference: string
          p_storage: string
          p_supplier_id: string
          p_unit_cost: number
        }
        Returns: string
      }
      _release_order_reservations: {
        Args: { p_order_id: string }
        Returns: number
      }
      _reserve_ingredient: {
        Args: {
          p_ingredient_id: string
          p_needed_by: string
          p_order_id: string
          p_order_item_id: string
          p_qty: number
        }
        Returns: undefined
      }
      anonymize_customer: {
        Args: { p_customer_id: string; p_request_id?: string }
        Returns: undefined
      }
      approve_dish: { Args: { p_dish_id: string }; Returns: undefined }
      approve_dish_price: {
        Args: { p_approve?: boolean; p_price_id: string }
        Returns: undefined
      }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_receipt: { Args: { p_receipt_id: string }; Returns: undefined }
      check_sync_conflict: {
        Args: { p_incoming_hash: string; p_operation_id: string }
        Returns: string
      }
      clear_portfolio_data: { Args: { p_year: number }; Returns: undefined }
      close_cycle: { Args: { p_cycle_id: string }; Returns: Json }
      complete_batch: {
        Args: { p_batch_id: string; p_portions_produced: number }
        Returns: undefined
      }
      confirm_nfe_item: {
        Args: {
          p_conversion_factor: number
          p_divergence_note?: string
          p_ingredient_id: string
          p_item_id: string
          p_lots: Json
        }
        Returns: undefined
      }
      current_dish_price: {
        Args: { p_dish_id: string; p_on?: string }
        Returns: {
          price: number
          price_id: string
        }[]
      }
      dashboard_metrics: { Args: never; Returns: Json }
      dish_compatibility: {
        Args: { p_customer_id: string; p_dish_id: string }
        Returns: {
          compatible: boolean
          reason: string
        }[]
      }
      dish_public_details: { Args: { p_dish_id: string }; Returns: Json }
      dish_stock_ok: {
        Args: { p_dish_id: string; p_needed_by: string; p_portions: number }
        Returns: boolean
      }
      eligible_dishes: {
        Args: { p_cycle_day_id: string; p_meal_type?: string }
        Returns: {
          allergens: string[]
          carbs_g: number
          compatible: boolean
          description: string
          dish_id: string
          dish_name: string
          fat_g: number
          kcal: number
          may_contain: string[]
          meal_type: string
          portion_weight_g: number
          price: number
          protein_g: number
          reason: string
          remaining: number
          tags: string[]
        }[]
      }
      eligible_dishes_for: {
        Args: {
          p_customer_id: string
          p_cycle_day_id: string
          p_meal_type?: string
        }
        Returns: {
          allergens: string[]
          carbs_g: number
          compatible: boolean
          description: string
          dish_id: string
          dish_name: string
          fat_g: number
          kcal: number
          may_contain: string[]
          meal_type: string
          portion_weight_g: number
          price: number
          protein_g: number
          reason: string
          remaining: number
          tags: string[]
        }[]
      }
      ensure_my_customer_records: { Args: never; Returns: undefined }
      expire_overdue_payments: { Args: never; Returns: number }
      export_my_data: { Args: never; Returns: Json }
      generate_schedule: { Args: { p_operation_id: string }; Returns: number }
      generate_subscription_orders: {
        Args: { p_cycle_id: string }
        Returns: Json
      }
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
      has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["platform_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ignore_nfe_item: {
        Args: { p_item_id: string; p_note: string }
        Returns: undefined
      }
      import_nfe: {
        Args: { p_header: Json; p_items: Json; p_raw_xml: string }
        Returns: string
      }
      ingredient_names: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      is_staff: { Args: never; Returns: boolean }
      kitchen_restrictions: {
        Args: { p_cycle_day_id: string }
        Returns: {
          allergies: string[]
          customer_label: string
          dish_name: string
          order_code: string
          quantity: number
          restrictions: string[]
        }[]
      }
      list_platform_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          last_sign_in_at: string
          roles: Database["public"]["Enums"]["platform_role"][]
          user_id: string
        }[]
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      my_plan_status: { Args: never; Returns: Json }
      my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["platform_role"][]
      }
      nutrition_review_queue: {
        Args: never
        Returns: {
          created_at: string
          customer_id: string
          customer_name: string
          origin: string
          plan_id: string
          published_version: number
          status: string
          targets: Json
          version: number
        }[]
      }
      place_order: {
        Args: {
          p_cycle_id: string
          p_items: Json
          p_payment_method: string
          p_subscription_id?: string
        }
        Returns: string
      }
      price_breakdown: {
        Args: { p_discount_pct?: number; p_dish_id: string }
        Returns: Json
      }
      process_payment_event: {
        Args: {
          p_amount?: number
          p_charge_id: string
          p_event_id: string
          p_fee?: number
          p_payload?: Json
          p_provider: string
          p_receipt_url?: string
          p_status: string
        }
        Returns: Json
      }
      propose_dish_price: {
        Args: { p_dish_id: string; p_price: number; p_valid_from?: string }
        Returns: string
      }
      receive_manual_lot: {
        Args: {
          p_expires_at: string
          p_ingredient_id: string
          p_lot_code: string
          p_manufactured_at?: string
          p_quantity_purchase_unit: number
          p_storage?: string
          p_supplier_id: string
          p_total_cost: number
        }
        Returns: string
      }
      register_payout: {
        Args: {
          p_net_amount: number
          p_payment_ids: string[]
          p_payout_date: string
          p_payout_ref: string
        }
        Returns: string
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
      register_stock_movement: {
        Args: {
          p_kind: string
          p_lot_id: string
          p_quantity: number
          p_reason: string
        }
        Returns: Json
      }
      request_nutrition_plan: { Args: never; Returns: string }
      review_nutrition_plan: {
        Args: {
          p_meal_distribution: Json
          p_notes: string
          p_plan_id: string
          p_portion_adjustments: Json
          p_publish?: boolean
          p_substitutions: Json
          p_targets: Json
        }
        Returns: undefined
      }
      revise_nutrition_plan: { Args: { p_plan_id: string }; Returns: string }
      seed_demo_data: { Args: never; Returns: Json }
      set_lot_blocked: {
        Args: { p_blocked: boolean; p_lot_id: string; p_reason: string }
        Returns: undefined
      }
      set_order_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: undefined
      }
      set_subscription_status: {
        Args: { p_action: string; p_subscription_id: string; p_until?: string }
        Returns: undefined
      }
      set_user_roles: {
        Args: {
          p_roles: Database["public"]["Enums"]["platform_role"][]
          p_user_id: string
        }
        Returns: undefined
      }
      skip_subscription_cycle: {
        Args: { p_cycle_id: string; p_subscription_id: string }
        Returns: undefined
      }
      start_production: {
        Args: { p_cycle_day_id: string; p_dish_id: string }
        Returns: string
      }
      subscribe: {
        Args: {
          p_kit_template?: Json
          p_payment_method: string
          p_plan_id: string
        }
        Returns: string
      }
      suggest_kit: {
        Args: { p_cycle_id: string }
        Returns: {
          cycle_day_id: string
          delivery_date: string
          dish_id: string
          dish_name: string
          meal_type: string
          price: number
        }[]
      }
      suggest_kit_for: {
        Args: { p_customer_id: string; p_cycle_id: string }
        Returns: {
          cycle_day_id: string
          delivery_date: string
          dish_id: string
          dish_name: string
          meal_type: string
          price: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      platform_role:
        | "admin"
        | "operacao"
        | "cozinha"
        | "financeiro"
        | "nutricionista"
        | "cliente"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      platform_role: [
        "admin",
        "operacao",
        "cozinha",
        "financeiro",
        "nutricionista",
        "cliente",
      ],
    },
  },
} as const
