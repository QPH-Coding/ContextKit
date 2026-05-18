import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { globalApi } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Alert
          variant={notice.tone === "error" ? "destructive" : "default"}
          className={
            notice.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
              : undefined
          }
          role="status"
        >
          <AlertDescription className="flex items-start justify-between gap-3">
            <p>{notice.message}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-6 w-6"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4 space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <AlertTitle>Could not load settings</AlertTitle>
            <AlertDescription>
              <p className="mt-1 break-words text-xs opacity-90">
                {errorMessage(error)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-3 border-destructive/30 hover:bg-destructive/10"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
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
    </div>
  );
}
