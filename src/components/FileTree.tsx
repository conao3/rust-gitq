import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { graphql } from "../graphql";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  FileTextIcon,
  FileCodeIcon,
  ImageIcon,
  FileJsonIcon,
  SettingsIcon,
  TerminalIcon,
  DatabaseIcon,
  LockIcon,
} from "lucide-react";

type TreeEntry = { name: string; path: string; entryType: "BLOB" | "TREE" };
type TreeData = { repository: { tree: TreeEntry[] } };

const CODE_EXTS = new Set([
  "rs", "ts", "tsx", "js", "jsx", "py", "rb", "go", "java", "kt",
  "c", "h", "cpp", "hpp", "cs", "swift", "zig", "lua", "ex", "exs",
  "hs", "ml", "mli", "clj", "cljs", "cljc", "edn", "el", "vim",
  "r", "php", "pl", "erl", "proto", "graphql", "gql",
]) as ReadonlySet<string>;

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp",
]) as ReadonlySet<string>;

const CONFIG_EXTS = new Set([
  "toml", "yaml", "yml", "ini", "conf", "cfg", "env",
]) as ReadonlySet<string>;

const SHELL_EXTS = new Set([
  "sh", "bash", "zsh", "fish", "ps1",
]) as ReadonlySet<string>;

const DATA_EXTS = new Set([
  "sql", "db", "sqlite", "csv",
]) as ReadonlySet<string>;

const LOCK_NAMES = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "cargo.lock",
  "gemfile.lock", "poetry.lock", "flake.lock",
]) as ReadonlySet<string>;

function getFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (LOCK_NAMES.has(lower)) return <LockIcon size={14} className="text-neutral-500" />;
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  if (ext === "json" || ext === "jsonc") return <FileJsonIcon size={14} className="text-yellow-400" />;
  if (CODE_EXTS.has(ext)) return <FileCodeIcon size={14} className="text-blue-400" />;
  if (IMAGE_EXTS.has(ext)) return <ImageIcon size={14} className="text-purple-400" />;
  if (CONFIG_EXTS.has(ext)) return <SettingsIcon size={14} className="text-neutral-400" />;
  if (SHELL_EXTS.has(ext)) return <TerminalIcon size={14} className="text-green-400" />;
  if (DATA_EXTS.has(ext)) return <DatabaseIcon size={14} className="text-orange-400" />;
  if (ext === "md" || ext === "mdx" || ext === "txt" || ext === "rst") return <FileTextIcon size={14} className="text-neutral-400" />;
  if (lower === "makefile" || lower === "gnumakefile" || lower === "dockerfile") return <SettingsIcon size={14} className="text-neutral-400" />;
  return <FileIcon size={14} className="text-neutral-500" />;
}

function TreeNode({
  entry,
  currentRef,
  selectedFile,
  onSelectFile,
  depth,
}: {
  entry: TreeEntry;
  currentRef: string | null;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: children = [] } = useQuery({
    queryKey: ["tree", currentRef, entry.path],
    queryFn: () =>
      graphql<TreeData>(
        `query Tree($path: String, $ref: String) { repository { tree(path: $path, ref: $ref) { name path entryType } } }`,
        { path: entry.path, ref: currentRef },
      ).then((d) => d.repository.tree),
    enabled: expanded && entry.entryType === "TREE",
  });

  const toggle = () => {
    if (entry.entryType === "TREE") {
      setExpanded(!expanded);
    } else {
      onSelectFile(entry.path);
    }
  };

  const isSelected = entry.entryType === "BLOB" && entry.path === selectedFile;
  const isTree = entry.entryType === "TREE";

  return (
    <div>
      <div
        onClick={toggle}
        className={`group flex cursor-pointer items-center gap-1.5 py-[3px] pr-3 hover:bg-neutral-700/50 ${
          isSelected ? "bg-neutral-700/70 text-white" : "text-neutral-300"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isTree ? (
          <ChevronRightIcon
            size={14}
            className={`shrink-0 text-neutral-500 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
          />
        ) : (
          <span className="inline-block w-[14px] shrink-0" />
        )}
        {isTree ? (
          expanded ? (
            <FolderOpenIcon size={14} className="shrink-0 text-blue-400" />
          ) : (
            <FolderIcon size={14} className="shrink-0 text-blue-400" />
          )
        ) : (
          <span className="shrink-0">{getFileIcon(entry.name)}</span>
        )}
        <span className="truncate text-[13px]">{entry.name}</span>
      </div>
      {expanded && children.length > 0 && (
        <div className="relative">
          <div
            className="absolute bottom-0 top-0 w-px bg-neutral-700/50"
            style={{ left: `${depth * 12 + 14}px` }}
          />
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              currentRef={currentRef}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  currentRef,
  selectedFile,
  onSelectFile,
}: {
  currentRef: string | null;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const { data: entries = [] } = useQuery({
    queryKey: ["tree", currentRef],
    queryFn: () =>
      graphql<TreeData>(
        `query Tree($ref: String) { repository { tree(ref: $ref) { name path entryType } } }`,
        { ref: currentRef },
      ).then((d) => d.repository.tree),
    enabled: !!currentRef,
  });

  return (
    <div className="w-64 shrink-0 overflow-y-auto border-r border-neutral-700 bg-neutral-850 py-1 text-sm">
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          currentRef={currentRef}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          depth={0}
        />
      ))}
    </div>
  );
}
