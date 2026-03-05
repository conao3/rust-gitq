import { useEffect, useState } from "react";
import { graphql } from "../graphql";
import { BranchSelect } from "./BranchSelect";
import { DiffPanel } from "./DiffViewer";

type Branch = { name: string; isHead: boolean; remote: string | null };
type DiffEntry = {
  path: string;
  status: "ADDED" | "DELETED" | "MODIFIED" | "RENAMED";
  additions: number;
  deletions: number;
};

const STATUS_STYLE = {
  ADDED: "bg-green-900 text-green-300",
  DELETED: "bg-red-900 text-red-300",
  MODIFIED: "bg-yellow-900 text-yellow-300",
  RENAMED: "bg-blue-900 text-blue-300",
} as const;

const STATUS_LABEL = {
  ADDED: "A",
  DELETED: "D",
  MODIFIED: "M",
  RENAMED: "R",
} as const;

export function BranchCompare({
  compareBase,
  compareHead,
  onBaseChange,
  onHeadChange,
}: {
  compareBase: string | null;
  compareHead: string | null;
  onBaseChange: (ref: string) => void;
  onHeadChange: (ref: string) => void;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [entries, setEntries] = useState<DiffEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [layout, setLayout] = useState<"unified" | "split">("unified");
  const [hideWhitespace, setHideWhitespace] = useState(false);
  const [useMergeBase, setUseMergeBase] = useState(false);
  const [resolvedBase, setResolvedBase] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    graphql<{ repository: { branches: Branch[] } }>(
      `{ repository { branches { name isHead remote } } }`,
    ).then((data) => setBranches(data.repository.branches));
  }, []);

  useEffect(() => {
    if (compareHead !== "__working__") return;
    const id = setInterval(() => setRefreshKey((k) => k + 1), 2000);
    return () => clearInterval(id);
  }, [compareHead]);

  useEffect(() => {
    if (!compareBase || !compareHead || compareBase === compareHead) {
      setResolvedBase(null);
      setEntries([]);
      setSelectedFile(null);
      return;
    }
    if (refreshKey === 0 || compareHead === "__working__") {
      setLoading((prev) => refreshKey === 0 ? true : prev);
    }
    const basePromise = useMergeBase && compareHead !== "__working__"
      ? graphql<{ repository: { mergeBase: string } }>(
          `query MergeBase($ref1: String!, $ref2: String!) {
            repository { mergeBase(ref1: $ref1, ref2: $ref2) }
          }`,
          { ref1: compareBase, ref2: compareHead },
        ).then((data) => data.repository.mergeBase)
      : Promise.resolve(compareBase);
    basePromise.then((effectiveBase) => {
      setResolvedBase(useMergeBase ? effectiveBase : null);
      return graphql<{ repository: { diff: DiffEntry[] } }>(
        `query Diff($base: String!, $head: String!, $ignoreWhitespace: Boolean) {
          repository { diff(base: $base, head: $head, ignoreWhitespace: $ignoreWhitespace) { path status additions deletions } }
        }`,
        { base: effectiveBase, head: compareHead, ignoreWhitespace: hideWhitespace },
      );
    }).then((data) => {
      setEntries(data.repository.diff);
      setLoading(false);
    });
  }, [compareBase, compareHead, hideWhitespace, useMergeBase, refreshKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-neutral-700 bg-neutral-800 px-4 py-2 text-sm">
        <BranchSelect
          value={compareBase}
          onChange={onBaseChange}
          branches={branches}
          placeholder="base..."
        />
        <span className="text-neutral-500">...</span>
        <BranchSelect
          value={compareHead}
          onChange={onHeadChange}
          branches={branches}
          placeholder="head..."
        />
        {entries.length > 0 && (
          <span className="text-neutral-400">
            {entries.length} changed file{entries.length !== 1 ? "s" : ""}
          </span>
        )}
        {resolvedBase && (
          <span className="font-mono text-xs text-neutral-500">
            base: {resolvedBase.slice(0, 7)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex overflow-hidden rounded border border-neutral-600">
            <button
              onClick={() => setLayout("unified")}
              className={`px-2 py-0.5 text-xs ${layout === "unified" ? "bg-neutral-600 text-neutral-200" : "text-neutral-400 hover:bg-neutral-700"}`}
            >
              Unified
            </button>
            <button
              onClick={() => setLayout("split")}
              className={`px-2 py-0.5 text-xs ${layout === "split" ? "bg-neutral-600 text-neutral-200" : "text-neutral-400 hover:bg-neutral-700"}`}
            >
              Split
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={useMergeBase}
              onChange={(e) => setUseMergeBase(e.target.checked)}
              className="accent-neutral-500"
            />
            Merge base
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={hideWhitespace}
              onChange={(e) => setHideWhitespace(e.target.checked)}
              className="accent-neutral-500"
            />
            Hide whitespace
          </label>
        </div>
      </div>
      {loading && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-300" />
          Loading...
        </div>
      )}
      {!loading && compareBase && compareHead && compareBase === compareHead && (
        <div className="flex flex-1 items-center justify-center text-neutral-500">
          Same branch selected
        </div>
      )}
      {!loading && entries.length === 0 && compareBase && compareHead && compareBase !== compareHead && (
        <div className="flex flex-1 items-center justify-center text-neutral-500">
          No differences
        </div>
      )}
      {!loading && entries.length > 0 && (
        <div className="flex min-h-0 flex-1">
          <div className="w-72 shrink-0 overflow-y-auto border-r border-neutral-700">
            {entries.map((entry) => (
              <div
                key={entry.path}
                onClick={() => setSelectedFile(entry.path)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-800 ${
                  selectedFile === entry.path ? "bg-neutral-800" : ""
                }`}
              >
                <span className={`shrink-0 rounded px-1 py-0.5 font-mono text-xs ${STATUS_STYLE[entry.status]}`}>
                  {STATUS_LABEL[entry.status]}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-neutral-300">
                  {entry.path}
                </span>
                <span className="shrink-0 text-xs text-green-400">+{entry.additions}</span>
                <span className="shrink-0 text-xs text-red-400">-{entry.deletions}</span>
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            <DiffPanel
              selectedFile={selectedFile}
              compareBase={resolvedBase ?? compareBase!}
              compareHead={compareHead!}
              layout={layout}
              hideWhitespace={hideWhitespace}
            />
          </div>
        </div>
      )}
    </div>
  );
}
