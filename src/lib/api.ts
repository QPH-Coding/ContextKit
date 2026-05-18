import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  Source,
  ConfigSummary,
  ConfigDetail,
  DirNode,
  Assignment,
  Stats,
  Settings,
  AgentInfo,
  AgentSetting,
} from "./types";

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauri()) {
    throw new Error(
      "ContextKit must run inside the Tauri application. " +
        "Please start with 'bun tauri dev' instead of 'bun run dev'."
    );
  }
  return invoke<T>(command, args);
}

// Source management
export const sourceApi = {
  addSource: (urlOrPath: string, name?: string) =>
    invokeCommand<Source>("add_source", { urlOrPath, name }),
  removeSource: (id: string) =>
    invokeCommand<void>("remove_source", { id }),
  updateSourceName: (id: string, name: string) =>
    invokeCommand<void>("update_source_name", { id, name }),
  updateSourceIgnoreDirs: (id: string, ignoreDirs: string[]) =>
    invokeCommand<void>("update_source_ignore_dirs", { id, ignoreDirs }),
  checkSourceUpdates: (id: string) =>
    invokeCommand<boolean>("check_source_updates", { id }),
  checkAllSourceUpdates: () =>
    invokeCommand<[string, boolean][]>("check_all_source_updates", {}),
  pullSourceUpdates: (id: string) =>
    invokeCommand<ConfigSummary[]>("pull_source_updates", { id }),
  pullAllSourceUpdates: () =>
    invokeCommand<[string, ConfigSummary[]][]>("pull_all_source_updates", {}),
  getDirectoryTree: (id: string, relativePath?: string) =>
    invokeCommand<DirNode[]>("get_source_directory_tree", {
      id,
      relativePath: relativePath ?? "",
    }),
  listSources: () => invokeCommand<Source[]>("list_sources", {}),
  syncSource: (id: string, force?: boolean) =>
    invokeCommand<ConfigSummary[]>("sync_source", { id, force }),
};

// Config queries
export const configApi = {
  listConfigs: (kind?: string, sourceId?: string) =>
    invokeCommand<ConfigSummary[]>("list_configs", { kind, sourceId }),
  getConfig: (id: string) =>
    invokeCommand<ConfigDetail>("get_config", { id }),
};

// Assignment management
export const assignmentApi = {
  assignConfig: (
    configId: string,
    agentId: string,
    scope: string,
    projectPath?: string
  ) =>
    invokeCommand<void>("assign_config", {
      configId,
      agentId,
      scope,
      projectPath,
    }),
  unassignConfig: (configId: string, agentId: string) =>
    invokeCommand<void>("unassign_config", { configId, agentId }),
  listAssignments: (configId?: string, agentId?: string) =>
    invokeCommand<Assignment[]>("list_assignments", { configId, agentId }),
};

// Global
export const globalApi = {
  getStats: () => invokeCommand<Stats>("get_stats", {}),
  getSettings: () => invokeCommand<Settings>("get_settings", {}),
  updateSettings: (mode: "reference" | "copy") =>
    invokeCommand<void>("update_settings", { mode }),
  listAgents: () => invokeCommand<AgentInfo[]>("list_agents", {}),
  getAgentSettings: () => invokeCommand<AgentSetting[]>("list_agent_settings", {}),
  updateAgentDir: (agentId: string, dir?: string) =>
    invokeCommand<void>("update_agent_dir", { agentId, dir }),
};
