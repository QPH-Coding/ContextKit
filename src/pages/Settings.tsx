import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { globalApi } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderOpen, RefreshCw, Check, X, Save } from "lucide-react";
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

  const [agentDirInputs, setAgentDirInputs] = useState<Record<string, string>>({});

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

  const updateAgentDirMutation = useMutation({
    mutationFn: (vars: { agentId: string; dir?: string }) =>
      globalApi.updateAgentDir(vars.agentId, vars.dir),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agentSettings"] });
      toast.success("Agent directory saved.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const currentMode = selectedMode ?? settings?.default_sync_mode ?? "reference";

  const handleAgentDirChange = (agentId: string, value: string) => {
    setAgentDirInputs((prev) => ({ ...prev, [agentId]: value }));
  };

  const handleSaveAgentDir = (agentId: string) => {
    const value = agentDirInputs[agentId]?.trim();
    updateAgentDirMutation.mutate({
      agentId,
      dir: value && value.length > 0 ? value : undefined,
    });
  };

  const handleClearAgentDir = (agentId: string) => {
    setAgentDirInputs((prev) => ({ ...prev, [agentId]: "" }));
    updateAgentDirMutation.mutate({ agentId, dir: undefined });
  };

  const isAgentDirDirty = (agent: AgentSetting) => {
    const input = agentDirInputs[agent.id];
    if (input === undefined) return false;
    const current = agent.dir ?? "";
    return input.trim() !== current;
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
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
        <h3 className="text-lg font-semibold mb-3">Agent Directories</h3>
        <Card className="p-4">
          {isAgentsLoading && (
            <p className="text-sm text-muted-foreground">Loading agents...</p>
          )}
          {isAgentsError && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{errorMessage(agentsError)}</p>
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
                const inputValue =
                  agentDirInputs[agent.id] !== undefined
                    ? agentDirInputs[agent.id]
                    : (agent.dir ?? "");
                const dirty = isAgentDirDirty(agent);
                const hasDir = !!agent.dir;

                return (
                  <div
                    key={agent.id}
                    className="py-2 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <AgentIcon agentId={agent.id} size={20} />
                      <span className="font-medium text-sm">{agent.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Input
                        type="text"
                        placeholder="Not configured"
                        value={inputValue}
                        onChange={(e) =>
                          handleAgentDirChange(agent.id, e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                      {dirty && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleSaveAgentDir(agent.id)}
                          disabled={updateAgentDirMutation.isPending}
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      )}
                      {hasDir && !dirty && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          onClick={() => handleClearAgentDir(agent.id)}
                          disabled={updateAgentDirMutation.isPending}
                          title="Clear"
                        >
                          <X className="w-4 h-4" />
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
