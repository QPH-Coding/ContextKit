import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { globalApi } from "@/lib/api";
import { FolderOpen, RefreshCw, Check } from "lucide-react";

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: globalApi.getSettings,
  });

  const [selectedMode, setSelectedMode] = useState<
    "reference" | "copy" | null
  >(null);

  const updateMutation = useMutation({
    mutationFn: (mode: "reference" | "copy") => globalApi.updateSettings(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSelectedMode(null);
    },
    onError: (err: Error) => alert(err.message),
  });

  const currentMode = selectedMode ?? settings?.default_sync_mode ?? "reference";

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {settings && (
          <>
            <div className="flex items-start gap-3">
              <FolderOpen className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Config Directory</p>
                <p className="text-sm text-muted-foreground">
                  {settings.config_dir}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Default Sync Mode</p>
                <div className="mt-2 flex items-center gap-3">
                  <select
                    value={currentMode}
                    onChange={(e) =>
                      setSelectedMode(e.target.value as "reference" | "copy")
                    }
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="reference">Reference</option>
                    <option value="copy">Copy</option>
                  </select>
                  {selectedMode && selectedMode !== settings.default_sync_mode && (
                    <button
                      onClick={() => updateMutation.mutate(selectedMode)}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-1 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Save
                    </button>
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
      </div>
    </div>
  );
}
