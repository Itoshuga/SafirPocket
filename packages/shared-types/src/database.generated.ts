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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          request_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booster_product_slots: {
        Row: {
          booster_product_id: string
          created_at: string
          id: string
          quantity: number
          slot_index: number
          weight_config: Json
        }
        Insert: {
          booster_product_id: string
          created_at?: string
          id?: string
          quantity?: number
          slot_index: number
          weight_config: Json
        }
        Update: {
          booster_product_id?: string
          created_at?: string
          id?: string
          quantity?: number
          slot_index?: number
          weight_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "booster_product_slots_booster_product_id_fkey"
            columns: ["booster_product_id"]
            isOneToOne: false
            referencedRelation: "booster_products"
            referencedColumns: ["id"]
          },
        ]
      }
      booster_products: {
        Row: {
          artwork_path: string | null
          available_from: string | null
          available_until: string | null
          cards_per_pack: number
          common_card_count: number
          created_at: string
          deleted_at: string | null
          description: string | null
          guaranteed_common_rarity_id: string
          id: string
          image_url: string | null
          is_active: boolean
          metadata: Json
          name: string
          premium_card_count: number
          price_amount: number
          price_currency: string | null
          season_id: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publication_status"]
          updated_at: string
        }
        Insert: {
          artwork_path?: string | null
          available_from?: string | null
          available_until?: string | null
          cards_per_pack?: number
          common_card_count?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          guaranteed_common_rarity_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json
          name: string
          premium_card_count?: number
          price_amount?: number
          price_currency?: string | null
          season_id: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Update: {
          artwork_path?: string | null
          available_from?: string | null
          available_until?: string | null
          cards_per_pack?: number
          common_card_count?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          guaranteed_common_rarity_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json
          name?: string
          premium_card_count?: number
          price_amount?: number
          price_currency?: string | null
          season_id?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booster_products_guaranteed_common_rarity_id_fkey"
            columns: ["guaranteed_common_rarity_id"]
            isOneToOne: false
            referencedRelation: "card_rarities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booster_products_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "card_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      booster_rarity_drop_rates: {
        Row: {
          booster_id: string
          created_at: string
          drop_rate_bps: number
          rarity_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          booster_id: string
          created_at?: string
          drop_rate_bps: number
          rarity_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          booster_id?: string
          created_at?: string
          drop_rate_bps?: number
          rarity_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booster_rarity_drop_rates_booster_id_fkey"
            columns: ["booster_id"]
            isOneToOne: false
            referencedRelation: "booster_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booster_rarity_drop_rates_rarity_id_fkey"
            columns: ["rarity_id"]
            isOneToOne: false
            referencedRelation: "card_rarities"
            referencedColumns: ["id"]
          },
        ]
      }
      card_rarities: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          display_color: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_color?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_color?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      card_seasons: {
        Row: {
          code: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          start_date: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      card_sets: {
        Row: {
          artwork_path: string | null
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          metadata: Json
          name: string
          release_date: string | null
          slug: string
          status: Database["public"]["Enums"]["publication_status"]
          updated_at: string
        }
        Insert: {
          artwork_path?: string | null
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          metadata?: Json
          name: string
          release_date?: string | null
          slug: string
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Update: {
          artwork_path?: string | null
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          metadata?: Json
          name?: string
          release_date?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Relationships: []
      }
      card_type_links: {
        Row: {
          card_id: string
          created_at: string
          sort_order: number
          type_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          sort_order?: number
          type_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          sort_order?: number
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_type_links_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_type_links_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "card_types"
            referencedColumns: ["id"]
          },
        ]
      }
      card_types: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          display_color: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_color?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_color?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      card_variants: {
        Row: {
          artwork_path: string | null
          card_id: string
          created_at: string
          display_order: number
          finish: string
          id: string
          metadata: Json
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          artwork_path?: string | null
          card_id: string
          created_at?: string
          display_order?: number
          finish?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          artwork_path?: string | null
          card_id?: string
          created_at?: string
          display_order?: number
          finish?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_variants_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          artwork_path: string | null
          attack: number
          card_type: string
          collection_number: string
          cost: number | null
          created_at: string
          defense: number
          deleted_at: string | null
          description: string | null
          display_order: number
          effect_text: string | null
          effects: Json
          id: string
          image_url: string | null
          is_active: boolean
          is_commander: boolean
          metadata: Json
          name: string
          number: number
          rarity: string
          rarity_id: string
          season_id: string
          set_id: string | null
          slug: string
          stats: Json
          status: Database["public"]["Enums"]["publication_status"]
          updated_at: string
          value: number
        }
        Insert: {
          artwork_path?: string | null
          attack?: number
          card_type: string
          collection_number: string
          cost?: number | null
          created_at?: string
          defense?: number
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          effect_text?: string | null
          effects?: Json
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_commander?: boolean
          metadata?: Json
          name: string
          number: number
          rarity: string
          rarity_id: string
          season_id: string
          set_id?: string | null
          slug: string
          stats?: Json
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
          value?: number
        }
        Update: {
          artwork_path?: string | null
          attack?: number
          card_type?: string
          collection_number?: string
          cost?: number | null
          created_at?: string
          defense?: number
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          effect_text?: string | null
          effects?: Json
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_commander?: boolean
          metadata?: Json
          name?: string
          number?: number
          rarity?: string
          rarity_id?: string
          season_id?: string
          set_id?: string | null
          slug?: string
          stats?: Json
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "cards_rarity_id_fkey"
            columns: ["rarity_id"]
            isOneToOne: false
            referencedRelation: "card_rarities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "card_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "card_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_migration_issues: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          issue_code: string
          migration_name: string
          source_value: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          field_name: string
          id?: string
          issue_code: string
          migration_name: string
          source_value?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string
          id?: string
          issue_code?: string
          migration_name?: string
          source_value?: string | null
        }
        Relationships: []
      }
      currency_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          currency_code: string
          id: string
          idempotency_key: string
          metadata: Json
          reason: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          currency_code: string
          id?: string
          idempotency_key: string
          metadata?: Json
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          currency_code?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_cards: {
        Row: {
          card_variant_id: string
          created_at: string
          deck_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          card_variant_id: string
          created_at?: string
          deck_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          card_variant_id?: string
          created_at?: string
          deck_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_cards_card_variant_id_fkey"
            columns: ["card_variant_id"]
            isOneToOne: false
            referencedRelation: "card_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          description: string | null
          format: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          owner_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["deck_visibility"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          owner_id: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["deck_visibility"]
        }
        Update: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          owner_id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["deck_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "decks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_user_id: string
          responded_at: string | null
          sender_user_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_user_id: string
          responded_at?: string | null
          sender_user_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_user_id?: string
          responded_at?: string | null
          sender_user_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_user_id_fkey"
            columns: ["receiver_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user_one_id: string
          user_two_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_one_id: string
          user_two_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_one_id?: string
          user_two_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_one_id_fkey"
            columns: ["user_one_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_two_id_fkey"
            columns: ["user_two_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          match_id: string
          payload: Json
          rules_version: string
          sequence: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          match_id: string
          payload: Json
          rules_version: string
          sequence: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          match_id?: string
          payload?: Json
          rules_version?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          deck_id: string | null
          is_ready: boolean
          joined_at: string
          match_id: string
          seat: number
          snapshot: Json
          user_id: string
        }
        Insert: {
          deck_id?: string | null
          is_ready?: boolean
          joined_at?: string
          match_id: string
          seat: number
          snapshot?: Json
          user_id: string
        }
        Update: {
          deck_id?: string | null
          is_ready?: boolean
          joined_at?: string
          match_id?: string
          seat?: number
          snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_players_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          current_sequence: number
          finished_at: string | null
          format: string
          id: string
          result_reason: string | null
          rules_version: string
          started_at: string | null
          state: Json
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          current_sequence?: number
          finished_at?: string | null
          format: string
          id?: string
          result_reason?: string | null
          rules_version: string
          started_at?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          current_sequence?: number
          finished_at?: string | null
          format?: string
          id?: string
          result_reason?: string | null
          rules_version?: string
          started_at?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      missions: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          rewards: Json
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["publication_status"]
          target: Json
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          rewards: Json
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          target: Json
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          rewards?: Json
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          target?: Json
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      pack_opening_cards: {
        Row: {
          card_id: string
          card_name_snapshot: string
          card_variant_id: string
          created_at: string
          id: string
          new_quantity: number
          pack_opening_id: string
          previous_quantity: number
          probability_data: Json
          quantity: number
          rarity_id: string
          rarity_name_snapshot: string
          slot_category: Database["public"]["Enums"]["pack_slot_category"]
          slot_index: number
          slot_position: number
        }
        Insert: {
          card_id: string
          card_name_snapshot: string
          card_variant_id: string
          created_at?: string
          id?: string
          new_quantity: number
          pack_opening_id: string
          previous_quantity: number
          probability_data?: Json
          quantity?: number
          rarity_id: string
          rarity_name_snapshot: string
          slot_category: Database["public"]["Enums"]["pack_slot_category"]
          slot_index: number
          slot_position: number
        }
        Update: {
          card_id?: string
          card_name_snapshot?: string
          card_variant_id?: string
          created_at?: string
          id?: string
          new_quantity?: number
          pack_opening_id?: string
          previous_quantity?: number
          probability_data?: Json
          quantity?: number
          rarity_id?: string
          rarity_name_snapshot?: string
          slot_category?: Database["public"]["Enums"]["pack_slot_category"]
          slot_index?: number
          slot_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pack_opening_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_opening_cards_card_variant_id_fkey"
            columns: ["card_variant_id"]
            isOneToOne: false
            referencedRelation: "card_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_opening_cards_pack_opening_id_fkey"
            columns: ["pack_opening_id"]
            isOneToOne: false
            referencedRelation: "pack_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_opening_cards_rarity_id_fkey"
            columns: ["rarity_id"]
            isOneToOne: false
            referencedRelation: "card_rarities"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_openings: {
        Row: {
          booster_name_snapshot: string
          booster_product_id: string
          created_at: string
          error_code: string | null
          id: string
          idempotency_key: string
          opened_at: string | null
          price_amount: number
          price_currency: string | null
          season_id: string
          status: Database["public"]["Enums"]["pack_opening_status"]
          user_id: string
        }
        Insert: {
          booster_name_snapshot: string
          booster_product_id: string
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key: string
          opened_at?: string | null
          price_amount: number
          price_currency?: string | null
          season_id: string
          status?: Database["public"]["Enums"]["pack_opening_status"]
          user_id: string
        }
        Update: {
          booster_name_snapshot?: string
          booster_product_id?: string
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key?: string
          opened_at?: string | null
          price_amount?: number
          price_currency?: string | null
          season_id?: string
          status?: Database["public"]["Enums"]["pack_opening_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_openings_booster_product_id_fkey"
            columns: ["booster_product_id"]
            isOneToOne: false
            referencedRelation: "booster_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_openings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "card_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_openings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ranked_ratings: {
        Row: {
          draws: number
          losses: number
          rating: number
          season_id: string
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          draws?: number
          losses?: number
          rating?: number
          season_id: string
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          draws?: number
          losses?: number
          rating?: number
          season_id?: string
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranked_ratings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "ranked_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranked_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ranked_seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          name: string
          rules: Json
          slug: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          name: string
          rules?: Json
          slug: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          rules?: Json
          slug?: string
          starts_at?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_user_id_fkey"
            columns: ["blocker_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cards: {
        Row: {
          card_variant_id: string
          first_obtained_at: string
          last_obtained_at: string
          locked_quantity: number
          quantity: number
          user_id: string
        }
        Insert: {
          card_variant_id: string
          first_obtained_at?: string
          last_obtained_at?: string
          locked_quantity?: number
          quantity?: number
          user_id: string
        }
        Update: {
          card_variant_id?: string
          first_obtained_at?: string
          last_obtained_at?: string
          locked_quantity?: number
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_card_variant_id_fkey"
            columns: ["card_variant_id"]
            isOneToOne: false
            referencedRelation: "card_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_missions: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          mission_id: string
          progress: Json
          status: Database["public"]["Enums"]["mission_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          mission_id: string
          progress?: Json
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          mission_id?: string
          progress?: Json
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_missions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_moderation_actions: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action"]
          actor_user_id: string | null
          created_at: string
          id: string
          internal_note: string | null
          metadata: Json
          new_role: Database["public"]["Enums"]["app_role"] | null
          new_status: Database["public"]["Enums"]["account_status"] | null
          previous_role: Database["public"]["Enums"]["app_role"] | null
          previous_status: Database["public"]["Enums"]["account_status"] | null
          reason: string
          target_user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          metadata?: Json
          new_role?: Database["public"]["Enums"]["app_role"] | null
          new_status?: Database["public"]["Enums"]["account_status"] | null
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          previous_status?: Database["public"]["Enums"]["account_status"] | null
          reason: string
          target_user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          metadata?: Json
          new_role?: Database["public"]["Enums"]["app_role"] | null
          new_status?: Database["public"]["Enums"]["account_status"] | null
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          previous_status?: Database["public"]["Enums"]["account_status"] | null
          reason?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_moderation_actions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_moderation_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          allow_friend_requests: boolean
          appear_in_user_search: boolean
          created_at: string
          email_notifications: boolean
          friend_acceptance_notifications: boolean
          friend_request_notifications: boolean
          game_invite_notifications: boolean
          game_news_notifications: boolean
          marketing_emails: boolean
          profile_visibility: Database["public"]["Enums"]["profile_visibility"]
          show_collection_stats: boolean
          show_game_stats: boolean
          show_online_status: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_friend_requests?: boolean
          appear_in_user_search?: boolean
          created_at?: string
          email_notifications?: boolean
          friend_acceptance_notifications?: boolean
          friend_request_notifications?: boolean
          game_invite_notifications?: boolean
          game_news_notifications?: boolean
          marketing_emails?: boolean
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          show_collection_stats?: boolean
          show_game_stats?: boolean
          show_online_status?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_friend_requests?: boolean
          appear_in_user_search?: boolean
          created_at?: string
          email_notifications?: boolean
          friend_acceptance_notifications?: boolean
          friend_request_notifications?: boolean
          game_invite_notifications?: boolean
          game_news_notifications?: boolean
          marketing_emails?: boolean
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          show_collection_stats?: boolean
          show_game_stats?: boolean
          show_online_status?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          deactivated_at: string | null
          deletion_cancelled_at: string | null
          deletion_processed_at: string | null
          deletion_reason: string | null
          deletion_requested_at: string | null
          deletion_scheduled_for: string | null
          display_name: string | null
          email: string
          id: string
          is_deactivated: boolean
          last_login_at: string | null
          must_change_password: boolean
          normalized_username: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["account_status"]
          suspended_until: string | null
          updated_at: string
          username: string
          username_changed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          deactivated_at?: string | null
          deletion_cancelled_at?: string | null
          deletion_processed_at?: string | null
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_for?: string | null
          display_name?: string | null
          email: string
          id: string
          is_deactivated?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          normalized_username: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          suspended_until?: string | null
          updated_at?: string
          username: string
          username_changed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          deactivated_at?: string | null
          deletion_cancelled_at?: string | null
          deletion_processed_at?: string | null
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_for?: string | null
          display_name?: string | null
          email?: string
          id?: string
          is_deactivated?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          normalized_username?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          suspended_until?: string | null
          updated_at?: string
          username?: string
          username_changed_at?: string | null
        }
        Relationships: []
      }
      user_security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warnings: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          internal_note: string | null
          is_active: boolean
          issued_by_user_id: string | null
          reason: string
          revoked_at: string | null
          revoked_by_user_id: string | null
          severity: Database["public"]["Enums"]["warning_severity"]
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          is_active?: boolean
          issued_by_user_id?: string | null
          reason: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          severity: Database["public"]["Enums"]["warning_severity"]
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          is_active?: boolean
          issued_by_user_id?: string | null
          reason?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          severity?: Database["public"]["Enums"]["warning_severity"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warnings_issued_by_user_id_fkey"
            columns: ["issued_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warnings_revoked_by_user_id_fkey"
            columns: ["revoked_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_privileged: { Args: never; Returns: boolean }
      repair_missing_user_profiles: {
        Args: { apply_changes?: boolean }
        Returns: {
          outcome: string
          user_id: string
          username: string
        }[]
      }
    }
    Enums: {
      account_status: "ACTIVE" | "SUSPENDED" | "BANNED"
      app_role: "USER" | "PIONEER" | "MODERATOR" | "ADMINISTRATOR"
      deck_visibility: "private" | "unlisted" | "public"
      friend_request_status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"
      match_status: "pending" | "active" | "completed" | "cancelled"
      mission_status: "active" | "completed" | "claimed" | "expired"
      moderation_action:
        | "USER_SUSPENDED"
        | "USER_UNSUSPENDED"
        | "USER_BANNED"
        | "USER_UNBANNED"
        | "ROLE_CHANGED"
        | "PIONEER_GRANTED"
        | "PIONEER_REVOKED"
      pack_opening_status: "pending" | "completed" | "failed"
      pack_slot_category: "COMMON" | "PREMIUM"
      profile_visibility: "PUBLIC" | "PRIVATE"
      publication_status: "draft" | "published" | "archived"
      user_role: "user" | "moderator" | "admin"
      warning_severity: "LOW" | "MEDIUM" | "HIGH"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["ACTIVE", "SUSPENDED", "BANNED"],
      app_role: ["USER", "PIONEER", "MODERATOR", "ADMINISTRATOR"],
      deck_visibility: ["private", "unlisted", "public"],
      friend_request_status: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"],
      match_status: ["pending", "active", "completed", "cancelled"],
      mission_status: ["active", "completed", "claimed", "expired"],
      moderation_action: [
        "USER_SUSPENDED",
        "USER_UNSUSPENDED",
        "USER_BANNED",
        "USER_UNBANNED",
        "ROLE_CHANGED",
        "PIONEER_GRANTED",
        "PIONEER_REVOKED",
      ],
      pack_opening_status: ["pending", "completed", "failed"],
      pack_slot_category: ["COMMON", "PREMIUM"],
      profile_visibility: ["PUBLIC", "PRIVATE"],
      publication_status: ["draft", "published", "archived"],
      user_role: ["user", "moderator", "admin"],
      warning_severity: ["LOW", "MEDIUM", "HIGH"],
    },
  },
} as const
