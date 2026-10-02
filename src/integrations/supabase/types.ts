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
      alert_rules: {
        Row: {
          create_exception: boolean
          created_at: string
          enabled: boolean
          id: string
          last_count: number | null
          last_fired_at: string | null
          metric: string
          name: string
          severity: string
          threshold: number
          updated_at: string
        }
        Insert: {
          create_exception?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          last_count?: number | null
          last_fired_at?: string | null
          metric: string
          name: string
          severity?: string
          threshold?: number
          updated_at?: string
        }
        Update: {
          create_exception?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          last_count?: number | null
          last_fired_at?: string | null
          metric?: string
          name?: string
          severity?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      allocations: {
        Row: {
          created_at: string
          id: string
          location_id: string
          order_id: string | null
          order_line_id: string
          product_id: string
          qty: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          order_id?: string | null
          order_line_id: string
          product_id: string
          qty: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          order_id?: string | null
          order_line_id?: string
          product_id?: string
          qty?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "v_line_fulfillment"
            referencedColumns: ["order_line_id"]
          },
          {
            foreignKeyName: "allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      app_role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string
          id: string
          resource: string
          role_id: string
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          id?: string
          resource: string
          role_id: string
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          id?: string
          resource?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
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
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
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
      business_rule_history: {
        Row: {
          actor_id: string | null
          at: string
          change: string
          id: string
          rule_id: string | null
          snapshot: Json | null
        }
        Insert: {
          actor_id?: string | null
          at?: string
          change: string
          id?: string
          rule_id?: string | null
          snapshot?: Json | null
        }
        Update: {
          actor_id?: string | null
          at?: string
          change?: string
          id?: string
          rule_id?: string | null
          snapshot?: Json | null
        }
        Relationships: []
      }
      business_rules: {
        Row: {
          action: Json
          active: boolean
          conditions: Json
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          name: string
          notes: string | null
          priority: number
          rule_type: string
          updated_at: string
        }
        Insert: {
          action?: Json
          active?: boolean
          conditions?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          name: string
          notes?: string | null
          priority?: number
          rule_type?: string
          updated_at?: string
        }
        Update: {
          action?: Json
          active?: boolean
          conditions?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          name?: string
          notes?: string | null
          priority?: number
          rule_type?: string
          updated_at?: string
        }
        Relationships: []
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
      exception_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          exception_id: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          exception_id: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          exception_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exception_comments_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "order_exceptions"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_events: {
        Row: {
          actor_id: string | null
          at: string
          from_status: string | null
          fulfillment_id: string
          id: string
          notes: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          from_status?: string | null
          fulfillment_id: string
          id?: string
          notes?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          from_status?: string | null
          fulfillment_id?: string
          id?: string
          notes?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_events_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_events_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "v_fulfillment_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_lines: {
        Row: {
          allocation_id: string | null
          created_at: string
          fulfillment_id: string
          id: string
          order_line_id: string
          product_id: string | null
          qty: number
        }
        Insert: {
          allocation_id?: string | null
          created_at?: string
          fulfillment_id: string
          id?: string
          order_line_id: string
          product_id?: string | null
          qty: number
        }
        Update: {
          allocation_id?: string | null
          created_at?: string
          fulfillment_id?: string
          id?: string
          order_line_id?: string
          product_id?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_lines_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_lines_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_lines_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "v_fulfillment_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "v_line_fulfillment"
            referencedColumns: ["order_line_id"]
          },
          {
            foreignKeyName: "fulfillment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      fulfillments: {
        Row: {
          carrier: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          failure_reason: string | null
          id: string
          location_id: string | null
          notes: string | null
          number: string | null
          order_id: string
          promised_date: string | null
          shipment_id: string | null
          shipped_at: string | null
          status: string
          status_changed_at: string
          tracking: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          number?: string | null
          order_id: string
          promised_date?: string | null
          shipment_id?: string | null
          shipped_at?: string | null
          status?: string
          status_changed_at?: string
          tracking?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          number?: string | null
          order_id?: string
          promised_date?: string | null
          shipment_id?: string | null
          shipped_at?: string | null
          status?: string
          status_changed_at?: string
          tracking?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_endpoints: {
        Row: {
          created_at: string
          enabled: boolean
          events: string[]
          id: string
          name: string
          system: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          name: string
          system: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          name?: string
          system?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
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
      integration_messages: {
        Row: {
          ai_explained_at: string | null
          ai_explanation: Json | null
          attempts: number
          created_at: string
          direction: string
          endpoint_id: string | null
          entity_id: string | null
          entity_table: string | null
          error: string | null
          id: string
          message_id: string
          message_type: string
          next_retry_at: string | null
          payload: Json
          processed_at: string | null
          response: Json | null
          signature_valid: boolean | null
          status: string
          system: string
          updated_at: string
        }
        Insert: {
          ai_explained_at?: string | null
          ai_explanation?: Json | null
          attempts?: number
          created_at?: string
          direction: string
          endpoint_id?: string | null
          entity_id?: string | null
          entity_table?: string | null
          error?: string | null
          id?: string
          message_id: string
          message_type: string
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          response?: Json | null
          signature_valid?: boolean | null
          status?: string
          system: string
          updated_at?: string
        }
        Update: {
          ai_explained_at?: string | null
          ai_explanation?: Json | null
          attempts?: number
          created_at?: string
          direction?: string
          endpoint_id?: string | null
          entity_id?: string | null
          entity_table?: string | null
          error?: string | null
          id?: string
          message_id?: string
          message_type?: string
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          response?: Json | null
          signature_valid?: boolean | null
          status?: string
          system?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_messages_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "integration_endpoints"
            referencedColumns: ["id"]
          },
        ]
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
      inventory_levels: {
        Row: {
          available: number | null
          id: string
          last_updated: string
          location_id: string
          on_hand: number
          product_id: string
          reserved: number
          source_system: string
          status: string
        }
        Insert: {
          available?: number | null
          id?: string
          last_updated?: string
          location_id: string
          on_hand?: number
          product_id: string
          reserved?: number
          source_system?: string
          status?: string
        }
        Update: {
          available?: number | null
          id?: string
          last_updated?: string
          location_id?: string
          on_hand?: number
          product_id?: string
          reserved?: number
          source_system?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          at: string
          id: string
          location_id: string
          product_id: string
          qty: number
          reference: string | null
          source_system: string
          to_location_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          at?: string
          id?: string
          location_id: string
          product_id: string
          qty: number
          reference?: string | null
          source_system?: string
          to_location_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          at?: string
          id?: string
          location_id?: string
          product_id?: string
          qty?: number
          reference?: string | null
          source_system?: string
          to_location_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "inventory_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
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
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
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
      kpi_targets: {
        Row: {
          id: string
          metric: string
          target: number
          updated_at: string
        }
        Insert: {
          id?: string
          metric: string
          target: number
          updated_at?: string
        }
        Update: {
          id?: string
          metric?: string
          target?: number
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          code: string
          created_at: string
          id: string
          name: string
          priority: number
          source_system: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          priority?: number
          source_system?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          priority?: number
          source_system?: string | null
          type?: string
          updated_at?: string
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
            foreignKeyName: "non_conformances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
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
      notifications: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_table: string
          id: string
          payload: Json | null
          read_by: string[]
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: string
          payload?: Json | null
          read_by?: string[]
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: string
          payload?: Json | null
          read_by?: string[]
          summary?: string | null
        }
        Relationships: []
      }
      order_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string
          escalated_at: string | null
          escalation_level: number
          fulfillment_id: string | null
          id: string
          number: string | null
          order_id: string | null
          owner_id: string | null
          resolution: string | null
          resolved_at: string | null
          severity: string
          source: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          escalated_at?: string | null
          escalation_level?: number
          fulfillment_id?: string | null
          id?: string
          number?: string | null
          order_id?: string | null
          owner_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          escalated_at?: string | null
          escalation_level?: number
          fulfillment_id?: string | null
          id?: string
          number?: string | null
          order_id?: string | null
          owner_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_exceptions_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exceptions_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "v_fulfillment_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      order_feedback: {
        Row: {
          category: string
          comment: string | null
          comments: Json
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          product_ratings: Json
          rating: number
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          comment?: string | null
          comments?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          product_ratings?: Json
          rating: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          comment?: string | null
          comments?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          product_ratings?: Json
          rating?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      order_milestones: {
        Row: {
          actor_id: string | null
          at: string
          from_status: string | null
          id: string
          milestone: string
          notes: string | null
          order_id: string
          source: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          at?: string
          from_status?: string | null
          id?: string
          milestone: string
          notes?: string | null
          order_id: string
          source?: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          at?: string
          from_status?: string | null
          id?: string
          milestone?: string
          notes?: string | null
          order_id?: string
          source?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_milestones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_milestones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
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
          {
            foreignKeyName: "product_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
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
            foreignKeyName: "product_routings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
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
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          acceptance_criteria: Json
          attachments: Json
          batching_limit: number
          created_at: string
          description: string | null
          id: string
          lead_time: number
          name: string
          sale_price: number
          sku: string
          specifications: Json
          standard_cost: number
          type: string
          uom: string
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: Json
          attachments?: Json
          batching_limit?: number
          created_at?: string
          description?: string | null
          id?: string
          lead_time?: number
          name: string
          sale_price?: number
          sku: string
          specifications?: Json
          standard_cost?: number
          type?: string
          uom?: string
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: Json
          attachments?: Json
          batching_limit?: number
          created_at?: string
          description?: string | null
          id?: string
          lead_time?: number
          name?: string
          sale_price?: number
          sku?: string
          specifications?: Json
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
          email: string | null
          id: string
          must_reset_password: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          must_reset_password?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          must_reset_password?: boolean
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
            foreignKeyName: "qc_inspections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
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
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          issued_at: string | null
          method: string | null
          notes: string | null
          reference: string | null
          return_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          issued_at?: string | null
          method?: string | null
          notes?: string | null
          reference?: string | null
          return_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          issued_at?: string | null
          method?: string | null
          notes?: string | null
          reference?: string | null
          return_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
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
      reservations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          location_id: string
          order_id: string | null
          order_line_id: string
          product_id: string
          qty: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          location_id: string
          order_id?: string | null
          order_line_id: string
          product_id: string
          qty: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          location_id?: string
          order_id?: string | null
          order_line_id?: string
          product_id?: string
          qty?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "v_line_fulfillment"
            referencedColumns: ["order_line_id"]
          },
          {
            foreignKeyName: "reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      return_lines: {
        Row: {
          condition: string | null
          created_at: string
          disposition: string | null
          dispositioned_at: string | null
          id: string
          inspection_notes: string | null
          product_id: string | null
          qty: number
          reason: string | null
          received_qty: number
          return_id: string
          sales_order_line_id: string | null
          unit_price: number
        }
        Insert: {
          condition?: string | null
          created_at?: string
          disposition?: string | null
          dispositioned_at?: string | null
          id?: string
          inspection_notes?: string | null
          product_id?: string | null
          qty?: number
          reason?: string | null
          received_qty?: number
          return_id: string
          sales_order_line_id?: string | null
          unit_price?: number
        }
        Update: {
          condition?: string | null
          created_at?: string
          disposition?: string | null
          dispositioned_at?: string | null
          id?: string
          inspection_notes?: string | null
          product_id?: string | null
          qty?: number
          reason?: string | null
          received_qty?: number
          return_id?: string
          sales_order_line_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "return_lines_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_lines_sales_order_line_id_fkey"
            columns: ["sales_order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_lines_sales_order_line_id_fkey"
            columns: ["sales_order_line_id"]
            isOneToOne: false
            referencedRelation: "v_line_fulfillment"
            referencedColumns: ["order_line_id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          destination_location_id: string | null
          id: string
          notes: string | null
          number: string
          order_id: string
          reason: string | null
          received_at: string | null
          reorder_order_id: string | null
          return_carrier: string | null
          return_shipment_status: string
          return_tracking: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          destination_location_id?: string | null
          id?: string
          notes?: string | null
          number: string
          order_id: string
          reason?: string | null
          received_at?: string | null
          reorder_order_id?: string | null
          return_carrier?: string | null
          return_shipment_status?: string
          return_tracking?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          destination_location_id?: string | null
          id?: string
          notes?: string | null
          number?: string
          order_id?: string
          reason?: string | null
          received_at?: string | null
          reorder_order_id?: string | null
          return_carrier?: string | null
          return_shipment_status?: string
          return_tracking?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_reorder_order_id_fkey"
            columns: ["reorder_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_reorder_order_id_fkey"
            columns: ["reorder_order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          batch_index: number | null
          batch_of: number | null
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
          batch_index?: number | null
          batch_of?: number | null
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
          batch_index?: number | null
          batch_of?: number | null
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
            foreignKeyName: "sales_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          due_date: string | null
          hold_reason: string | null
          id: string
          notes: string | null
          number: string
          order_date: string
          order_type: string
          route: string | null
          status: string
          status_changed_at: string
          total: number
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          due_date?: string | null
          hold_reason?: string | null
          id?: string
          notes?: string | null
          number: string
          order_date?: string
          order_type?: string
          route?: string | null
          status?: string
          status_changed_at?: string
          total?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          due_date?: string | null
          hold_reason?: string | null
          id?: string
          notes?: string | null
          number?: string
          order_date?: string
          order_type?: string
          route?: string | null
          status?: string
          status_changed_at?: string
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
      scheduler_runs: {
        Row: {
          id: string
          ok: boolean
          ran_at: string
          result: Json
          source: string
        }
        Insert: {
          id?: string
          ok?: boolean
          ran_at?: string
          result?: Json
          source: string
        }
        Update: {
          id?: string
          ok?: boolean
          ran_at?: string
          result?: Json
          source?: string
        }
        Relationships: []
      }
      scheduler_token: {
        Row: {
          id: number
          token: string
        }
        Insert: {
          id?: number
          token?: string
        }
        Update: {
          id?: number
          token?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          fulfillment_id: string | null
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
          fulfillment_id?: string | null
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
          fulfillment_id?: string | null
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
            foreignKeyName: "shipments_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "v_fulfillment_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
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
      sourcing_decisions: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          location_id: string | null
          order_id: string
          order_line_id: string
          qty: number
          rank: number
          rule_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          location_id?: string | null
          order_id: string
          order_line_id: string
          qty?: number
          rank?: number
          rule_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          location_id?: string | null
          order_id?: string
          order_line_id?: string
          qty?: number
          rank?: number
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_decisions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_decisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_decisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_decisions_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_decisions_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "v_line_fulfillment"
            referencedColumns: ["order_line_id"]
          },
          {
            foreignKeyName: "sourcing_decisions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "business_rules"
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
      supply: {
        Row: {
          created_at: string
          expected_date: string | null
          id: string
          location_id: string | null
          product_id: string
          qty: number
          reference: string | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_date?: string | null
          id?: string
          location_id?: string | null
          product_id: string
          qty: number
          reference?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_date?: string | null
          id?: string
          location_id?: string | null
          product_id?: string
          qty?: number
          reference?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      user_app_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_app_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
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
      workflow_transitions: {
        Row: {
          created_at: string
          enabled: boolean
          entity: string
          from_status: string
          id: string
          sla_hours: number | null
          to_status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          entity?: string
          from_status: string
          id?: string
          sla_hours?: number | null
          to_status: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          entity?: string
          from_status?: string
          id?: string
          sla_hours?: number | null
          to_status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_fulfillment_monitor: {
        Row: {
          carrier: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          failure_reason: string | null
          hours_in_status: number | null
          id: string | null
          line_count: number | null
          location_code: string | null
          location_id: string | null
          notes: string | null
          number: string | null
          order_id: string | null
          order_number: string | null
          promised_date: string | null
          shipment_id: string | null
          shipped_at: string | null
          status: string | null
          status_changed_at: string | null
          total_qty: number | null
          tracking: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_line_fulfillment: {
        Row: {
          allocated_open: number | null
          in_fulfillment: number | null
          order_id: string | null
          order_line_id: string | null
          ordered: number | null
          product_id: string | null
          shipped: number | null
        }
        Insert: {
          allocated_open?: never
          in_fulfillment?: never
          order_id?: string | null
          order_line_id?: string | null
          ordered?: number | null
          product_id?: string | null
          shipped?: never
        }
        Update: {
          allocated_open?: never
          in_fulfillment?: never
          order_id?: string | null
          order_line_id?: string | null
          ordered?: number | null
          product_id?: string | null
          shipped?: never
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
            foreignKeyName: "sales_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_supply_demand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_order_monitor: {
        Row: {
          channel: string | null
          created_at: string | null
          customer_id: string | null
          due_date: string | null
          failed_steps: number | null
          hold_reason: string | null
          hours_in_status: number | null
          id: string | null
          last_milestone: string | null
          number: string | null
          route: string | null
          sla_hours: number | null
          status: string | null
          status_changed_at: string | null
          total: number | null
          unallocated_qty: number | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          failed_steps?: never
          hold_reason?: string | null
          hours_in_status?: never
          id?: string | null
          last_milestone?: never
          number?: string | null
          route?: string | null
          sla_hours?: never
          status?: string | null
          status_changed_at?: string | null
          total?: number | null
          unallocated_qty?: never
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          failed_steps?: never
          hold_reason?: string | null
          hours_in_status?: never
          id?: string | null
          last_milestone?: never
          number?: string | null
          route?: string | null
          sla_hours?: never
          status?: string | null
          status_changed_at?: string | null
          total?: number | null
          unallocated_qty?: never
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
      v_supply_demand: {
        Row: {
          demand: number | null
          incoming: number | null
          name: string | null
          on_hand: number | null
          product_id: string | null
          reserved: number | null
          sku: string | null
        }
        Insert: {
          demand?: never
          incoming?: never
          name?: string | null
          on_hand?: never
          product_id?: string | null
          reserved?: never
          sku?: string | null
        }
        Update: {
          demand?: never
          incoming?: never
          name?: string | null
          on_hand?: never
          product_id?: string | null
          reserved?: never
          sku?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      allocate_line: {
        Args: { _line: string; _location: string; _qty: number }
        Returns: string
      }
      check_availability: {
        Args: { _product: string; _qty: number }
        Returns: Json
      }
      create_fulfillments: { Args: { _order: string }; Returns: number }
      deallocate: { Args: { _id: string }; Returns: undefined }
      disposition_return_line: {
        Args: {
          _condition: string
          _disposition: string
          _line: string
          _notes: string
        }
        Returns: undefined
      }
      escalate_exceptions: { Args: never; Returns: number }
      expire_reservations: { Args: never; Returns: number }
      has_permission: {
        Args: { _action: string; _resource: string; _user: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inv_move: {
        Args: {
          _location: string
          _product: string
          _qty: number
          _reference?: string
          _to_location?: string
          _type: string
        }
        Returns: undefined
      }
      inv_upsert_row: {
        Args: { _l: string; _p: string }
        Returns: {
          available: number | null
          id: string
          last_updated: string
          location_id: string
          on_hand: number
          product_id: string
          reserved: number
          source_system: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_levels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_order_milestone: {
        Args: { _milestone: string; _notes: string; _order: string }
        Returns: undefined
      }
      orchestrate_order: { Args: { _order: string }; Returns: Json }
      queue_outbound: {
        Args: {
          _entity_id: string
          _entity_table: string
          _event: string
          _payload: Json
        }
        Returns: number
      }
      receive_return: {
        Args: { _location: string; _return: string }
        Returns: undefined
      }
      release_reservation: {
        Args: { _id: string; _status?: string }
        Returns: undefined
      }
      reserve_stock: {
        Args: {
          _line: string
          _location: string
          _minutes?: number
          _qty: number
        }
        Returns: string
      }
      rule_matches: {
        Args: {
          _c: Json
          _o: Database["public"]["Tables"]["sales_orders"]["Row"]
          _product: string
        }
        Returns: boolean
      }
      run_alert_rules: { Args: never; Returns: number }
      run_scheduled_housekeeping: { Args: never; Returns: Json }
      set_fulfillment_status: {
        Args: {
          _carrier?: string
          _id: string
          _notes?: string
          _status: string
          _tracking?: string
        }
        Returns: undefined
      }
      try_order_status: {
        Args: { _order: string; _to: string }
        Returns: undefined
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
