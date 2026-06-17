import type { ChatMode, ProviderId } from "@/lib/types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserProfile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
};

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  mode: ChatMode;
  pinned: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider_id: ProviderId | null;
  model: string | null;
  latency_ms: number | null;
  token_count: number | null;
  metadata: Json;
  created_at: string;
};

export type ProviderSettingRow = {
  id: ProviderId;
  display_name: string;
  enabled: boolean;
  priority: number;
  speed_model: string;
  deep_model: string;
  base_url: string | null;
  timeout_ms: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type ProviderMetricRow = {
  id: string;
  provider_id: ProviderId;
  model: string;
  mode: ChatMode;
  success: boolean;
  latency_ms: number;
  error_message: string | null;
  tokens_in: number;
  tokens_out: number;
  user_id: string | null;
  conversation_id: string | null;
  created_at: string;
};

export type UsageLogRow = {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  event_type: string;
  metadata: Json;
  created_at: string;
};

export type KnowledgeCollectionRow = {
  id: string;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  visibility: "private" | "company" | "global";
  metadata: Json;
  created_at: string;
  updated_at: string;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      user_profiles: Table<
        UserProfile,
        Partial<Omit<UserProfile, "created_at" | "updated_at">> & {
          id: string;
        },
        Partial<UserProfile>
      >;
      user_settings: Table<
        {
          user_id: string;
          default_mode: ChatMode;
          web_search_enabled: boolean;
          locale: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        },
        {
          user_id: string;
          default_mode?: ChatMode;
          web_search_enabled?: boolean;
          locale?: string;
          metadata?: Json;
        },
        Partial<{
          default_mode: ChatMode;
          web_search_enabled: boolean;
          locale: string;
          metadata: Json;
          updated_at: string;
        }>
      >;
      conversations: Table<
        ConversationRow,
        {
          id?: string;
          user_id: string;
          title: string;
          mode?: ChatMode;
          pinned?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Omit<ConversationRow, "id" | "user_id" | "created_at">>
      >;
      messages: Table<
        MessageRow,
        {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: MessageRow["role"];
          content: string;
          provider_id?: ProviderId | string | null;
          model?: string | null;
          latency_ms?: number | null;
          token_count?: number | null;
          metadata?: Json;
          created_at?: string;
        },
        Partial<Omit<MessageRow, "id" | "conversation_id" | "user_id">>
      >;
      ai_provider_settings: Table<
        ProviderSettingRow,
        {
          id: ProviderId;
          display_name: string;
          enabled?: boolean;
          priority: number;
          speed_model: string;
          deep_model: string;
          base_url?: string | null;
          timeout_ms?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Omit<ProviderSettingRow, "id" | "created_at">>
      >;
      provider_metrics: Table<
        ProviderMetricRow,
        {
          id?: string;
          provider_id: ProviderId;
          model: string;
          mode: ChatMode | string;
          success: boolean;
          latency_ms?: number;
          error_message?: string | null;
          tokens_in?: number;
          tokens_out?: number;
          user_id?: string | null;
          conversation_id?: string | null;
          created_at?: string;
        },
        Partial<ProviderMetricRow>
      >;
      usage_logs: Table<
        UsageLogRow,
        {
          id?: string;
          user_id?: string | null;
          conversation_id?: string | null;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        },
        Partial<UsageLogRow>
      >;
      knowledge_collections: Table<
        KnowledgeCollectionRow,
        {
          id?: string;
          owner_user_id?: string | null;
          name: string;
          description?: string | null;
          visibility?: KnowledgeCollectionRow["visibility"];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Omit<KnowledgeCollectionRow, "id" | "owner_user_id" | "created_at">>
      >;
      document_assets: Table<
        {
          id: string;
          owner_user_id: string;
          collection_id: string | null;
          file_name: string;
          mime_type: string;
          storage_path: string;
          status: "uploaded" | "processing" | "ready" | "failed";
          metadata: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          owner_user_id: string;
          collection_id?: string | null;
          file_name: string;
          mime_type: string;
          storage_path: string;
          status?: "uploaded" | "processing" | "ready" | "failed";
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        },
        Partial<{
          collection_id: string | null;
          file_name: string;
          mime_type: string;
          storage_path: string;
          status: "uploaded" | "processing" | "ready" | "failed";
          metadata: Json;
          updated_at: string;
        }>
      >;
      knowledge_chunks: Table<
        {
          id: string;
          collection_id: string;
          document_id: string | null;
          owner_user_id: string;
          content: string;
          embedding: number[] | null;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          collection_id: string;
          document_id?: string | null;
          owner_user_id: string;
          content: string;
          embedding?: number[] | null;
          metadata?: Json;
          created_at?: string;
        },
        Partial<{
          collection_id: string;
          document_id: string | null;
          content: string;
          embedding: number[] | null;
          metadata: Json;
        }>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

