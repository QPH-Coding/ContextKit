import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { configApi } from "@/lib/api";
import { FileText, Filter } from "lucide-react";

const kindOptions = [
  { value: "", label: "All" },
  { value: "skill", label: "Skill" },
  { value: "rule", label: "Rule" },
  { value: "agent", label: "Agent" },
  { value: "mcp", label: "MCP" },
];

export default function Configs() {
  const [kind, setKind] = useState("");

  const { data: configs, isLoading } = useQuery({
    queryKey: ["configs", kind],
    queryFn: () => configApi.listConfigs(kind || undefined),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Configs</h2>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {kindOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        )}
        {!isLoading && (!configs || configs.length === 0) && (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No configs found.</p>
            <p className="text-sm mt-1">
              Add a source and sync it to discover configs.
            </p>
          </div>
        )}
        {configs && configs.length > 0 && (
          <div className="divide-y">
            {configs.map((config) => (
              <div key={config.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        config.kind === "skill"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : config.kind === "rule"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : config.kind === "agent"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                      }`}
                    >
                      {config.kind}
                    </span>
                    <span className="font-medium">{config.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {config.token_count} tokens
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {config.source_name} · {config.relative_path}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
