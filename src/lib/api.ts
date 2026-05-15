import { invoke } from "@tauri-apps/api/core";

// Core API wrapper for Tauri invoke calls
export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

// Source management
export const sourceApi = {
  addSource: (urlOrPath: string, name?: string) =>
    invokeCommand("add_source", { urlOrPath, name }),
  removeSource: (id: string) =>
    invokeCommand("remove_source", { id }),
  listSources: () =>
    invokeCommand("list_sources", {}),
  syncSource: (id: string) =>
    invokeCommand("sync_source", { id }),
};

// Config queries
export const configApi = {
  listConfigs: (kind?: string, sourceId?: string) =>
    invokeCommand("list_configs", { kind, sourceId }),
  getConfig: (id: string) =>
    invokeCommand("get_config", { id }),
};

// Assignment management
export const assignmentApi = {
  assignConfig: (configId: string, agentId: string, scope: string, projectPath?: string) =>
    invokeCommand("assign_config", { configId, agentId, scope, projectPath }),
  unassignConfig: (configId: string, agentId: string) =>
    invokeCommand("unassign_config", { configId, agentId }),
  listAssignments: (configId?: string, agentId?: string) =>
    invokeCommand("list_assignments", { configId, agentId }),
};

// Global
export const globalApi = {
  getStats: () => invokeCommand("get_stats", {}),
  getSettings: () => invokeCommand("get_settings", {}),
  updateSettings: (settings: unknown) =>
    invokeCommand("update_settings", { settings }),
};
