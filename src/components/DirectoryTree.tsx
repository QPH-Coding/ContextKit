import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { sourceApi } from "@/lib/api";
import type { DirNode } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Loader2,
} from "lucide-react";

interface DirectoryTreeProps {
  sourceId: string;
  ignoreDirs: string[];
  onToggleIgnore: (relativePath: string, ignored: boolean) => void;
}

interface TreeNodeProps {
  node: DirNode;
  depth: number;
  ignoreDirs: string[];
  onToggleIgnore: (relativePath: string, ignored: boolean) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  childrenMap: Map<string, DirNode[]>;
  loadingPaths: Set<string>;
}

function TreeNode({
  node,
  depth,
  ignoreDirs,
  onToggleIgnore,
  expandedPaths,
  toggleExpand,
  childrenMap,
  loadingPaths,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.relative_path);
  const children = childrenMap.get(node.relative_path) ?? [];
  const isLoading = loadingPaths.has(node.relative_path);

  const isSelfIgnored = ignoreDirs.includes(node.relative_path);
  const isParentIgnored = ignoreDirs.some(
    (d) =>
      node.relative_path.startsWith(d + "/") && d !== node.relative_path
  );
  const isIgnored = isSelfIgnored || isParentIgnored;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 hover:bg-accent/50 rounded px-1"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => toggleExpand(node.relative_path)}
          className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0"
          disabled={!node.has_children}
        >
          {node.has_children &&
            (isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            ))}
        </button>
        <Checkbox
          checked={isIgnored}
          disabled={isParentIgnored}
          onCheckedChange={(checked) =>
            onToggleIgnore(node.relative_path, checked === true)
          }
          className="h-4 w-4 shrink-0"
        />
        <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
        <span
          className={`text-sm truncate ${
            isIgnored ? "text-muted-foreground" : ""
          }`}
        >
          {node.name}
        </span>
        {isLoading && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
        )}
      </div>
      {isExpanded &&
        children.map((child) => (
          <TreeNode
            key={child.relative_path}
            node={child}
            depth={depth + 1}
            ignoreDirs={ignoreDirs}
            onToggleIgnore={onToggleIgnore}
            expandedPaths={expandedPaths}
            toggleExpand={toggleExpand}
            childrenMap={childrenMap}
            loadingPaths={loadingPaths}
          />
        ))}
    </div>
  );
}

export default function DirectoryTree({
  sourceId,
  ignoreDirs,
  onToggleIgnore,
}: DirectoryTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Map<string, DirNode[]>>(
    new Map()
  );
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // 用 ref 避免 toggleExpand 闭包 stale
  const childrenMapRef = useRef(childrenMap);
  childrenMapRef.current = childrenMap;

  const toggleExpand = useCallback(
    async (path: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });

      if (!childrenMapRef.current.has(path)) {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.add(path);
          return next;
        });
        try {
          const children = await sourceApi.getDirectoryTree(sourceId, path);
          setChildrenMap((prev) => {
            const next = new Map(prev);
            next.set(path, children);
            return next;
          });
        } finally {
          setLoadingPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        }
      }
    },
    [sourceId]
  );

  const {
    data: rootNodes,
    isLoading: isRootLoading,
    isError: isRootError,
    error: rootError,
  } = useQuery({
    queryKey: ["directory-tree", sourceId, ""],
    queryFn: () => sourceApi.getDirectoryTree(sourceId, ""),
    enabled: !!sourceId,
  });

  if (isRootLoading) {
    return (
      <div className="py-4 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading directory tree...
      </div>
    );
  }

  if (isRootError) {
    return (
      <div className="py-4 text-sm text-destructive">
        Failed to load directory tree: {String(rootError)}
      </div>
    );
  }

  if (!rootNodes || rootNodes.length === 0) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        No directories found.
      </div>
    );
  }

  return (
    <div className="border rounded-md p-2 max-h-64 overflow-auto">
      {rootNodes.map((node) => (
        <TreeNode
          key={node.relative_path}
          node={node}
          depth={0}
          ignoreDirs={ignoreDirs}
          onToggleIgnore={onToggleIgnore}
          expandedPaths={expandedPaths}
          toggleExpand={toggleExpand}
          childrenMap={childrenMap}
          loadingPaths={loadingPaths}
        />
      ))}
    </div>
  );
}
