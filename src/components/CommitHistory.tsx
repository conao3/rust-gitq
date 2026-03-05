import { useEffect, useState } from "react";
import { graphql } from "../graphql";
import { DiffPanel } from "./DiffViewer";

type CommitDecoration = {
  name: string;
  kind: "LOCAL_BRANCH" | "REMOTE_BRANCH" | "TAG" | "HEAD";
};

type CommitNode = {
  oid: string;
  shortId: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorTime: number;
  parentIds: string[];
  decorations: CommitDecoration[];
};

type CommitLog = {
  commits: CommitNode[];
  hasMore: boolean;
};

const LANE_COLORS = [
  "#4ec9b0", "#569cd6", "#c586c0", "#ce9178",
  "#dcdcaa", "#9cdcfe", "#d16969", "#6a9955",
] as const;

const COL_W = 16;
const ROW_H = 28;

type LaneSegment = {
  fromCol: number;
  toCol: number;
  color: string;
};

type GraphRow = {
  column: number;
  color: string;
  segments: LaneSegment[];
  maxCols: number;
};

function calculateGraph(commits: CommitNode[]): GraphRow[] {
  const activeLanes: (string | null)[] = [];
  let colorIdx = 0;
  const laneColorMap = new Map<string, string>();

  function getColor(oid: string): string {
    if (!laneColorMap.has(oid)) {
      laneColorMap.set(oid, LANE_COLORS[colorIdx % LANE_COLORS.length]);
      colorIdx++;
    }
    return laneColorMap.get(oid)!;
  }

  return commits.map((commit) => {
    let col = activeLanes.indexOf(commit.oid);
    if (col === -1) {
      col = activeLanes.indexOf(null);
      if (col === -1) {
        col = activeLanes.length;
        activeLanes.push(null);
      }
    }

    const commitColor = getColor(commit.oid);
    const segments: LaneSegment[] = [];

    for (let i = 0; i < activeLanes.length; i++) {
      if (i !== col && activeLanes[i] !== null) {
        segments.push({ fromCol: i, toCol: i, color: getColor(activeLanes[i]!) });
      }
    }

    activeLanes[col] = null;

    if (commit.parentIds.length > 0) {
      activeLanes[col] = commit.parentIds[0];
      segments.push({ fromCol: col, toCol: col, color: getColor(commit.parentIds[0]) });

      for (let p = 1; p < commit.parentIds.length; p++) {
        const parentOid = commit.parentIds[p];
        const existing = activeLanes.indexOf(parentOid);
        if (existing !== -1) {
          segments.push({ fromCol: col, toCol: existing, color: getColor(parentOid) });
        } else {
          let slot = activeLanes.indexOf(null);
          if (slot === -1) {
            slot = activeLanes.length;
            activeLanes.push(null);
          }
          activeLanes[slot] = parentOid;
          segments.push({ fromCol: col, toCol: slot, color: getColor(parentOid) });
        }
      }
    }

    while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
      activeLanes.pop();
    }

    return {
      column: col,
      color: commitColor,
      segments,
      maxCols: Math.max(activeLanes.length, col + 1),
    };
  });
}

function GraphCell({ row }: { row: GraphRow }) {
  const width = Math.max(row.maxCols, 1) * COL_W + 8;
  const cy = ROW_H / 2;

  return (
    <svg width={width} height={ROW_H} className="shrink-0">
      {row.segments.map((seg, i) => {
        const x1 = seg.fromCol * COL_W + COL_W / 2;
        const x2 = seg.toCol * COL_W + COL_W / 2;
        if (x1 === x2) {
          return <line key={i} x1={x1} y1={0} x2={x2} y2={ROW_H} stroke={seg.color} strokeWidth={2} />;
        }
        return (
          <path
            key={i}
            d={`M${x1},${cy} C${x1},${ROW_H} ${x2},0 ${x2},${cy}`}
            stroke={seg.color}
            strokeWidth={2}
            fill="none"
          />
        );
      })}
      <circle
        cx={row.column * COL_W + COL_W / 2}
        cy={cy}
        r={4}
        fill={row.color}
      />
    </svg>
  );
}

const DECOR_STYLE = {
  LOCAL_BRANCH: "border-green-600 text-green-400",
  REMOTE_BRANCH: "border-red-600 text-red-400",
  TAG: "border-yellow-600 text-yellow-400",
  HEAD: "border-blue-600 text-blue-400",
} as const;

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-CA") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

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

