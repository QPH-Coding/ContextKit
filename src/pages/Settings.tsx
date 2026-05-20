import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { globalApi } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderOpen, RefreshCw, Check, Loader2, X, Pin } from "lucide-react";
import AgentIcon from "@/components/AgentIcon";
import type { AgentSetting } from "@/lib/types";

export default function Settings() {
  const queryClient = useQueryClient();
  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: globalApi.getSettings,
    retry: false,
  });

  const {
    data: agentSettings,
    isLoading: isAgentsLoading,
    isError: isAgentsError,
    error: agentsError,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["agentSettings"],
    queryFn: globalApi.getAgentSettings,
    retry: false,
  });

  const [selectedMode, setSelectedMode] = useState<
    "reference" | "copy" | null
  >(null);

  const [pinInputs, setPinInputs] = useState<Record<string, boolean>>({});
  const [pendingAgents, setPendingAgents] = useState<Set<string>>(new Set());

  const updateMutation = useMutation({
    mutationFn: (mode: "reference" | "copy") => globalApi.updateSettings(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSelectedMode(null);
      toast.success("Settings saved.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const currentMode = selectedMode ?? settings?.default_sync_mode ?? "reference";

  const isPinned = (agentId: string) => {
    if (pinInputs[agentId] !== undefined) return pinInputs[agentId];
    return settings?.pinned_agents.includes(agentId) ?? false;
  };

  const saveAgent = async (
    agentId: string,
    dir?: string,
    pinned?: boolean
  ) => {
    setPendingAgents((prev) => new Set(prev).add(agentId));
    try {
      await globalApi.updateAgentSetting(agentId, dir, pinned);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["agentSettings"] }),
        queryClient.refetchQueries({ queryKey: ["settings"] }),
      ]);
      if (pinned !== undefined) {
        setPinInputs((prev) => {
          const next = { ...prev };
          delete next[agentId];
          return next;
        });
      }
      toast.success("Agent setting saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPendingAgents((prev) => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  };

  const handlePinChange = (agent: AgentSetting, checked: boolean) => {
    setPinInputs((prev) => ({ ...prev, [agent.id]: checked }));
    saveAgent(agent.id, undefined, checked);
  };

  const handleSelectDir = async (agent: AgentSetting) => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: agent.dir,
      });
      if (selected && selected !== agent.dir) {
        await saveAgent(agent.id, selected, undefined);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleClearDir = async (agent: AgentSetting) => {
    if (!agent.dir) return;
    const shouldUnpin = isPinned(agent.id);
    await saveAgent(agent.id, "", shouldUnpin ? false : undefined);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card className="p-4 space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {isError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{errorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {settings && !isError && (
          <>
            <div className="flex items-start gap-3">
              <FolderOpen className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium">Config Directory</p>
                <p className="break-words text-sm text-muted-foreground">
                  {settings.config_dir}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <label className="font-medium" htmlFor="default-sync-mode">
                  Default Sync Mode
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Select
                    value={currentMode}
                    onValueChange={(v) =>
                      setSelectedMode(v as "reference" | "copy")
                    }
                  >
                    <SelectTrigger id="default-sync-mode" className="w-40">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reference">Reference</SelectItem>
                      <SelectItem value="copy">Copy</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedMode && selectedMode !== settings.default_sync_mode && (
                    <Button
                      type="button"
                      onClick={() => updateMutation.mutate(selectedMode)}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="w-4 h-4" />
                      Save
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Reference mode creates symlinks to source files. Copy mode
                  duplicates files.
                </p>
              </div>
            </div>
          </>
        )}
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-3">Agents</h3>
        <Card className="p-4">
          {isAgentsLoading && (
            <p className="text-sm text-muted-foreground">Loading agents...</p>
          )}
          {isAgentsError && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                {errorMessage(agentsError)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAgents()}
              >
                Retry
              </Button>
            </div>
          )}
          {agentSettings && !isAgentsError && (
            <div className="space-y-3">
              {agentSettings.map((agent) => {
                const pinnedValue = isPinned(agent.id);
                const isPending = pendingAgents.has(agent.id);

                return (
                  <div
                    key={agent.id}
                    className="py-2 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 shrink-0 ${
                          pinnedValue
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground"
                        }`}
                        onClick={() => handlePinChange(agent, !pinnedValue)}
                        disabled={isPending || !agent.dir}
                        title={pinnedValue ? "Unpin agent" : "Pin agent"}
                      >
                        <Pin className="w-4 h-4" />
                      </Button>
                      <AgentIcon agentId={agent.id} size={20} />
                      <span className="font-medium text-sm">{agent.name}</span>
                      {isPending && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 pl-9">
                      <button
                        type="button"
                        onClick={() => handleSelectDir(agent)}
                        disabled={isPending}
                        className="text-sm truncate min-w-0 flex-1 text-left cursor-pointer hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Click to select directory"
                      >
                        {agent.dir ? (
                          agent.dir
                        ) : (
                          <span className="text-muted-foreground">Not configured</span>
                        )}
                      </button>
                      {agent.dir && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground"
                          onClick={() => handleClearDir(agent)}
                          disabled={isPending}
                          title="Clear directory"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
