import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Terminal } from "lucide-react";
import McpForm from "./McpForm";
import type { McpConfig } from "@/lib/types";

interface McpFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initialData?: McpConfig;
  existingIds?: string[];
}

export default function McpFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  existingIds,
}: McpFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            {mode === "add" ? "Add MCP Server" : "Edit MCP Server"}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Configure a new MCP server for your agents."
              : "Update the MCP server configuration."}
          </DialogDescription>
        </DialogHeader>
        <McpForm
          mode={mode}
          initialData={initialData}
          existingIds={existingIds}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
