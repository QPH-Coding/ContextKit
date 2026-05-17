import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { globalApi, sourceApi, configApi } from "@/lib/api";
import { formatTokenCount } from "@/lib/format";
import { Database, FileText, Zap, Layers, Search } from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="w-8 h-8 text-muted-foreground opacity-50" />
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const { data: configs } = useQuery({
    queryKey: ["configs", ""],
    queryFn: () => configApi.listConfigs(),
  });

  const results =
    configs?.filter((c) => {
      if (!query) return false;
      const q = query.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.source_name.toLowerCase().includes(q) ||
        c.kind.toLowerCase().includes(q)
      );
    }) ?? [];

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search configs globally..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {query && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-card shadow-lg z-20 max-h-64 overflow-auto">
          {results.map((config) => (
            <button
              key={config.id}
              onClick={() => {
                navigate("/configs");
                setQuery("");
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
            >
              <span className="font-medium">{config.name}</span>
              <span className="text-muted-foreground ml-2">
                {config.kind} · {config.source_name}
              </span>
            </button>
          ))}
        </div>
      )}
      {query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-card shadow-lg z-20 p-3 text-sm text-muted-foreground">
          No configs found.
        </div>
      )}
    </div>
  );
}

const kindOrder = ["skill", "rule", "agent", "mcp"] as const;

function kindCountsText(configs: { kind: string }[]) {
  const counts: Record<string, number> = {};
  for (const c of configs) {
    counts[c.kind] = (counts[c.kind] || 0) + 1;
  }
  return kindOrder
    .filter((k) => (counts[k] || 0) > 0)
    .map((k) => `${counts[k]} ${k}${counts[k]! > 1 ? "s" : ""}`)
    .join(" · ") || "0 configs";
}

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: globalApi.getStats,
  });

  const { data: sources } = useQuery({
    queryKey: ["sources"],
    queryFn: sourceApi.listSources,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>

      <GlobalSearch />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Sources"
          value={stats?.source_count ?? 0}
          icon={Database}
        />
        <StatCard
          label="Skills"
          value={stats?.configs_by_kind?.skill ?? 0}
          icon={FileText}
        />
        <StatCard
          label="Rules"
          value={stats?.configs_by_kind?.rule ?? 0}
          icon={FileText}
        />
        <StatCard
          label="Tokens"
          value={formatTokenCount(stats?.total_tokens ?? 0)}
          icon={Zap}
        />
        <StatCard
          label="Assignments"
          value={
            Object.values(stats?.configs_by_agent ?? {}).reduce(
              (a, b) => a + b,
              0
            ) ?? 0
          }
          icon={Layers}
        />
      </div>

      {sources && sources.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3">Sources</h3>
          <div className="space-y-2">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {kindCountsText(source.configs ?? [])}
                    {source.last_scan_at
                      ? ` · Last scan: ${new Date(
                          source.last_scan_at
                        ).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!sources || sources.length === 0) && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No sources yet. Go to{" "}
            <Link to="/sources" className="text-primary underline">
              Sources
            </Link>{" "}
            to add one.
          </p>
        </div>
      )}
    </div>
  );
}
