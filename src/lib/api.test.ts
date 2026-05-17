import { describe, it, expect, vi } from "vitest";
import { invokeCommand, sourceApi, configApi, globalApi } from "./api";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd: string, args?: Record<string, unknown>) => {
    return Promise.resolve({ cmd, args });
  }),
  isTauri: vi.fn(() => true),
}));

describe("api wrappers", () => {
  it("invokeCommand forwards to tauri invoke", async () => {
    const result = await invokeCommand("test_cmd", { key: "value" });
    expect(result).toEqual({ cmd: "test_cmd", args: { key: "value" } });
  });

  it("sourceApi.addSource calls add_source", async () => {
    const result = await sourceApi.addSource("/path", "name");
    expect(result).toEqual({
      cmd: "add_source",
      args: { urlOrPath: "/path", name: "name" },
    });
  });

  it("sourceApi.listSources calls list_sources", async () => {
    const result = await sourceApi.listSources();
    expect(result).toEqual({ cmd: "list_sources", args: {} });
  });

  it("configApi.listConfigs calls list_configs", async () => {
    const result = await configApi.listConfigs("skill", "src1");
    expect(result).toEqual({
      cmd: "list_configs",
      args: { kind: "skill", sourceId: "src1" },
    });
  });

  it("globalApi.getStats calls get_stats", async () => {
    const result = await globalApi.getStats();
    expect(result).toEqual({ cmd: "get_stats", args: {} });
  });

  it("sourceApi.syncSource calls sync_source with force", async () => {
    const result = await sourceApi.syncSource("src1", true);
    expect(result).toEqual({
      cmd: "sync_source",
      args: { id: "src1", force: true },
    });
  });

  it("globalApi.updateSettings calls update_settings", async () => {
    const result = await globalApi.updateSettings("copy");
    expect(result).toEqual({
      cmd: "update_settings",
      args: { mode: "copy" },
    });
  });

  it("globalApi.listAgents calls list_agents", async () => {
    const result = await globalApi.listAgents();
    expect(result).toEqual({ cmd: "list_agents", args: {} });
  });
});
