import { useState, useMemo, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mcpApi } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, FileJson, ArrowLeft, Save, Loader2 } from "lucide-react";
import type { McpTransport, McpConfig } from "@/lib/types";

const TRANSPORT_LABELS: Record<McpTransport, string> = {
  stdio: "Stdio (Local Command)",
  sse: "SSE (Remote)",
  "streamable-http": "Streamable HTTP (Remote)",
};

function toKebab(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface McpFormProps {
  mode: "add" | "edit";
  initialData?: McpConfig;
  existingIds?: string[];
  onSuccess?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

export default function McpForm({
  mode,
  initialData,
  existingIds = [],
  onSuccess,
  onCancel,
  cancelLabel,
}: McpFormProps) {
  const queryClient = useQueryClient();
  const [showJson, setShowJson] = useState(false);

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<McpTransport>("stdio");
  const [description, setDescription] = useState("");

  const [command, setCommand] = useState("");
  const [args, setArgs] = useState<string[]>([""]);
  const [envList, setEnvList] = useState<{ key: string; value: string }[]>([]);

  const [url, setUrl] = useState("");
  const [headersList, setHeadersList] = useState<{ key: string; value: string }[]>([]);

  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [idTouched, setIdTouched] = useState(false);

  useEffect(() => {
    if (initialData) {
      setId(initialData.id);
      setName(initialData.name);
      setTransport(initialData.transport);
      setDescription(initialData.description ?? "");
      setCommand(initialData.command ?? "");
      setArgs(initialData.args?.length ? initialData.args : [""]);
      setEnvList(
        initialData.env
          ? Object.entries(initialData.env).map(([k, v]) => ({ key: k, value: v }))
          : []
      );
      setUrl(initialData.url ?? "");
      setHeadersList(
        initialData.headers
          ? Object.entries(initialData.headers).map(([k, v]) => ({ key: k, value: v }))
          : []
      );
      setIdManuallyEdited(true);
    } else {
      resetForm();
    }
  }, [initialData]);

  const mutation = useMutation({
    mutationFn: (data: McpConfig) =>
      mode === "add" ? mcpApi.addMcp(data) : mcpApi.updateMcp(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcps"] });
      toast.success(mode === "add" ? "MCP server added." : "MCP server updated.");
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const resetForm = useCallback(() => {
    setId("");
    setName("");
    setTransport("stdio");
    setDescription("");
    setCommand("");
    setArgs([""]);
    setEnvList([]);
    setUrl("");
    setHeadersList([]);
    setIdManuallyEdited(false);
    setIdTouched(false);
    setShowJson(false);
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    if (mode === "add" && !idManuallyEdited) {
      setId(toKebab(value));
    }
  };

  const handleIdChange = (value: string) => {
    setId(value);
    setIdManuallyEdited(true);
    setIdTouched(true);
  };

  const idError = useMemo(() => {
    if (mode === "add" && idTouched && existingIds.includes(id.trim())) {
      return `MCP '${id.trim()}' already exists. Please change the ID.`;
    }
    return null;
  }, [mode, id, idTouched, existingIds]);

  const buildPayload = (): McpConfig | null => {
    if (!id.trim() || !name.trim()) return null;
    if (mode === "add" && existingIds.includes(id.trim())) return null;

    const base: McpConfig = {
      id: id.trim(),
      name: name.trim(),
      transport,
      description: description.trim() || undefined,
    };

    if (transport === "stdio") {
      if (!command.trim()) return null;
      const trimmedArgs = args.map((a) => a.trim()).filter((a) => a.length > 0);
      const env: Record<string, string> = {};
      for (const item of envList) {
        if (item.key.trim()) env[item.key.trim()] = item.value;
      }
      return {
        ...base,
        command: command.trim(),
        args: trimmedArgs.length > 0 ? trimmedArgs : undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
      };
    }

    if (!url.trim()) return null;
    const headers: Record<string, string> = {};
    for (const item of headersList) {
      if (item.key.trim()) headers[item.key.trim()] = item.value;
    }
    return {
      ...base,
      url: url.trim(),
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      if (idError) {
        toast.error(idError);
      } else {
        toast.error("Please fill in all required fields.");
      }
      return;
    }
    mutation.mutate(payload);
  };

  const previewJson = useMemo(() => {
    const payload = buildPayload();
    if (!payload) return null;
    const config: Record<string, unknown> = {};
    if (payload.transport === "stdio") {
      config.command = payload.command;
      if (payload.args?.length) config.args = payload.args;
      if (payload.env && Object.keys(payload.env).length) config.env = payload.env;
    } else {
      config.url = payload.url;
      if (payload.headers && Object.keys(payload.headers).length) config.headers = payload.headers;
    }
    return JSON.stringify({ mcpServers: { [payload.id]: config } }, null, 2);
  }, [id, name, transport, description, command, args, envList, url, headersList]);

  // stdio helpers
  const addArg = () => setArgs((prev) => [...prev, ""]);
  const removeArg = (index: number) => setArgs((prev) => prev.filter((_, i) => i !== index));
  const updateArg = (index: number, value: string) =>
    setArgs((prev) => prev.map((a, i) => (i === index ? value : a)));

  const addEnv = () => setEnvList((prev) => [...prev, { key: "", value: "" }]);
  const removeEnv = (index: number) => setEnvList((prev) => prev.filter((_, i) => i !== index));
  const updateEnv = (index: number, field: "key" | "value", value: string) =>
    setEnvList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );

  // remote helpers
  const addHeader = () => setHeadersList((prev) => [...prev, { key: "", value: "" }]);
  const removeHeader = (index: number) =>
    setHeadersList((prev) => prev.filter((_, i) => i !== index));
  const updateHeader = (index: number, field: "key" | "value", value: string) =>
    setHeadersList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input
            placeholder="e.g. Filesystem Server"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">ID</label>
          <Input
            placeholder="e.g. filesystem"
            value={id}
            onChange={(e) => handleIdChange(e.target.value)}
            disabled={mode === "edit"}
            className={`h-8 text-sm mt-1 ${idError ? "border-destructive" : ""}`}
          />
          {idError && (
            <p className="text-xs text-destructive mt-1">{idError}</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Transport Type</label>
        <Select value={transport} onValueChange={(v) => setTransport(v as McpTransport)}>
          <SelectTrigger className="h-8 text-sm mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TRANSPORT_LABELS) as McpTransport[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TRANSPORT_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {transport === "stdio" && (
        <>
          <div>
            <label className="text-sm font-medium">Command</label>
            <Input
              placeholder="npx"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Arguments <span className="text-muted-foreground">(optional)</span>
            </label>
            <div className="space-y-2 mt-1">
              {args.map((arg, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={`arg ${index + 1}`}
                    value={arg}
                    onChange={(e) => updateArg(index, e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => removeArg(index)}
                    disabled={args.length === 1 && index === 0 && !arg}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addArg} className="gap-1">
                <Plus className="w-3.5 h-3.5" />
                Add argument
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">
              Environment Variables{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <div className="space-y-2 mt-1">
              {envList.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="KEY"
                    value={item.key}
                    onChange={(e) => updateEnv(index, "key", e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <span className="text-muted-foreground">=</span>
                  <Input
                    placeholder="value"
                    value={item.value}
                    onChange={(e) => updateEnv(index, "value", e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => removeEnv(index)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addEnv} className="gap-1">
                <Plus className="w-3.5 h-3.5" />
                Add env variable
              </Button>
            </div>
          </div>
        </>
      )}

      {(transport === "sse" || transport === "streamable-http") && (
        <>
          <div>
            <label className="text-sm font-medium">URL</label>
            <Input
              placeholder="https://example.com/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Headers <span className="text-muted-foreground">(optional)</span>
            </label>
            <div className="space-y-2 mt-1">
              {headersList.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Header"
                    value={item.key}
                    onChange={(e) => updateHeader(index, "key", e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <span className="text-muted-foreground">:</span>
                  <Input
                    placeholder="value"
                    value={item.value}
                    onChange={(e) => updateHeader(index, "value", e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => removeHeader(index)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addHeader} className="gap-1">
                <Plus className="w-3.5 h-3.5" />
                Add header
              </Button>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="text-sm font-medium">
          Description <span className="text-muted-foreground">(optional)</span>
        </label>
        <Input
          placeholder="Brief description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-8 text-sm mt-1"
        />
      </div>

      {previewJson && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowJson((v) => !v)}
            className="gap-1 text-muted-foreground"
          >
            <FileJson className="w-3.5 h-3.5" />
            {showJson ? "Hide JSON" : "Preview JSON"}
          </Button>
          {showJson && (
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
              {previewJson}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="gap-1">
          {cancelLabel === "Cancel" ? null : <ArrowLeft className="w-4 h-4" />}
          {cancelLabel ?? "Back"}
        </Button>
        <Button type="submit" disabled={mutation.isPending} className="gap-1">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <Save className="w-3.5 h-3.5" />
          {mode === "add" ? "Add MCP" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
