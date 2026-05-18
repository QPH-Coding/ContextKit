import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { configApi, assignmentApi, globalApi } from "@/lib/api";
import { formatTokenCount } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import type { ConfigSummary, AgentInfo, ConfigDetail } from "@/lib/types";
import AgentIcon from "@/components/AgentIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  FileText,
  Filter,
  Search,
  X,
  User,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Zap,
  ArrowLeft,
} from "lucide-react";

const kindOptions = [
  { value: "all", label: "All" },
  { value: "skill", label: "Skill" },
  { value: "rule", label: "Rule" },
  { value: "agent", label: "Agent" },
  { value: "mcp", label: "MCP" },
];

function kindBadge(kind: string) {
  const variants: Record<string, string> = {
    skill: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-100",
    rule: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100",
    agent: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-100",
    mcp: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 hover:bg-orange-100",
  };
  return variants[kind] || "bg-gray-100 text-gray-800 hover:bg-gray-100";
}

function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, (v: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const setValue = (value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  return [state, setValue];
}

export default function Configs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const selectedId = searchParams.get("config");
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [quickAgents, setQuickAgents] = useLocalStorageState<string[]>(
    "ck-quick-agents",
    []
  );
  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(new Set());
  const backButtonRef = useRef<HTMLButtonElement>(null);

  const queryClient = useQueryClient();

  const {
    data: configs,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["configs", kind],
    queryFn: () => configApi.listConfigs(kind === "all" ? undefined : kind),
    retry: false,
  });

  const {
    data: detail,
    isLoading: isDetailLoading,
    isError: isDetailError,
    error: detailError,
  } = useQuery({
    queryKey: ["config", selectedId],
    queryFn: () => configApi.getConfig(selectedId!),
    enabled: !!selectedId,
    retry: false,
  });

  const {
    data: agents,
    isLoading: isAgentsLoading,
    isError: isAgentsError,
    error: agentsError,
  } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ["config"] });
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
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const filteredConfigs =
    configs?.filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.source_name.toLowerCase().includes(q) ||
        c.relative_path.toLowerCase().includes(q) ||
        c.kind.toLowerCase().includes(q)
      );
    }) ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, { source_id: string; source_name: string; configs: ConfigSummary[] }>();
    for (const c of filteredConfigs) {
      if (!map.has(c.source_id)) {
        map.set(c.source_id, {
          source_id: c.source_id,
          source_name: c.source_name,
          configs: [],
        });
      }
      map.get(c.source_id)!.configs.push(c);
    }
    return Array.from(map.values());
  }, [filteredConfigs]);

  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [didAutoExpand, setDidAutoExpand] = useState(false);

  useEffect(() => {
    if (!didAutoExpand && grouped.length === 1) {
      setExpandedSources(new Set([grouped[0].source_id]));
      setDidAutoExpand(true);
    }
  }, [didAutoExpand, grouped]);

  const expandAll = () => setExpandedSources(new Set(grouped.map((g) => g.source_id)));
  const collapseAll = () => setExpandedSources(new Set());
  const toggleSource = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignmentMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of allAssignments ?? []) {
      if (!map.has(a.config_id)) map.set(a.config_id, new Set());
      map.get(a.config_id)!.add(a.agent_id);
    }
    return map;
  }, [allAssignments]);

  const isAssigned = (configId: string, agentId: string) =>
    assignmentMap.get(configId)?.has(agentId) ?? false;

  const activeQuickAgents =
    agents?.filter((a) =>
      quickAgents.length > 0 ? quickAgents.includes(a.id) : true
    ) ?? [];

  const toggleQuickAgent = (agentId: string) => {
    setQuickAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const allQuickSelected =
    agents && agents.length > 0 && agents.every((a) => quickAgents.includes(a.id));

  const selectAllQuick = () => {
    if (allQuickSelected) {
      setQuickAgents([]);
    } else {
      setQuickAgents(agents?.map((a) => a.id) ?? []);
    }
  };

  // Multi-select helpers
  const toggleConfigSelection = (configId: string) => {
    setSelectedConfigs((prev) => {
      const next = new Set(prev);
      if (next.has(configId)) next.delete(configId);
      else next.add(configId);
      return next;
    });
  };

  const selectAllInGroup = (groupConfigs: ConfigSummary[], checked: boolean) => {
    setSelectedConfigs((prev) => {
      const next = new Set(prev);
      for (const c of groupConfigs) {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedConfigs(new Set());

  const batchAssign = (agentId: string) => {
    for (const configId of selectedConfigs) {
      if (!isAssigned(configId, agentId)) {
        assignMutation.mutate({ configId, agentId });
      }
    }
  };

  const batchUnassign = (agentId: string) => {
    for (const configId of selectedConfigs) {
      if (isAssigned(configId, agentId)) {
        unassignMutation.mutate({ configId, agentId });
      }
    }
  };

  const getQuickAgentsForConfig = (config: ConfigSummary) => {
    const compatible = activeQuickAgents.filter(
      (a) => a.supported_kinds.includes(config.kind) && a.supports_user_scope
    );
    // Sort: assigned first, then by name
    const sorted = [...compatible].sort((a, b) => {
      const aAssigned = isAssigned(config.id, a.id);
      const bAssigned = isAssigned(config.id, b.id);
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      return a.name.localeCompare(b.name);
    });
    return sorted.slice(0, 4);
  };

  const openConfig = (configId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("config", configId);
    setSearchParams(next);
  };

  const closeConfig = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("config");
    setSearchParams(next);
  };

  useEffect(() => {
    if (!selectedId) return;
    backButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeConfig();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  useEffect(() => {
    if (isError && error) {
      toast.error(errorMessage(error), {
        id: "configs-error",
        action: { label: "Retry", onClick: () => refetch() },
      });
    } else {
      toast.dismiss("configs-error");
    }
  }, [isError, error]);

  useEffect(() => {
    if (isDetailError && detailError) {
      toast.error(errorMessage(detailError), {
        id: "detail-error",
      });
    } else {
      toast.dismiss("detail-error");
    }
  }, [isDetailError, detailError]);

  useEffect(() => {
    if (configs && configs.some((c) => c.token_count === 0)) {
      toast.warning(
        "Some configs show 0 tokens. Go to Sources and sync to recalculate.",
        {
          id: "token-warning",
          duration: 10000,
        }
      );
    } else {
      toast.dismiss("token-warning");
    }
  }, [configs]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-2xl font-bold">Configs</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              aria-label="Search configs"
              placeholder="Search configs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select
              value={kind}
              onValueChange={(v) => setKind(v)}
            >
              <SelectTrigger className="min-w-28 w-auto">
                <SelectValue placeholder="Filter by kind" />
              </SelectTrigger>
              <SelectContent>
                {kindOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAgentSelector((s) => !s)}
              className="w-full sm:w-auto"
              aria-expanded={showAgentSelector}
              aria-haspopup="menu"
            >
              <User className="w-3.5 h-3.5" />
              Quick Install Agents
              {quickAgents.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px]">
                  {quickAgents.length}
                </span>
              )}
            </Button>
            {showAgentSelector && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowAgentSelector(false)}
                />
                <Card
                  className="absolute right-0 z-40 mt-1 w-full sm:w-64 p-2 shadow-lg"
                  role="menu"
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b mb-1">
                    <span className="text-xs font-medium">Select Agents</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={selectAllQuick}
                      disabled={isAgentsLoading || isAgentsError || !agents?.length}
                    >
                      {allQuickSelected ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  {isAgentsLoading && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      Loading agents...
                    </p>
                  )}
                  {isAgentsError && (
                    <p className="px-2 py-2 text-xs text-destructive">
                      {errorMessage(agentsError)}
                    </p>
                  )}
                  {!isAgentsLoading && !isAgentsError && agents?.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No agents available.
                    </p>
                  )}
                  {!isAgentsError && agents?.map((agent) => (
                    <label
                      key={agent.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={quickAgents.includes(agent.id)}
                        onCheckedChange={() => toggleQuickAgent(agent.id)}
                      />
                      <AgentIcon agentId={agent.id} size={18} />
                      <span className="text-sm">{agent.name}</span>
                    </label>
                  ))}
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedConfigs.size > 0 && (
        <Card className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {selectedConfigs.size} selected
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {agents?.map((agent) => (
                <div key={agent.id} className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => batchAssign(agent.id)}
                    title={`Batch install to ${agent.name}`}
                    aria-label={`Batch install selected configs to ${agent.name}`}
                  >
                    <AgentIcon agentId={agent.id} size={16} />
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => batchUnassign(agent.id)}
                    className="text-destructive hover:bg-destructive/10"
                    title={`Batch uninstall from ${agent.name}`}
                    aria-label={`Batch uninstall selected configs from ${agent.name}`}
                  >
                    <AgentIcon agentId={agent.id} size={16} assigned />
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={clearSelection}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </Card>
      )}

      {grouped.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={expandAll}
          >
            Expand All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={collapseAll}
          >
            Collapse All
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
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
        {!isLoading && !isError && filteredConfigs.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No configs found.</p>
            <p className="text-sm mt-1">
              Add a source and sync it to discover configs.
            </p>
          </Card>
        )}
        {grouped.map((group) => {
          const isExpanded = expandedSources.has(group.source_id);
          const allSelectedInGroup =
            group.configs.length > 0 &&
            group.configs.every((c) => selectedConfigs.has(c.id));
          return (
            <Card key={group.source_id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSource(group.source_id)}
                className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-accent/50"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-semibold text-sm">{group.source_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.configs.length} configs
                  </span>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t divide-y">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => selectAllInGroup(group.configs, !allSelectedInGroup)}
                      title={allSelectedInGroup ? "Deselect all" : "Select all"}
                      aria-label={`${allSelectedInGroup ? "Deselect" : "Select"} all configs in ${group.source_name}`}
                      aria-pressed={allSelectedInGroup}
                    >
                      {allSelectedInGroup ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <div className="w-4 h-4 rounded-sm border border-muted-foreground" />
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">Select all</span>
                  </div>
                  {group.configs.map((config) => {
                    const isSelected = selectedConfigs.has(config.id);
                    const quickAgentsForConfig = getQuickAgentsForConfig(config);
                    return (
                      <div
                        key={config.id}
                        className={`flex flex-col gap-3 p-3 transition-colors hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => toggleConfigSelection(config.id)}
                            aria-label={
                              isSelected
                                ? "Deselect this config"
                                : "Select this config"
                            }
                            aria-pressed={isSelected}
                          >
                            {isSelected ? (
                              <Check className="w-4 h-4 text-primary" />
                            ) : (
                              <div className="w-4 h-4 rounded-sm border border-muted-foreground" />
                            )}
                          </Button>
                        </div>
                        <button
                          type="button"
                          onClick={() => openConfig(config.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={`shrink-0 ${kindBadge(config.kind)}`}
                            >
                              {config.kind}
                            </Badge>
                            <span className="font-medium text-sm truncate">
                              {config.name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {config.relative_path}
                          </p>
                        </button>
                        <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {formatTokenCount(config.token_count)}
                          </span>
                          <div className="flex items-center gap-1">
                            {quickAgentsForConfig.map((agent) => {
                              const assigned = isAssigned(config.id, agent.id);
                              return (
                                <Button
                                  type="button"
                                  key={agent.id}
                                  variant={assigned ? "outline" : "outline"}
                                  size="sm"
                                  onClick={() =>
                                    assigned
                                      ? unassignMutation.mutate({
                                          configId: config.id,
                                          agentId: agent.id,
                                        })
                                      : assignMutation.mutate({
                                          configId: config.id,
                                          agentId: agent.id,
                                        })
                                  }
                                  disabled={
                                    assignMutation.isPending ||
                                    unassignMutation.isPending
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
                                      ? `Uninstall ${config.name} from ${agent.name}`
                                      : `Install ${config.name} to ${agent.name}`
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
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(open) => !open && closeConfig()}>
        <SheetContent className="w-[40%] min-w-[320px] p-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <SheetHeader className="flex flex-row items-center justify-between sm:flex-row sm:text-left">
                <Button
                  ref={backButtonRef}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closeConfig}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </SheetHeader>

              {isDetailLoading && (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}
              {isDetailError && (
                <div className="space-y-3">
                  <p className="text-sm text-destructive">{errorMessage(detailError)}</p>
                </div>
              )}
              {detail && !isDetailError && (
                <DetailContent
                  detail={detail}
                  agents={activeQuickAgents}
                  assignmentMap={assignmentMap}
                  onAssign={(configId, agentId) =>
                    assignMutation.mutate({ configId, agentId })
                  }
                  onUnassign={(configId, agentId) =>
                    unassignMutation.mutate({ configId, agentId })
                  }
                  isAssigning={assignMutation.isPending}
                  isUnassigning={unassignMutation.isPending}
                />
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailContent({
  detail,
  agents,
  assignmentMap,
  onAssign,
  onUnassign,
  isAssigning,
  isUnassigning,
}: {
  detail: ConfigDetail;
  agents: AgentInfo[];
  assignmentMap: Map<string, Set<string>>;
  onAssign: (configId: string, agentId: string) => void;
  onUnassign: (configId: string, agentId: string) => void;
  isAssigning: boolean;
  isUnassigning: boolean;
}) {
  const compatibleAgents = agents.filter(
    (a) =>
      a.supported_kinds.includes(detail.kind) && a.supports_user_scope
  );

  const isAssigned = (agentId: string) =>
    assignmentMap.get(detail.id)?.has(agentId) ?? false;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={kindBadge(detail.kind)}
          >
            {detail.kind}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatTokenCount(detail.token_count)} tokens
          </span>
        </div>
        <h4 className="text-xl font-semibold">{detail.name}</h4>
        <p className="text-sm text-muted-foreground">
          {detail.source_name} · {detail.relative_path}
        </p>
      </div>

      <Card className="p-3 bg-background">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Content Preview
        </p>
        <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap font-mono">
          {detail.content}
        </pre>
      </Card>

      <div className="space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <User className="w-4 h-4" />
          Agent Assignments
        </h4>

        {compatibleAgents.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No compatible agents for {detail.kind} configs.
          </p>
        )}

        <div className="space-y-2">
          {compatibleAgents.map((agent) => {
            const assigned = isAssigned(agent.id);
            return (
              <Card
                key={agent.id}
                className="p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <AgentIcon agentId={agent.id} size={22} assigned={assigned} />
                  <div>
                    <p className="font-medium text-sm">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      User scope only
                    </p>
                  </div>
                </div>
                {assigned ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onUnassign(detail.id, agent.id)}
                    disabled={isUnassigning}
                    className="flex items-center gap-1 text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300 disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                    Assigned
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onAssign(detail.id, agent.id)}
                    disabled={isAssigning}
                    className="flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3 opacity-50" />
                    Assign
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
