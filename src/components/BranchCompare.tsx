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

function FileDiffView({
  entry,
  compareBase,
  compareHead,
}: {
  entry: DiffEntry;
  compareBase: string;
  compareHead: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [diff, setDiff] = useState<FileDiff | null>(null);

  useEffect(() => {
    if (!expanded || diff) return;
    graphql<{ repository: { diffFile: FileDiff } }>(
      `query DiffFile($base: String!, $head: String!, $path: String!) {
        repository {
          diffFile(base: $base, head: $head, path: $path) {
            isBinary
            hunks { header lines { origin oldLineno newLineno content } }
          }
        }
      }`,
      { base: compareBase, head: compareHead, path: entry.path },
    ).then((data) => setDiff(data.repository.diffFile));
  }, [expanded]);

  return (
    <div className="border-b border-neutral-700">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-neutral-800"
      >
        <span className="w-4 text-center">{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs ${STATUS_STYLE[entry.status]}`}>
          {STATUS_LABEL[entry.status]}
        </span>
        <span className="flex-1 font-mono">{entry.path}</span>
        <span className="text-green-400">+{entry.additions}</span>
        <span className="text-red-400">-{entry.deletions}</span>
      </div>
      {expanded && diff && (
        <div className="overflow-x-auto bg-neutral-950 font-mono text-sm">
          {diff.isBinary ? (
            <div className="px-4 py-2 text-neutral-500">Binary file</div>
          ) : (
            diff.hunks.map((hunk, hi) => (
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
            ))
          )}
        </div>
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

  useEffect(() => {
    graphql<{ repository: { branches: Branch[] } }>(
      `{ repository { branches { name isHead remote } } }`,
    ).then((data) => setBranches(data.repository.branches));
  }, []);

  useEffect(() => {
    if (!compareBase || !compareHead || compareBase === compareHead) {
      setEntries([]);
      return;
    }
    setLoading(true);
    graphql<{ repository: { diff: DiffEntry[] } }>(
      `query Diff($base: String!, $head: String!) {
        repository { diff(base: $base, head: $head) { path status additions deletions } }
      }`,
      { base: compareBase, head: compareHead },
    ).then((data) => {
      setEntries(data.repository.diff);
      setLoading(false);
    });
  }, [compareBase, compareHead]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
      {entries.map((entry) => (
        <FileDiffView
          key={entry.path}
          entry={entry}
          compareBase={compareBase!}
          compareHead={compareHead!}
        />
      ))}
    </div>
  );
}
