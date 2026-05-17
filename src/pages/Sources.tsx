import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sourceApi } from "@/lib/api";
import { Plus, Trash2, RefreshCw, Database } from "lucide-react";

export default function Sources() {
  const queryClient = useQueryClient();
  const [urlOrPath, setUrlOrPath] = useState("");
  const [name, setName] = useState("");

  const { data: sources, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: sourceApi.listSources,
  });

  const addMutation = useMutation({
    mutationFn: () => sourceApi.addSource(urlOrPath, name || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setUrlOrPath("");
      setName("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => sourceApi.removeSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => sourceApi.syncSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">Sources</h2>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Add Source</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Git URL or local path"
            value={urlOrPath}
            onChange={(e) => setUrlOrPath(e.target.value)}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-40 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => addMutation.mutate()}
            disabled={!urlOrPath || addMutation.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        {addMutation.isError && (
          <p className="text-sm text-destructive">
            {String(addMutation.error)}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        )}
        {!isLoading && (!sources || sources.length === 0) && (
          <div className="p-8 text-center text-muted-foreground">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No sources yet.</p>
          </div>
        )}
        {sources && sources.length > 0 && (
          <div className="divide-y">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.local_path.toString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {source.config_count ?? 0} configs
                    {source.last_scan_at
                      ? ` · Scanned ${new Date(
                          source.last_scan_at
                        ).toLocaleDateString()}`
                      : " · Not scanned yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => syncMutation.mutate(source.id)}
                    disabled={syncMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    title="Sync & Scan"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Sync
                  </button>
                  <button
                    onClick={() => removeMutation.mutate(source.id)}
                    disabled={removeMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
