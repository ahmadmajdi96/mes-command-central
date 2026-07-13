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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          at: string
          detail: string | null
          entity: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          at?: string
          detail?: string | null
          entity: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          at?: string
          detail?: string | null
          entity?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      batches: {
        Row: {
          completed_at: string | null
          created_at: string
          expiry_date: string | null
          id: string
          lot_code: string | null
          notes: string | null
          number: string | null
          product_id: string | null
          production_order_id: string | null
          qty: number
          qty_good: number
          qty_scrap: number
          started_at: string | null
          status: Database["public"]["Enums"]["batch_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          lot_code?: string | null
          notes?: string | null
          number?: string | null
          product_id?: string | null
          production_order_id?: string | null
          qty?: number
          qty_good?: number
          qty_scrap?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          lot_code?: string | null
          notes?: string | null
          number?: string | null
          product_id?: string | null
          production_order_id?: string | null
          qty?: number
          qty_good?: number
          qty_scrap?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          code: string | null
          contact: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      downtime_events: {
        Row: {
          category: string | null
          created_at: string
          ended_at: string | null
          external_id: string | null
          id: string
          minutes: number | null
          notes: string | null
          reason: string
          started_at: string
          updated_at: string
          work_order_id: string | null
          workstation: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          ended_at?: string | null
          external_id?: string | null
          id?: string
          minutes?: number | null
          notes?: string | null
          reason: string
          started_at?: string
          updated_at?: string
          work_order_id?: string | null
          workstation?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          ended_at?: string | null
          external_id?: string | null
          id?: string
          minutes?: number | null
          notes?: string | null
          reason?: string
          started_at?: string
          updated_at?: string
          work_order_id?: string | null
          workstation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downtime_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          created_at: string
          direction: string
          error: string | null
          event_type: string
          id: string
          payload: Json | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          error?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          source: string
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          base_url: string | null
          created_at: string
          enabled: boolean
          id: string
          last_status: string | null
          last_sync_at: string | null
          system: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_status?: string | null
          last_sync_at?: string | null
          system: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_status?: string | null
          last_sync_at?: string | null
          system?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          at: string
          id: string
          order_id: string | null
          product_id: string | null
          qty: number
          reference: string | null
          type: string
          user_id: string | null
          work_order_id: string | null
        }
        Insert: {
          at?: string
          id?: string
          order_id?: string | null
          product_id?: string | null
          qty: number
          reference?: string | null
          type: string
          user_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          at?: string
          id?: string
          order_id?: string | null
          product_id?: string | null
          qty?: number
          reference?: string | null
          type?: string
          user_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          metadata: Json | null
          metric: string
          source: string
          unit: string | null
          value: number
        }
        Insert: {
          captured_at?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          metric: string
          source: string
          unit?: string | null
          value: number
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          metric?: string
          source?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      non_conformances: {
        Row: {
          closed_at: string | null
          created_at: string
          description: string | null
          disposition: string | null
          external_id: string | null
          id: string
          number: string
          product_id: string | null
          raised_at: string
          raised_by: string | null
          severity: string
          status: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          description?: string | null
          disposition?: string | null
          external_id?: string | null
          id?: string
          number: string
          product_id?: string | null
          raised_at?: string
          raised_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          description?: string | null
          disposition?: string | null
          external_id?: string | null
          id?: string
          number?: string
          product_id?: string | null
          raised_at?: string
          raised_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_conformances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformances_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          created_at: string
          delivery_error: string | null
          delivery_status: string | null
          description: string | null
          direction: Database["public"]["Enums"]["request_direction"]
          external_ref: string | null
          id: string
          kind: Database["public"]["Enums"]["request_kind"]
          number: string
          payload: Json
          product_id: string | null
          requester_id: string | null
          source_system: string | null
          status: Database["public"]["Enums"]["request_status"]
          target_system: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["request_direction"]
          external_ref?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["request_kind"]
          number: string
          payload?: Json
          product_id?: string | null
          requester_id?: string | null
          source_system?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          target_system: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["request_direction"]
          external_ref?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["request_kind"]
          number?: string
          payload?: Json
          product_id?: string | null
          requester_id?: string | null
          source_system?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          target_system?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_routings: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          operation: string | null
          product_id: string | null
          request_id: string | null
          run_min: number
          seq: number
          setup_min: number
          station_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          operation?: string | null
          product_id?: string | null
          request_id?: string | null
          run_min?: number
          seq: number
          setup_min?: number
          station_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          operation?: string | null
          product_id?: string | null
          request_id?: string | null
          run_min?: number
          seq?: number
          setup_min?: number
          station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_routings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_routings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "product_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_routings_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "station_status"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          id: string
          notes: string | null
          number: string | null
          planned_end: string | null
          planned_start: string | null
          priority: number
          product_id: string | null
          qty: number
          qty_produced: number
          qty_scrap: number
          sales_order_id: string | null
          status: Database["public"]["Enums"]["production_order_status"]
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          number?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: number
          product_id?: string | null
          qty?: number
          qty_produced?: number
          qty_scrap?: number
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          number?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: number
          product_id?: string | null
          qty?: number
          qty_produced?: number
          qty_scrap?: number
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          lead_time: number
          name: string
          sku: string
          standard_cost: number
          type: string
          uom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          lead_time?: number
          name: string
          sku: string
          standard_cost?: number
          type?: string
          uom?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          lead_time?: number
          name?: string
          sku?: string
          standard_cost?: number
          type?: string
          uom?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      qc_inspections: {
        Row: {
          created_at: string
          defects_found: number | null
          external_id: string | null
          id: string
          inspected_at: string | null
          inspection_type: string
          inspector: string | null
          notes: string | null
          product_id: string | null
          sample_size: number | null
          status: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          defects_found?: number | null
          external_id?: string | null
          id?: string
          inspected_at?: string | null
          inspection_type?: string
          inspector?: string | null
          notes?: string | null
          product_id?: string | null
          sample_size?: number | null
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          defects_found?: number | null
          external_id?: string | null
          id?: string
          inspected_at?: string | null
          inspection_type?: string
          inspector?: string | null
          notes?: string | null
          product_id?: string | null
          sample_size?: number | null
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_inspections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_inspections_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      request_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          notes: string | null
          payload: Json | null
          request_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          notes?: string | null
          payload?: Json | null
          request_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          payload?: Json | null
          request_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "product_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          order_id: string
          product_id: string | null
          qty: number
          status: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          qty?: number
          status?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          qty?: number
          status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          due_date: string | null
          id: string
          notes: string | null
          number: string
          order_date: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          number: string
          order_date?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          order_date?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_filter_presets: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          page_key: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          page_key: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          page_key?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          id: string
          number: string
          order_id: string | null
          shipped_at: string | null
          status: string
          tracking: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          id?: string
          number: string
          order_id?: string | null
          shipped_at?: string | null
          status?: string
          tracking?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          id?: string
          number?: string
          order_id?: string | null
          shipped_at?: string | null
          status?: string
          tracking?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_steps: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          instructions: string | null
          notes: string | null
          seq: number
          title: string
          work_order_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          notes?: string | null
          seq: number
          title: string
          work_order_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          notes?: string | null
          seq?: number
          title?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_steps_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      station_status: {
        Row: {
          current_wo_id: string | null
          id: string
          last_heartbeat_at: string
          name: string
          oee: number | null
          operator: string | null
          state: string
          station_code: string
          updated_at: string
        }
        Insert: {
          current_wo_id?: string | null
          id?: string
          last_heartbeat_at?: string
          name: string
          oee?: number | null
          operator?: string | null
          state?: string
          station_code: string
          updated_at?: string
        }
        Update: {
          current_wo_id?: string | null
          id?: string
          last_heartbeat_at?: string
          name?: string
          oee?: number | null
          operator?: string | null
          state?: string
          station_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_status_current_wo_id_fkey"
            columns: ["current_wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
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
      work_orders: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          labor_min: number
          number: string
          operation: string
          operator_id: string | null
          production_order_ref: string | null
          progress: number
          qty_produced: number
          qty_scrap: number
          qty_target: number
          seq: number
          started_at: string | null
          status: string
          updated_at: string
          workstation: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          labor_min?: number
          number: string
          operation: string
          operator_id?: string | null
          production_order_ref?: string | null
          progress?: number
          qty_produced?: number
          qty_scrap?: number
          qty_target?: number
          seq?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          workstation?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          labor_min?: number
          number?: string
          operation?: string
          operator_id?: string | null
          production_order_ref?: string | null
          progress?: number
          qty_produced?: number
          qty_scrap?: number
          qty_target?: number
          seq?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          workstation?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "order_manager"
        | "production_planner"
        | "supervisor"
        | "operator"
      batch_status:
        | "planned"
        | "in_progress"
        | "on_hold"
        | "released"
        | "completed"
        | "rejected"
      production_order_status:
        | "planned"
        | "released"
        | "in_progress"
        | "completed"
        | "cancelled"
      request_direction: "outbound" | "inbound"
      request_kind: "new_product" | "other"
      request_status:
        | "pending"
        | "in_review"
        | "approved"
        | "rejected"
        | "completed"
        | "cancelled"
        | "failed"
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
      app_role: [
        "admin",
        "order_manager",
        "production_planner",
        "supervisor",
        "operator",
      ],
      batch_status: [
        "planned",
        "in_progress",
        "on_hold",
        "released",
        "completed",
        "rejected",
      ],
      production_order_status: [
        "planned",
        "released",
        "in_progress",
        "completed",
        "cancelled",
      ],
      request_direction: ["outbound", "inbound"],
      request_kind: ["new_product", "other"],
      request_status: [
        "pending",
        "in_review",
        "approved",
        "rejected",
        "completed",
        "cancelled",
        "failed",
      ],
    },
  },
} as const
