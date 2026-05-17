import { useQuery } from "@tanstack/react-query";
import { globalApi, sourceApi } from "@/lib/api";
import { Database, FileText, Zap, Layers } from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
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
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Sources"
          value={stats?.source_count ?? 0}
          icon={Database}
        />
        <StatCard
          label="Configs"
          value={stats?.total_configs ?? 0}
          icon={FileText}
        />
        <StatCard
          label="Tokens"
          value={stats?.total_tokens ?? 0}
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
                    {source.config_count ?? 0} configs
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
            <a href="#/sources" className="text-primary underline">
              Sources
            </a>{" "}
            to add one.
          </p>
        </div>
      )}
    </div>
  );
}
