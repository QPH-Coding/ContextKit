import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  FileText,
  Settings,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/sources", label: "Sources", icon: Database },
  { path: "/configs", label: "Configs", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sticky top-0 z-20 flex h-auto w-full flex-col border-b bg-card md:h-screen md:w-56 md:border-b-0 md:border-r">
      <div className="border-b p-4">
        <h1 className="text-lg font-bold tracking-tight">ContextKit</h1>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:space-y-1 md:overflow-visible"
        aria-label="Primary navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors md:w-full ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
