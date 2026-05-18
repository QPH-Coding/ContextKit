import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sourceApi } from "@/lib/api";
import { formatTokenCount } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus,
  Trash2,
  RefreshCw,
  Database,
  X,
  FolderOpen,
  GitBranch,
  Settings2,
  Loader2,
  Download,
  Bell,
  HardDrive,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

export default function Sources() {
  const queryClient = useQueryClient();
  const [urlOrPath, setUrlOrPath] = useState("");
  const [name, setName] = useState("");
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [ignoreInput, setIgnoreInput] = useState("");
  const [updateStatus, setUpdateStatus] = useState<Record<string, boolean>>({});
  const [drawerName, setDrawerName] = useState("");
  const [drawerIgnoreDirs, setDrawerIgnoreDirs] = useState<string[]>([]);

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

  const activeSource = sources?.find((s) => s.id === configuringId) ?? null;

  useEffect(() => {
    if (activeSource) {
      setDrawerName(activeSource.name);
      setDrawerIgnoreDirs(activeSource.ignore_dirs ?? []);
      setIgnoreInput("");
    }
  }, [activeSource?.id]);

  const addMutation = useMutation({
    mutationFn: () => sourceApi.addSource(urlOrPath, name || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setUrlOrPath("");
      setName("");
      toast.success("Source added.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => sourceApi.removeSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Source removed.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => sourceApi.syncSource(id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Source synced.");
    },
    onError: (err) => {
      toast.error(`Sync failed: ${errorMessage(err)}`);
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      dirs,
    }: {
      id: string;
      name: string;
      dirs: string[];
    }) => {
      await sourceApi.updateSourceName(id, name);
      await sourceApi.updateSourceIgnoreDirs(id, dirs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setConfiguringId(null);
      toast.success("Source configuration saved.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const checkAllUpdatesMutation = useMutation({
    mutationFn: () => sourceApi.checkAllSourceUpdates(),
    onSuccess: (results) => {
      const status: Record<string, boolean> = {};
      let hasAny = false;
      for (const [id, has] of results) {
        status[id] = has;
        if (has) hasAny = true;
      }
      setUpdateStatus(status);
      if (hasAny) {
        toast.success("Updates available for some sources.");
      } else {
        toast.success("All sources are up to date.");
      }
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const pullUpdatesMutation = useMutation({
    mutationFn: (id: string) => sourceApi.pullSourceUpdates(id),
    onSuccess: (_, id) => {
      setUpdateStatus((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Source updated.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const pullAllUpdatesMutation = useMutation({
    mutationFn: () => sourceApi.pullAllSourceUpdates(),
    onSuccess: (results) => {
      setUpdateStatus((prev) => {
        const next = { ...prev };
        for (const [id] of results) {
          delete next[id];
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`Updated ${results.length} source(s).`);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

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

  const simplifyUrl = (url?: string) => {
    if (!url) return "";
    return url
      .replace(/^https:\/\//, "")
      .replace(/^http:\/\//, "")
      .replace(/^git@/, "")
      .replace(/\.git$/, "");
  };

  const hasAnyUpdates = Object.values(updateStatus).some(Boolean);
  const updateCount = Object.values(updateStatus).filter(Boolean).length;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Sources</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => checkAllUpdatesMutation.mutate()}
            disabled={checkAllUpdatesMutation.isPending || !sources?.length}
          >
            {checkAllUpdatesMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <GitBranch className="w-3.5 h-3.5" />
            )}
            Check Updates
          </Button>
          {hasAnyUpdates && (
            <Button
              type="button"
              size="sm"
              onClick={() => pullAllUpdatesMutation.mutate()}
              disabled={pullAllUpdatesMutation.isPending}
            >
              {pullAllUpdatesMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Update All ({updateCount})
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Add Source</h3>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_10rem_auto] lg:items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Git URL or local path
            </Label>
            <Input
              type="text"
              value={urlOrPath}
              onChange={(e) => setUrlOrPath(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={openFilePicker}
            className="sm:self-end"
            title="Select local directory"
            aria-label="Select local directory"
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Name (optional)
            </Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={() => addMutation.mutate()}
            disabled={!urlOrPath || addMutation.isPending}
            className="sm:self-end"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        {addMutation.isError && (
          <p className="text-sm text-destructive">
            {String(addMutation.error)}
          </p>
        )}
      </Card>

      <Card className="p-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {isError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{errorMessage(error)}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              Retry
            </Button>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => {
              const kindCounts = getKindCounts(source.configs ?? []);
              const totalTokens = (source.configs ?? []).reduce(
                (sum, c) => sum + c.token_count,
                0
              );
              const hasUpdate = updateStatus[source.id];
              return (
                <Card
                  key={source.id}
                  className={`flex flex-col p-4 transition-shadow ${
                    hasUpdate
                      ? "ring-1 ring-amber-500/50 shadow-md dark:ring-amber-400/40"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{source.name}</p>
                    </div>
                    {hasUpdate && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                      >
                        <Bell className="w-3 h-3" />
                        Update
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {source.type === "git" ? (
                      <>
                        <GitBranch className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {simplifyUrl(source.url)}
                          {source.branch ? ` · ${source.branch}` : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <HardDrive className="w-3 h-3 shrink-0" />
                        <span className="truncate">{source.path}</span>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {source.last_scan_at
                      ? `Scanned ${new Date(
                          source.last_scan_at
                        ).toLocaleDateString()}`
                      : "Not scanned yet"}
                  </p>

                  <div className="mt-auto pt-4 flex items-center gap-2">
                    {source.type === "git" && (
                      <Button
                        type="button"
                        variant={hasUpdate ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                          pullUpdatesMutation.mutate(source.id)
                        }
                        disabled={pullUpdatesMutation.isPending}
                        title="Update & Scan"
                      >
                        {pullUpdatesMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        Update
                      </Button>
                    )}
                    {source.type === "local" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => syncMutation.mutate(source.id)}
                        disabled={syncMutation.isPending}
                        title="Scan"
                      >
                        {syncMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Scan
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfiguringId(source.id)}
                      title="Configure"
                      aria-label={`Configure ${source.name}`}
                    >
                      <Settings2 className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeMutation.mutate(source.id)}
                      disabled={removeMutation.isPending}
                      className="text-destructive hover:bg-destructive/10"
                      title="Remove"
                      aria-label={`Remove ${source.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <Sheet
        open={!!configuringId}
        onOpenChange={(open) => !open && setConfiguringId(null)}
      >
        <SheetContent className="w-full max-w-lg">
          <SheetHeader>
            <SheetTitle>Configure Source</SheetTitle>
            <SheetDescription>{activeSource?.name ?? ""}</SheetDescription>
          </SheetHeader>
          {activeSource && (
            <div className="mt-6 space-y-5">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <Input
                    type="text"
                    value={drawerName}
                    onChange={(e) => setDrawerName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    {activeSource.type === "git" ? (
                      <>
                        <GitBranch className="w-3.5 h-3.5" />
                        Git
                      </>
                    ) : (
                      <>
                        <HardDrive className="w-3.5 h-3.5" />
                        Local
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Source</Label>
                  <p className="mt-1 text-sm text-muted-foreground break-all">
                    {activeSource.type === "git"
                      ? activeSource.url
                      : activeSource.path}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium">
                  Ignore Directories
                </Label>
                <div className="mt-2 space-y-1">
                  {drawerIgnoreDirs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No ignored directories yet.
                    </p>
                  )}
                  {drawerIgnoreDirs.map((dir) => (
                    <div
                      key={dir}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 text-sm"
                    >
                      <span className="truncate">{dir}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setDrawerIgnoreDirs((prev) =>
                            prev.filter((d) => d !== dir)
                          )
                        }
                        aria-label={`Stop ignoring ${dir}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row mt-3">
                  <Input
                    type="text"
                    placeholder="Directory name to ignore"
                    value={ignoreInput}
                    onChange={(e) => setIgnoreInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (!ignoreInput.trim()) return;
                        setDrawerIgnoreDirs((prev) => [
                          ...prev,
                          ignoreInput.trim(),
                        ]);
                        setIgnoreInput("");
                      }
                    }}
                    aria-label="Directory name to ignore"
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!ignoreInput.trim()) return;
                      setDrawerIgnoreDirs((prev) => [
                        ...prev,
                        ignoreInput.trim(),
                      ]);
                      setIgnoreInput("");
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfiguringId(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    saveConfigMutation.mutate({
                      id: activeSource.id,
                      name: drawerName.trim(),
                      dirs: drawerIgnoreDirs,
                    })
                  }
                  disabled={
                    !drawerName.trim() || saveConfigMutation.isPending
                  }
                >
                  {saveConfigMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
