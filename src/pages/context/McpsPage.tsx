import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mcpApi, assignmentApi, globalApi } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  Trash2,
  Search,
  Package,
  Globe,
  Edit,
  ArrowLeft,
} from "lucide-react";
import McpIcon from "@/components/McpIcon";
import McpForm from "@/components/context/McpForm";
import McpFormDialog from "@/components/context/McpFormDialog";
import type { McpConfig } from "@/lib/types";
import AgentIcon from "@/components/AgentIcon";

export default function McpsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMcps, setSelectedMcps] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [detailMcp, setDetailMcp] = useState<McpConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");

  const {
    data: mcps,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["mcps"],
    queryFn: mcpApi.listMcps,
    retry: false,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: globalApi.getSettings,
    retry: false,
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: globalApi.listAgents,
    retry: false,
  });

  const { data: allAssignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => assignmentApi.listAssignments(),
    retry: false,
  });

  const assignMutation = useMutation({
    mutationFn: (vars: { configId: string; agentId: string }) =>
      assignmentApi.assignConfig(vars.configId, vars.agentId, "user", undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (vars: { configId: string; agentId: string }) =>
      assignmentApi.unassignConfig(vars.configId, vars.agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => mcpApi.removeMcp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcps"] });
      toast.success("MCP server removed.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const batchRemoveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => mcpApi.removeMcp(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcps"] });
      setSelectedMcps(new Set());
      setBatchMode(false);
      toast.success("Selected MCP servers removed.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const filtered =
    mcps?.filter(
      (m) =>
        !search ||
        m.id.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.command?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (m.url?.toLowerCase().includes(search.toLowerCase()) ?? false)
    ) ?? [];

  const existingIds = mcps?.map((m) => m.id) ?? [];

  const pinnedAgentIds = settings?.pinned_agents ?? [];
  const activeQuickAgents =
    agents?.filter((a) => pinnedAgentIds.includes(a.id)) ?? [];

  const assignmentMap = new Map<string, Set<string>>();
  if (allAssignments) {
    for (const a of allAssignments) {
      if (!assignmentMap.has(a.config_id)) {
        assignmentMap.set(a.config_id, new Set());
      }
      assignmentMap.get(a.config_id)!.add(a.agent_id);
    }
  }

  const isAssigned = (configId: string, agentId: string) =>
    assignmentMap.get(configId)?.has(agentId) ?? false;

  const getQuickAgentsForMcp = (mcp: McpConfig) => {
    const compatible = activeQuickAgents.filter(
      (a) => a.supported_kinds.includes("mcp") && a.supports_user_scope
    );
    const sorted = [...compatible].sort((a, b) => {
      const aAssigned = isAssigned(mcp.id, a.id);
      const bAssigned = isAssigned(mcp.id, b.id);
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      return a.name.localeCompare(b.name);
    });
    return sorted.slice(0, 4);
  };

  const toggleSelection = (id: string) => {
    setSelectedMcps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedMcps(new Set(filtered.map((m) => m.id)));
  };

  const deselectAll = () => {
    setSelectedMcps(new Set());
  };

  const allSelected = filtered.length > 0 && filtered.every((m) => selectedMcps.has(m.id));

  const handleOpenDetail = (mcp: McpConfig) => {
    if (batchMode) return;
    setDetailMcp(mcp);
    setIsEditing(false);
  };

  const handleCloseDetail = () => {
    setDetailMcp(null);
    setIsEditing(false);
  };

  const handleOpenAdd = () => {
    setDetailMcp(null);
    setFormMode("add");
    setFormOpen(true);
  };

  const transportBadgeClass = (t: string) => {
    if (t === "stdio") return "bg-blue-100 text-blue-800";
    if (t === "sse") return "bg-purple-100 text-purple-800";
    return "bg-orange-100 text-orange-800";
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-2xl font-bold">MCPs</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              aria-label="Search MCPs"
              placeholder="Search MCPs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {!batchMode && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setBatchMode(true)}
              className="gap-1.5"
            >
              <Package className="w-3.5 h-3.5" />
              Bulk
            </Button>
          )}
          <Button type="button" size="sm" className="gap-1" onClick={handleOpenAdd}>
            <McpIcon className="w-3.5 h-3.5" />
            Add MCP
          </Button>
        </div>
      </div>

      {batchMode && filtered.length > 0 && (
        <Card className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) =>
                  checked === true ? selectAll() : deselectAll()
                }
              />
              <span className="text-sm font-medium">{selectedMcps.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBatchMode(false);
                  setSelectedMcps(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={selectedMcps.size === 0 || batchRemoveMutation.isPending}
                onClick={() => batchRemoveMutation.mutate(Array.from(selectedMcps))}
                className="gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
      {isError && (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{errorMessage(error)}</p>
        </div>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          <McpIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No MCP servers configured.</p>
          <p className="text-sm mt-1">Add an MCP server using the button above.</p>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((mcp) => (
          <Card
            key={mcp.id}
            className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer transition-colors hover:bg-accent/30 ${
              batchMode && selectedMcps.has(mcp.id) ? "bg-primary/5" : ""
            }`}
            onClick={() => handleOpenDetail(mcp)}
          >
            <div className="min-w-0 flex-1 flex items-start gap-3">
              {batchMode && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(mcp.id);
                  }}
                >
                  <Checkbox checked={selectedMcps.has(mcp.id)} className="mt-0.5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{mcp.name}</span>
                  {mcp.id !== mcp.name && (
                    <Badge variant="outline" className="text-xs">
                      {mcp.id}
                    </Badge>
                  )}
                  <Badge variant="secondary" className={`text-[10px] ${transportBadgeClass(mcp.transport)}`}>
                    {mcp.transport}
                  </Badge>
                </div>
                {mcp.transport === "stdio" ? (
                  <code className="block text-xs text-muted-foreground mt-1 font-mono truncate">
                    {mcp.command}
                    {mcp.args && mcp.args.length > 0 && ` ${mcp.args.join(" ")}`}
                  </code>
                ) : (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Globe className="w-3 h-3" />
                    <span className="truncate">{mcp.url}</span>
                  </div>
                )}
                {mcp.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{mcp.description}</p>
                )}
                {mcp.transport === "stdio" && mcp.env && Object.keys(mcp.env).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(mcp.env).map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="text-[10px] font-mono">
                        {key}={value}
                      </Badge>
                    ))}
                  </div>
                )}
                {(mcp.transport === "sse" || mcp.transport === "streamable-http") &&
                  mcp.headers &&
                  Object.keys(mcp.headers).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(mcp.headers).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-[10px] font-mono">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  )}
              </div>
            </div>
            {!batchMode && (
              <div className="flex items-center gap-1 shrink-0">
                {getQuickAgentsForMcp(mcp).map((agent) => {
                  const assigned = isAssigned(mcp.id, agent.id);
                  return (
                    <Button
                      type="button"
                      key={agent.id}
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        assigned
                          ? unassignMutation.mutate({
                              configId: mcp.id,
                              agentId: agent.id,
                            })
                          : assignMutation.mutate({
                              configId: mcp.id,
                              agentId: agent.id,
                            });
                      }}
                      disabled={
                        assignMutation.isPending || unassignMutation.isPending
                      }
                      className={`text-xs disabled:opacity-50 ${
                        assigned
                          ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300"
                          : "hover:bg-accent"
                      }`}
                      title={
                        assigned
                          ? `Uninstall from ${agent.name}`
                          : `Install to ${agent.name}`
                      }
                      aria-label={
                        assigned
                          ? `Uninstall ${mcp.name} from ${agent.name}`
                          : `Install ${mcp.name} to ${agent.name}`
                      }
                      aria-pressed={assigned}
                    >
                      <AgentIcon
                        agentId={agent.id}
                        size={18}
                        assigned={assigned}
                      />
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMutation.mutate(mcp.id);
                  }}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!detailMcp} onOpenChange={() => handleCloseDetail()}>
        <SheetContent className="w-[40%] min-w-[320px] p-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <SheetHeader className="flex flex-row items-center justify-between sm:flex-row sm:text-left">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseDetail}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </SheetHeader>

              {detailMcp && !isEditing && (
                <div className="space-y-6">
                  {/* Read-only detail */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{detailMcp.name}</span>
                      {detailMcp.id !== detailMcp.name && (
                        <Badge variant="outline">{detailMcp.id}</Badge>
                      )}
                      <Badge variant="secondary" className={transportBadgeClass(detailMcp.transport)}>
                        {detailMcp.transport}
                      </Badge>
                    </div>
                    {detailMcp.description && (
                      <p className="text-sm text-muted-foreground">{detailMcp.description}</p>
                    )}
                  </div>

                  {detailMcp.transport === "stdio" ? (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Command</h3>
                      <code className="block p-3 bg-muted rounded-md text-xs font-mono">
                        {detailMcp.command}
                        {detailMcp.args && detailMcp.args.length > 0 && ` ${detailMcp.args.join(" ")}`}
                      </code>
                      {detailMcp.env && Object.keys(detailMcp.env).length > 0 && (
                        <>
                          <h3 className="text-sm font-semibold">Environment Variables</h3>
                          <div className="space-y-2">
                            {Object.entries(detailMcp.env).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{key}</code>
                                <span className="text-muted-foreground">=</span>
                                <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                                  {value}
                                </code>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">URL</h3>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{detailMcp.url}</span>
                      </div>
                      {detailMcp.headers && Object.keys(detailMcp.headers).length > 0 && (
                        <>
                          <h3 className="text-sm font-semibold">Headers</h3>
                          <div className="space-y-2">
                            {Object.entries(detailMcp.headers).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{key}</code>
                                <span className="text-muted-foreground">:</span>
                                <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                                  {value}
                                </code>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      className="gap-1"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              )}

              {detailMcp && isEditing && (
                <McpForm
                  mode="edit"
                  initialData={detailMcp}
                  existingIds={existingIds}
                  onSuccess={() => {
                    setIsEditing(false);
                    setDetailMcp(null);
                  }}
                  onCancel={() => setIsEditing(false)}
                  cancelLabel="Cancel"
                />
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add Dialog */}
      <McpFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        existingIds={existingIds}
      />
    </div>
  );
}