type DiffEntry = {
  path: string;
  status: "ADDED" | "DELETED" | "MODIFIED" | "RENAMED";
  additions: number;
  deletions: number;
};

export function CommitHistory({ currentRef }: { currentRef: string | null }) {
  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<CommitNode | null>(null);
  const [diffEntries, setDiffEntries] = useState<DiffEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [layout, setLayout] = useState<"unified" | "split">("unified");

  const graphRows = calculateGraph(commits);

  const fetchLog = (skip: number, append: boolean) => {
    setLoading(true);
    graphql<{ repository: { log: CommitLog } }>(
      `query Log($ref: String, $skip: Int, $limit: Int) {
        repository {
          log(ref: $ref, skip: $skip, limit: $limit) {
            commits {
              oid shortId message authorName authorEmail authorTime parentIds
              decorations { name kind }
            }
            hasMore
          }
        }
      }`,
      { ref: currentRef, skip, limit: 50 },
    ).then((data) => {
      setCommits((prev) => append ? [...prev, ...data.repository.log.commits] : data.repository.log.commits);
      setHasMore(data.repository.log.hasMore);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!currentRef) return;
    setSelectedCommit(null);
    setDiffEntries([]);
    setSelectedFile(null);
    fetchLog(0, false);
  });

  useEffect(() => {
    if (!selectedCommit) {
      setDiffEntries([]);
      setSelectedFile(null);
      return;
    }
    if (selectedCommit.parentIds.length === 0) {
      setDiffEntries([]);
      return;
    }
    graphql<{ repository: { diff: DiffEntry[] } }>(
      `query Diff($base: String!, $head: String!) {
        repository { diff(base: $base, head: $head) { path status additions deletions } }
      }`,
      { base: selectedCommit.parentIds[0], head: selectedCommit.oid },
    ).then((data) => {
      setDiffEntries(data.repository.diff);
      if (data.repository.diff.length > 0) {
        setSelectedFile(data.repository.diff[0].path);
      }
    });
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`overflow-y-auto ${selectedCommit ? "h-1/2 shrink-0" : "flex-1"}`}>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {commits.map((commit, i) => (
              <tr
                key={commit.oid}
                onClick={() => setSelectedCommit(selectedCommit?.oid === commit.oid ? null : commit)}
                className={`cursor-pointer border-b border-neutral-800 hover:bg-neutral-800/50 ${
                  selectedCommit?.oid === commit.oid ? "bg-neutral-800" : ""
                }`}
              >
                <td className="w-0 py-0 pl-2 pr-0">
                  {graphRows[i] && <GraphCell row={graphRows[i]} />}
                </td>
                <td className="w-[5.5rem] shrink-0 px-2 py-1 font-mono text-xs text-blue-400">
                  {commit.shortId}
                </td>
                <td className="px-2 py-1">
                  <span className="text-neutral-200">{commit.message}</span>
                  {commit.decorations.map((d) => (
                    <span
                      key={d.name}
                      className={`ml-2 inline-block rounded border px-1 py-0 text-xs ${DECOR_STYLE[d.kind]}`}
                    >
                      {d.name}
                    </span>
                  ))}
                </td>
                <td className="w-40 shrink-0 px-2 py-1 text-right text-xs text-neutral-500">
                  {commit.authorName}
                </td>
                <td className="w-36 shrink-0 px-2 py-1 text-right font-mono text-xs text-neutral-600">
                  {formatTime(commit.authorTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="flex justify-center py-3">
            <button
              onClick={() => fetchLog(commits.length, true)}
              disabled={loading}
              className="rounded border border-neutral-600 px-4 py-1 text-sm text-neutral-400 hover:bg-neutral-800"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>
      {selectedCommit && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-neutral-700">
          <div className="flex items-center gap-3 bg-neutral-800 px-4 py-1.5 text-sm">
            <span className="font-mono text-blue-400">{selectedCommit.shortId}</span>
            <span className="text-neutral-300">{selectedCommit.message}</span>
            <div className="ml-auto flex items-center gap-2">
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
            </div>
          </div>
          {selectedCommit.parentIds.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-neutral-500">
              Root commit (no parent)
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <div className="w-72 shrink-0 overflow-y-auto border-r border-neutral-700">
                {diffEntries.map((entry) => (
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
                  compareBase={selectedCommit.parentIds[0]}
                  compareHead={selectedCommit.oid}
                  layout={layout}
                  hideWhitespace={false}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
