import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow"
      >
        Skip to main content
      </a>
      <Sidebar />
      <main
        id="main-content"
        className="min-w-0 flex-1 overflow-auto p-4 sm:p-6"
      >
        <Outlet />
      </main>
    </div>
  );
}
