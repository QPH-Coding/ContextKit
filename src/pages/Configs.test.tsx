import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Configs from "./Configs";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn((cmd: string, args?: Record<string, unknown>) => {
    switch (cmd) {
      case "list_configs":
        return Promise.resolve([
          {
            id: "config-1",
            name: "demo-config",
            kind: "rule",
            source_id: "source-1",
            source_name: "Demo Source",
            relative_path: "rules/demo.md",
            token_count: 12,
          },
        ]);
      case "get_config":
        return Promise.resolve({
          id: args?.id,
          name: "demo-config",
          kind: "rule",
          source_id: "source-1",
          source_name: "Demo Source",
          relative_path: "rules/demo.md",
          absolute_path: "/tmp/rules/demo.md",
          token_count: 12,
          content: "# Demo",
          assigned_agents: [],
        });
      case "list_agents":
      case "list_assignments":
        return Promise.resolve([]);
      default:
        return Promise.resolve(null);
    }
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: vi.fn(() => true),
}));

function renderConfigs() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={["/configs"]}>
      <QueryClientProvider client={queryClient}>
        <Configs />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("Configs", () => {
  it("opens config detail with a visible Back action and closes it", async () => {
    renderConfigs();

    const configButton = await screen.findByRole("button", {
      name: /demo-config/i,
    });
    fireEvent.click(configButton);

    expect(await screen.findByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(await screen.findByText("# Demo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    await waitFor(() => {
      expect(screen.queryByText("# Demo")).not.toBeInTheDocument();
    });
  });
});
