import { useEffect, useState } from "react";
import { graphql } from "../graphql";

type TreeEntry = { name: string; path: string; entryType: "BLOB" | "TREE" };
type TreeData = { repository: { tree: TreeEntry[] } };

function TreeNode({
  entry,
  currentRef,
  selectedFile,
  onSelectFile,
}: {
  entry: TreeEntry;
  currentRef: string | null;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeEntry[]>([]);

  const toggle = () => {
    if (entry.entryType === "TREE") {
      if (!expanded && children.length === 0) {
        graphql<TreeData>(
          `query Tree($path: String, $ref: String) { repository { tree(path: $path, ref: $ref) { name path entryType } } }`,
          { path: entry.path, ref: currentRef },
        ).then((data) => setChildren(data.repository.tree));
      }
      setExpanded(!expanded);
    } else {
      onSelectFile(entry.path);
    }
  };

  const isSelected = entry.entryType === "BLOB" && entry.path === selectedFile;

  return (
    <div>
      <div
        onClick={toggle}
        className={`cursor-pointer truncate px-2 py-0.5 hover:bg-neutral-700 ${isSelected ? "bg-neutral-700" : ""}`}
      >
        {entry.entryType === "TREE" ? (expanded ? "▼ " : "▶ ") : "  "}
        {entry.name}
      </div>
      {expanded && children.length > 0 && (
        <div className="pl-4">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              currentRef={currentRef}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
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
  const [entries, setEntries] = useState<TreeEntry[]>([]);

  useEffect(() => {
    if (!currentRef) return;
    graphql<TreeData>(
      `query Tree($ref: String) { repository { tree(ref: $ref) { name path entryType } } }`,
      { ref: currentRef },
    ).then((data) => setEntries(data.repository.tree));
  }, [currentRef]);

  return (
    <div className="w-64 shrink-0 overflow-y-auto border-r border-neutral-700 bg-neutral-850 text-sm">
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          currentRef={currentRef}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}
