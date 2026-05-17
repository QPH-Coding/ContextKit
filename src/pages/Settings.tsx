import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { globalApi } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { AlertCircle, FolderOpen, RefreshCw, Check, X } from "lucide-react";

type Notice = {
  tone: "success" | "error";
  message: string;
};

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

  const [selectedMode, setSelectedMode] = useState<
    "reference" | "copy" | null
  >(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const updateMutation = useMutation({
    mutationFn: (mode: "reference" | "copy") => globalApi.updateSettings(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSelectedMode(null);
      setNotice({ tone: "success", message: "Settings saved." });
    },
    onError: (err) => {
      setNotice({ tone: "error", message: errorMessage(err) });
    },
  });

  const currentMode = selectedMode ?? settings?.default_sync_mode ?? "reference";

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

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

      <div className="rounded-lg border bg-card p-4 space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Could not load settings</p>
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
                  <select
                    id="default-sync-mode"
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
                      type="button"
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
