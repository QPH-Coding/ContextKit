export interface Source {
  id: string;
  name: string;
  type: "git" | "local";
  url?: string;
  path?: string;
  branch?: string;
  local_path: string;
  mode: "reference" | "copy";
  last_scan_at?: string;
  config_count?: number;
  configs: ConfigSummary[];
  ignore_dirs: string[];
}

export interface ConfigSummary {
  id: string;
  name: string;
  kind: "skill" | "rule" | "agent" | "mcp";
  source_id: string;
  source_name: string;
  relative_path: string;
  token_count: number;
}

export interface ConfigDetail extends ConfigSummary {
  absolute_path: string;
  content: string;
  assigned_agents: string[];
}

export interface Assignment {
  config_id: string;
  agent_id: string;
  project_path?: string;
  assigned_at: string;
}

export interface Stats {
  source_count: number;
  total_configs: number;
  configs_by_kind: Record<string, number>;
  configs_by_agent: Record<string, number>;
  total_tokens: number;
  tokens_by_agent: Record<string, number>;
  tokens_by_kind: Record<string, number>;
}

export interface Settings {
  config_dir: string;
  default_sync_mode: "reference" | "copy";
}

export interface AgentInfo {
  id: string;
  name: string;
  supported_kinds: ("skill" | "rule" | "agent" | "mcp")[];
  supports_user_scope: boolean;
  supports_project_scope: boolean;
}

export interface AgentSetting {
  id: string;
  name: string;
  detected_dir?: string;
  custom_dir?: string;
}

export interface ConfigsGroup {
  source_id: string;
  source_name: string;
  configs: ConfigSummary[];
}

export interface DirNode {
  name: string;
  relative_path: string;
  has_children: boolean;
}
