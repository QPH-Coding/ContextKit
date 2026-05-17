import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sourceApi } from "@/lib/api";
import { formatTokenCount } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import {
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Database,
  Pencil,
  Check,
  X,
  FolderOpen,
  GitBranch,
  ArrowDownCircle,
  Settings2,
  Loader2,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

type Notice = {
  tone: "success" | "error";
  message: string;
};

export default function Sources() {
  const queryClient = useQueryClient();
  const [urlOrPath, setUrlOrPath] = useState("");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [ignoreInput, setIgnoreInput] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const {
    data: sources,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sources"],
    queryFn: sourceApi.listSources,
    retry: false,
  });

  const addMutation = useMutation({
    mutationFn: () => sourceApi.addSource(urlOrPath, name || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setUrlOrPath("");
      setName("");
      setNotice({ tone: "success", message: "Source added." });
    },
    onError: (err) => {
      setNotice({ tone: "error", message: errorMessage(err) });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => sourceApi.removeSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setNotice({ tone: "success", message: "Source removed." });
    },
    onError: (err) => {
      setNotice({ tone: "error", message: errorMessage(err) });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => sourceApi.syncSource(id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setNotice({ tone: "success", message: "Source synced." });
    },
    onError: (err) => {
      setNotice({ tone: "error", message: `Sync failed: ${errorMessage(err)}` });
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      sourceApi.updateSourceName(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setEditingId(null);
      setNotice({ tone: "success", message: "Source name updated." });
    },
    onError: (err) => {
      setNotice({ tone: "error", message: errorMessage(err) });
    },
  });

  const checkUpdatesMutation = useMutation({
    mutationFn: (id: string) => sourceApi.checkSourceUpdates(id),
    onSuccess: (hasUpdates, _id) => {
      setNotice({
        tone: "success",
        message: hasUpdates ? "New version available." : "Already up to date.",
      });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (err) => {
      setNotice({ tone: "error", message: errorMessage(err) });
    },
  });

  const pullUpdatesMutation = useMutation({
    mutationFn: (id: string) => sourceApi.pullSourceUpdates(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setNotice({ tone: "success", message: "Source updated." });
    },
    onError: (err) => {
      setNotice({ tone: "error", message: errorMessage(err) });
    },
  });

  const updateIgnoreDirsMutation = useMutation({
    mutationFn: ({ id, dirs }: { id: string; dirs: string[] }) =>
      sourceApi.updateSourceIgnoreDirs(id, dirs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setNotice({ tone: "success", message: "Ignore directories updated." });
    },
    onError: (err) => {
      setNotice({ tone: "error", message: errorMessage(err) });
    },
  });

  const startEditing = (source: { id: string; name: string }) => {
    setEditingId(source.id);
    setEditingName(source.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEditing = (id: string) => {
    if (editingName.trim()) {
      updateNameMutation.mutate({ id, name: editingName.trim() });
    }
  };

  const openFilePicker = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setUrlOrPath(selected);
    }
  };

  const kindOrder = ["skill", "rule", "agent", "mcp"] as const;

  const getKindCounts = (configs: { kind: string }[]) => {
    const counts: Record<string, number> = {};
    for (const c of configs) {
      counts[c.kind] = (counts[c.kind] || 0) + 1;
    }
    return counts;
  };

  const removeIgnoreDir = (sourceId: string, dir: string) => {
    const source = sources?.find((s) => s.id === sourceId);
    if (!source) return;
    const next = source.ignore_dirs.filter((d) => d !== dir);
    updateIgnoreDirsMutation.mutate({ id: sourceId, dirs: next });
  };

  const addIgnoreDir = (sourceId: string) => {
    if (!ignoreInput.trim()) return;
    const source = sources?.find((s) => s.id === sourceId);
    if (!source) return;
    const next = [...source.ignore_dirs, ignoreInput.trim()];
    updateIgnoreDirsMutation.mutate({ id: sourceId, dirs: next });
    setIgnoreInput("");
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold">Sources</h2>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Add Source</h3>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_10rem_auto] lg:items-end">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Git URL or local path
            </span>
            <input
              type="text"
              value={urlOrPath}
              onChange={(e) => setUrlOrPath(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={openFilePicker}
            className="inline-flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent sm:self-end"
            title="Select local directory"
            aria-label="Select local directory"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Name (optional)
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => addMutation.mutate()}
            disabled={!urlOrPath || addMutation.isPending}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:self-end"
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

      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${
            notice.tone === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
          }`}
          role="status"
        >
          <p>{notice.message}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-md p-0.5 hover:bg-black/5"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        )}
        {isError && (
          <div className="p-4 text-sm text-destructive">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Could not load sources</p>
                <p className="mt-1 break-words text-xs opacity-90">
                  {errorMessage(error)}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-3 rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium hover:bg-destructive/10"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}
        {!isLoading && !isError && (!sources || sources.length === 0) && (
          <div className="p-8 text-center text-muted-foreground">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-foreground">No sources yet</p>
            <p className="mt-1 text-sm">
              Add a Git repository or local folder above to start scanning
              configs.
            </p>
          </div>
        )}
        {!isError && sources && sources.length > 0 && (
          <div className="divide-y">
            {sources.map((source) => {
              const kindCounts = getKindCounts(source.configs ?? []);
              const totalTokens = (source.configs ?? []).reduce(
                (sum, c) => sum + c.token_count,
                0
              );
              return (
                <div key={source.id} className="p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {editingId === source.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  saveEditing(source.id);
                                if (e.key === "Escape") cancelEditing();
                              }}
                              className="w-40 rounded-md border bg-background px-2 py-1 text-sm"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveEditing(source.id)}
                              disabled={updateNameMutation.isPending}
                              className="p-1 rounded-md hover:bg-accent text-green-600"
                              aria-label={`Save name for ${source.name}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="p-1 rounded-md hover:bg-accent text-muted-foreground"
                              aria-label={`Cancel editing ${source.name}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="font-medium">{source.name}</p>
                            <button
                              type="button"
                              onClick={() => startEditing(source)}
                              className="p-1 rounded-md hover:bg-accent text-muted-foreground"
                              title="Edit name"
                              aria-label={`Edit ${source.name}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {source.type === "git"
                          ? `Git · ${source.url}${
                              source.branch ? ` · ${source.branch}` : ""
                            }`
                          : `Local · ${source.path}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {kindOrder
                          .filter((k) => (kindCounts[k] || 0) > 0)
                          .map((k) => (
                            <span key={k} className="capitalize">
                              {kindCounts[k]} {k}
                              {kindCounts[k]! > 1 ? "s" : ""}
                            </span>
                          ))}
                        {Object.keys(kindCounts).length === 0 && (
                          <span>0 configs</span>
                        )}
                        {totalTokens > 0 && (
                          <span>{formatTokenCount(totalTokens)} tokens</span>
                        )}
                        {source.last_scan_at
                          ? ` · Scanned ${new Date(
                              source.last_scan_at
                            ).toLocaleDateString()}`
                          : " · Not scanned yet"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:justify-end">
                      {source.type === "git" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              checkUpdatesMutation.mutate(source.id)
                            }
                            disabled={checkUpdatesMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                            title="Check for updates"
                          >
                            {checkUpdatesMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <GitBranch className="w-3 h-3" />
                            )}
                            Check
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              pullUpdatesMutation.mutate(source.id)
                            }
                            disabled={pullUpdatesMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                            title="Pull latest version"
                          >
                            {pullUpdatesMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ArrowDownCircle className="w-3 h-3" />
                            )}
                            Pull
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => syncMutation.mutate(source.id)}
                        disabled={syncMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                        title="Sync & Scan"
                      >
                        {syncMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Sync
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfiguringId(
                            configuringId === source.id ? null : source.id
                          )
                        }
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 ${
                          configuringId === source.id ? "bg-accent" : ""
                        }`}
                        title="Configure"
                        aria-label={`Configure ${source.name}`}
                        aria-expanded={configuringId === source.id}
                      >
                        <Settings2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(source.id)}
                        disabled={removeMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        title="Remove"
                        aria-label={`Remove ${source.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {configuringId === source.id && (
                    <div className="rounded-md border bg-background p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Ignore Directories
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {source.ignore_dirs.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No ignored directories yet.
                          </p>
                        )}
                        {source.ignore_dirs.map((dir) => (
                          <span
                            key={dir}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                          >
                            {dir}
                            <button
                              type="button"
                              onClick={() => removeIgnoreDir(source.id, dir)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Stop ignoring ${dir}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          placeholder="Directory name to ignore"
                          value={ignoreInput}
                          onChange={(e) => setIgnoreInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              addIgnoreDir(source.id);
                          }}
                          aria-label="Directory name to ignore"
                          className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => addIgnoreDir(source.id)}
                          className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
