import { useQuery } from "@tanstack/react-query";
import { globalApi } from "@/lib/api";
import { FolderOpen, RefreshCw } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: globalApi.getSettings,
  });

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
              <div>
                <p className="font-medium">Default Sync Mode</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {settings.default_sync_mode}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
