import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
  it("renders navigation links", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText("ContextKit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sources/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/i })).toBeInTheDocument();
  });

  it("highlights active route", () => {
    render(
      <MemoryRouter initialEntries={["/sources"]}>
        <Sidebar />
      </MemoryRouter>
    );
    const sourcesLink = screen.getByRole("link", { name: /Sources/i });
    expect(sourcesLink).toHaveClass("bg-primary");
  });
});
