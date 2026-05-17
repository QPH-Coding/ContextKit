import { invoke } from "@tauri-apps/api/core";
import type {
  Source,
  ConfigSummary,
  ConfigDetail,
  Assignment,
  Stats,
  Settings,
} from "./types";

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  return invoke<T>(command, args);
}

// Source management
export const sourceApi = {
  addSource: (urlOrPath: string, name?: string) =>
    invokeCommand<Source>("add_source", { urlOrPath, name }),
  removeSource: (id: string) =>
    invokeCommand<void>("remove_source", { id }),
  listSources: () => invokeCommand<Source[]>("list_sources", {}),
  syncSource: (id: string) =>
    invokeCommand<ConfigSummary[]>("sync_source", { id }),
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
  updateSettings: (settings: Settings) =>
    invokeCommand<void>("update_settings", { settings }),
};
