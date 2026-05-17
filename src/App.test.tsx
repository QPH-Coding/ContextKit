import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("App routing", () => {
  it("renders Dashboard on /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: "Dashboard" })
    ).toBeInTheDocument();
  });

  it("renders Sources on /sources", () => {
    render(
      <MemoryRouter initialEntries={["/sources"]}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: "Sources" })
    ).toBeInTheDocument();
  });

  it("renders Configs on /configs", () => {
    render(
      <MemoryRouter initialEntries={["/configs"]}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: "Configs" })
    ).toBeInTheDocument();
  });

  it("renders Settings on /settings", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: "Settings" })
    ).toBeInTheDocument();
  });
});
