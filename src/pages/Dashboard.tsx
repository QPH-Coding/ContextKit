import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { globalApi, sourceApi, configApi } from "@/lib/api";
import { formatTokenCount } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Database,
  FileText,
  Zap,
  Layers,
  Search,
} from "lucide-react";

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

  const { data: configs, isError } = useQuery({
    queryKey: ["configs", ""],
    queryFn: () => configApi.listConfigs(),
    retry: false,
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
          aria-label="Search configs globally"
          placeholder="Search configs globally..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {query && isError && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-card shadow-lg z-20 p-3 text-sm text-muted-foreground">
          Search is unavailable while ContextKit is disconnected.
        </div>
      )}
      {query && !isError && results.length > 0 && (
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
      {query && !isError && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-card shadow-lg z-20 p-3 text-sm text-muted-foreground">
          No configs found.
        </div>
      )}
    </div>
  );
}

function ErrorPanel({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-1 break-words text-xs opacity-90">
            {errorMessage(error)}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium hover:bg-destructive/10"
          >
            Retry
          </button>
        </div>
      </div>
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
  const {
    data: stats,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["stats"],
    queryFn: globalApi.getStats,
    retry: false,
  });

  const {
    data: sources,
    isError: isSourcesError,
    error: sourcesError,
    refetch: refetchSources,
  } = useQuery({
    queryKey: ["sources"],
    queryFn: sourceApi.listSources,
    retry: false,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>

      <GlobalSearch />

      {isStatsError && (
        <ErrorPanel
          title="Could not load dashboard stats"
          error={statsError}
          onRetry={() => refetchStats()}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

      {isSourcesError && (
        <ErrorPanel
          title="Could not load sources"
          error={sourcesError}
          onRetry={() => refetchSources()}
        />
      )}

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

      {!isSourcesError && (!sources || sources.length === 0) && (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center">
          <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No sources yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Add a Git repository or local folder, then sync it to discover
            skills, rules, agents, and MCP configs.
          </p>
          <Link
            to="/sources"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add source
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
