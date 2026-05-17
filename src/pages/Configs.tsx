import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { configApi, assignmentApi, globalApi } from "@/lib/api";
import { formatTokenCount } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import type { ConfigSummary, AgentInfo, ConfigDetail } from "@/lib/types";
import AgentIcon from "@/components/AgentIcon";
import {
  AlertCircle,
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
  AlertTriangle,
  Square,
  SquareCheck,
  ArrowLeft,
} from "lucide-react";

const kindOptions = [
  { value: "", label: "All" },
  { value: "skill", label: "Skill" },
  { value: "rule", label: "Rule" },
  { value: "agent", label: "Agent" },
  { value: "mcp", label: "MCP" },
];

function kindBadge(kind: string) {
  const classes: Record<string, string> = {
    skill:
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    rule:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    agent:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    mcp:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  };
  return classes[kind] || "bg-gray-100 text-gray-800";
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
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const selectedId = searchParams.get("config");
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
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
    queryFn: () => configApi.listConfigs(kind || undefined),
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
    onMutate: () => {
      setAssignmentError(null);
    },
    onSuccess: () => {
      setAssignmentError(null);
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      setAssignmentError(errorMessage(err));
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (vars: { configId: string; agentId: string }) =>
      assignmentApi.unassignConfig(vars.configId, vars.agentId),
    onMutate: () => {
      setAssignmentError(null);
    },
    onSuccess: () => {
      setAssignmentError(null);
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      setAssignmentError(errorMessage(err));
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

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-2xl font-bold">Configs</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              aria-label="Search configs"
              placeholder="Search configs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              aria-label="Filter configs by kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="min-w-28 flex-1 rounded-md border bg-background px-3 py-2 text-sm sm:flex-none"
            >
              {kindOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAgentSelector((s) => !s)}
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent sm:w-auto"
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
            </button>
            {showAgentSelector && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowAgentSelector(false)}
                />
                <div
                  className="absolute right-0 z-40 mt-1 w-full rounded-lg border bg-card p-2 shadow-lg sm:w-64"
                  role="menu"
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b mb-1">
                    <span className="text-xs font-medium">Select Agents</span>
                    <button
                      type="button"
                      onClick={selectAllQuick}
                      disabled={isAgentsLoading || isAgentsError || !agents?.length}
                      className="text-xs text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
                    >
                      {allQuickSelected ? "Deselect All" : "Select All"}
                    </button>
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
                      <input
                        type="checkbox"
                        checked={quickAgents.includes(agent.id)}
                        onChange={() => toggleQuickAgent(agent.id)}
                        className="rounded border-gray-300"
                      />
                      <AgentIcon agentId={agent.id} size={18} />
                      <span className="text-sm">{agent.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {assignmentError && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{assignmentError}</p>
          <button
            type="button"
            onClick={() => setAssignmentError(null)}
            className="rounded-md p-0.5 hover:bg-destructive/10"
            aria-label="Dismiss assignment error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {selectedConfigs.size > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-2">
            <SquareCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedConfigs.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {agents?.map((agent) => (
              <div key={agent.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => batchAssign(agent.id)}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
                  title={`Batch install to ${agent.name}`}
                  aria-label={`Batch install selected configs to ${agent.name}`}
                >
                  <AgentIcon agentId={agent.id} size={16} />
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => batchUnassign(agent.id)}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent text-destructive"
                  title={`Batch uninstall from ${agent.name}`}
                  aria-label={`Batch uninstall selected configs from ${agent.name}`}
                >
                  <AgentIcon agentId={agent.id} size={16} assigned />
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      {configs && configs.some((c) => c.token_count === 0) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Token counts not calculated</p>
            <p className="text-xs opacity-80">
              Some configs show 0 tokens because they were scanned before token
              counting was enabled. Go to{" "}
              <Link to="/sources" className="underline">
                Sources
              </Link>{" "}
              and click <strong>Sync</strong> on each source to recalculate.
            </p>
          </div>
        </div>
      )}

      {grouped.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-xs rounded-md border px-2 py-1 hover:bg-accent"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs rounded-md border px-2 py-1 hover:bg-accent"
          >
            Collapse All
          </button>
        </div>
      )}

      <div className="space-y-3">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        )}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Could not load configs</p>
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
        {!isLoading && !isError && filteredConfigs.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No configs found.</p>
            <p className="text-sm mt-1">
              Add a source and sync it to discover configs.
            </p>
          </div>
        )}
        {grouped.map((group) => {
          const isExpanded = expandedSources.has(group.source_id);
          const allSelectedInGroup =
            group.configs.length > 0 &&
            group.configs.every((c) => selectedConfigs.has(c.id));
          return (
            <div key={group.source_id} className="rounded-lg border bg-card overflow-hidden">
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
                    <button
                      type="button"
                      onClick={() => selectAllInGroup(group.configs, !allSelectedInGroup)}
                      className="text-muted-foreground hover:text-foreground"
                      title={allSelectedInGroup ? "Deselect all" : "Select all"}
                      aria-label={`${allSelectedInGroup ? "Deselect" : "Select"} all configs in ${group.source_name}`}
                      aria-pressed={allSelectedInGroup}
                    >
                      {allSelectedInGroup ? (
                        <SquareCheck className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
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
                          <button
                            type="button"
                            onClick={() => toggleConfigSelection(config.id)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={
                              isSelected
                                ? "Deselect this config"
                                : "Select this config"
                            }
                            aria-pressed={isSelected}
                          >
                            {isSelected ? (
                              <SquareCheck className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => openConfig(config.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${kindBadge(config.kind)}`}
                            >
                              {config.kind}
                            </span>
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
                                <button
                                  type="button"
                                  key={agent.id}
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
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                    assigned
                                      ? "border text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300"
                                      : "border hover:bg-accent"
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
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail Drawer */}
      {selectedId && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={closeConfig}
          />
          <aside
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg overflow-auto border-l bg-card shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Config detail"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <button
                  ref={backButtonRef}
                  type="button"
                  onClick={closeConfig}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={closeConfig}
                  className="p-1 rounded-md hover:bg-accent"
                  aria-label="Close config detail"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isDetailLoading && (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}
              {isDetailError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-medium">Failed to load config</p>
                  <p className="mt-1 text-xs">
                    {errorMessage(detailError)}
                  </p>
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
          </aside>
        </>
      )}
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
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${kindBadge(detail.kind)}`}
          >
            {detail.kind}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTokenCount(detail.token_count)} tokens
          </span>
        </div>
        <h4 className="text-xl font-semibold">{detail.name}</h4>
        <p className="text-sm text-muted-foreground">
          {detail.source_name} · {detail.relative_path}
        </p>
      </div>

      <div className="rounded-md border bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Content Preview
        </p>
        <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap font-mono">
          {detail.content}
        </pre>
      </div>

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
              <div
                key={agent.id}
                className="rounded-md border p-3 flex items-center justify-between"
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
                  <button
                    type="button"
                    onClick={() => onUnassign(detail.id, agent.id)}
                    disabled={isUnassigning}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                    Assigned
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAssign(detail.id, agent.id)}
                    disabled={isAssigning}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3 opacity-50" />
                    Assign
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
