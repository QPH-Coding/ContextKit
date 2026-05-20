import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Settings,
  Wrench,
  Shield,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import McpIcon from "@/components/McpIcon";

const topNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/sources", label: "Sources", icon: Database },
];

const contextNavItems = [
  { path: "/context/skills", label: "Skills", icon: Wrench },
  { path: "/context/rules", label: "Rules", icon: Shield },
  { path: "/context/agents", label: "Agents", icon: Bot },
  { path: "/context/mcps", label: "MCPs", icon: McpIcon },
];

const bottomNavItems = [
  { path: "/settings", label: "Settings", icon: Settings },
];

function NavButton({ item }: { item: { path: string; label: string; icon: React.ElementType } }) {
  const location = useLocation();
  const Icon = item.icon;
  const isActive = location.pathname === item.path;
  return (
    <Button
      key={item.path}
      asChild
      variant={isActive ? "default" : "ghost"}
      className="justify-start shrink-0 md:w-full"
      aria-current={isActive ? "page" : undefined}
    >
      <Link to={item.path}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {item.label}
      </Link>
    </Button>
  );
}

export default function Sidebar() {
  return (
    <aside className="sticky top-0 z-20 flex h-auto w-full flex-col border-b bg-card md:h-screen md:w-56 md:border-b-0 md:border-r">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <img
            src="/icon.png"
            alt="ContextKit"
            className="h-8 w-8 object-contain rounded"
          />
          <h1 className="text-lg font-bold tracking-tight">ContextKit</h1>
        </div>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:space-y-1 md:overflow-visible"
        aria-label="Primary navigation"
      >
        {topNavItems.map((item) => (
          <NavButton key={item.path} item={item} />
        ))}

        <div className="pt-2 pb-1">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:block">
            Context
          </p>
          <div className="flex gap-1 md:flex-col md:space-y-1 md:mt-1">
            {contextNavItems.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}
          </div>
        </div>

        <div className="flex-1" />

        {bottomNavItems.map((item) => (
          <NavButton key={item.path} item={item} />
        ))}
      </nav>
    </aside>
  );
}
