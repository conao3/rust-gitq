import { useEffect, useState } from "react";
import { graphql } from "../graphql";
import { BranchSelect } from "./BranchSelect";

type Branch = { name: string; isHead: boolean; remote: string | null };
type DiffEntry = {
  path: string;
  status: "ADDED" | "DELETED" | "MODIFIED" | "RENAMED";
  additions: number;
  deletions: number;
};
type DiffLine = {
  origin: string;
  oldLineno: number | null;
  newLineno: number | null;
  content: string;
};
type DiffHunk = {
  header: string;
  lines: DiffLine[];
};
type FileDiff = {
  isBinary: boolean;
  hunks: DiffHunk[];
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

function UnifiedDiffView({ diff }: { diff: FileDiff }) {
  if (diff.isBinary) {
    return <div className="px-4 py-2 text-neutral-500">Binary file</div>;
  }
  return (
    <>
      {diff.hunks.map((hunk, hi) => (
        <div key={hi}>
          <div className="bg-neutral-800 px-4 py-1 text-neutral-400">
            {hunk.header}
          </div>
          {hunk.lines.map((line, li) => (
            <div
              key={li}
              className={
                line.origin === "+"
                  ? "bg-green-950/40 text-green-300"
                  : line.origin === "-"
                    ? "bg-red-950/40 text-red-300"
                    : "text-neutral-300"
              }
            >
              <span className="inline-block w-12 select-none text-right text-neutral-600">
                {line.oldLineno ?? ""}
              </span>
              <span className="inline-block w-12 select-none text-right text-neutral-600">
                {line.newLineno ?? ""}
              </span>
              <span className="inline-block w-6 select-none text-center">
                {line.origin}
              </span>
              <span className="whitespace-pre">{line.content}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function SplitDiffView({ diff }: { diff: FileDiff }) {
  if (diff.isBinary) {
    return <div className="px-4 py-2 text-neutral-500">Binary file</div>;
  }
  return (
    <>
      {diff.hunks.map((hunk, hi) => {
        const leftLines: (DiffLine | null)[] = [];
        const rightLines: (DiffLine | null)[] = [];
        let i = 0;
        const lines = hunk.lines;
        while (i < lines.length) {
          if (lines[i].origin === "-") {
            const delStart = i;
            while (i < lines.length && lines[i].origin === "-") i++;
            const addStart = i;
            while (i < lines.length && lines[i].origin === "+") i++;
            const delCount = addStart - delStart;
            const addCount = i - addStart;
            const maxCount = Math.max(delCount, addCount);
            for (let j = 0; j < maxCount; j++) {
              leftLines.push(j < delCount ? lines[delStart + j] : null);
              rightLines.push(j < addCount ? lines[addStart + j] : null);
            }
          } else if (lines[i].origin === "+") {
            leftLines.push(null);
            rightLines.push(lines[i]);
            i++;
          } else {
            leftLines.push(lines[i]);
            rightLines.push(lines[i]);
            i++;
          }
        }
        return (
          <div key={hi}>
            <div className="bg-neutral-800 px-4 py-1 text-neutral-400">
              {hunk.header}
            </div>
            {leftLines.map((left, li) => {
              const right = rightLines[li];
              return (
                <div key={li} className="flex">
                  <div
                    className={`w-1/2 border-r border-neutral-700 ${
                      left === null
                        ? "bg-neutral-900/50"
                        : left.origin === "-"
                          ? "bg-red-950/40 text-red-300"
                          : "text-neutral-300"
                    }`}
                  >
                    <span className="inline-block w-12 select-none text-right text-neutral-600">
                      {left?.oldLineno ?? ""}
                    </span>
                    <span className="inline-block w-6 select-none text-center">
                      {left ? (left.origin === " " ? " " : left.origin) : ""}
                    </span>
                    <span className="whitespace-pre">{left?.content ?? ""}</span>
                  </div>
                  <div
                    className={`w-1/2 ${
                      right === null
                        ? "bg-neutral-900/50"
                        : right.origin === "+"
                          ? "bg-green-950/40 text-green-300"
                          : "text-neutral-300"
                    }`}
                  >
                    <span className="inline-block w-12 select-none text-right text-neutral-600">
                      {right?.newLineno ?? ""}
                    </span>
                    <span className="inline-block w-6 select-none text-center">
                      {right ? (right.origin === " " ? " " : right.origin) : ""}
                    </span>
                    <span className="whitespace-pre">{right?.content ?? ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function DiffPanel({
  selectedFile,
  compareBase,
  compareHead,
  layout,
  hideWhitespace,
}: {
  selectedFile: string | null;
  compareBase: string;
  compareHead: string;
  layout: "unified" | "split";
  hideWhitespace: boolean;
}) {
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setDiff(null);
      return;
    }
    setLoading(true);
    graphql<{ repository: { diffFile: FileDiff } }>(
      `query DiffFile($base: String!, $head: String!, $path: String!, $ignoreWhitespace: Boolean) {
        repository {
          diffFile(base: $base, head: $head, path: $path, ignoreWhitespace: $ignoreWhitespace) {
            isBinary
            hunks { header lines { origin oldLineno newLineno content } }
          }
        }
      }`,
      { base: compareBase, head: compareHead, path: selectedFile, ignoreWhitespace: hideWhitespace },
    ).then((data) => {
      setDiff(data.repository.diffFile);
      setLoading(false);
    });
  }, [selectedFile, compareBase, compareHead, hideWhitespace]);

  if (!selectedFile) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Select a file to view diff
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-400">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-300" />
        Loading...
      </div>
    );
  }

  if (!diff) return null;

  return (
    <div className="overflow-x-auto bg-neutral-950 font-mono text-sm">
      {layout === "split" ? (
        <SplitDiffView diff={diff} />
      ) : (
        <UnifiedDiffView diff={diff} />
      )}
    </div>
  );
}

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

  useEffect(() => {
    graphql<{ repository: { branches: Branch[] } }>(
      `{ repository { branches { name isHead remote } } }`,
    ).then((data) => setBranches(data.repository.branches));
  }, []);

  useEffect(() => {
    if (!compareBase || !compareHead || compareBase === compareHead) {
      setResolvedBase(null);
      setEntries([]);
      setSelectedFile(null);
      return;
    }
    setLoading(true);
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
  }, [compareBase, compareHead, hideWhitespace, useMergeBase]);

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
