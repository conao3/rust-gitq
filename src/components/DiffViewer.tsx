import { useEffect, useState } from "react";
import { graphql } from "../graphql";

export type DiffLine = {
  origin: string;
  oldLineno: number | null;
  newLineno: number | null;
  content: string;
};
export type DiffHunk = {
  header: string;
  lines: DiffLine[];
};
export type FileDiff = {
  isBinary: boolean;
  hunks: DiffHunk[];
};

function UnifiedDiffView({ diff }: { diff: FileDiff }) {
  if (diff.isBinary) {
    return <div className="px-4 py-2 text-neutral-500">Binary file</div>;
  }
  return (
    <table className="w-full border-collapse">
      <tbody>
        {diff.hunks.map((hunk, hi) => (
          <>
            <tr key={`h${hi}`}>
              <td colSpan={4} className="bg-neutral-800 px-4 py-1 text-neutral-400">
                {hunk.header}
              </td>
            </tr>
            {hunk.lines.map((line, li) => (
              <tr
                key={`${hi}-${li}`}
                className={
                  line.origin === "+"
                    ? "bg-green-950/40 text-green-300"
                    : line.origin === "-"
                      ? "bg-red-950/40 text-red-300"
                      : "text-neutral-300"
                }
              >
                <td className="sticky left-0 z-10 w-12 select-none bg-inherit px-0 text-right text-neutral-600">
                  {line.oldLineno ?? ""}
                </td>
                <td className="sticky left-12 z-10 w-12 select-none bg-inherit px-0 text-right text-neutral-600">
                  {line.newLineno ?? ""}
                </td>
                <td className="sticky left-24 z-10 w-6 select-none bg-inherit px-0 text-center">
                  {line.origin}
                </td>
                <td className="whitespace-pre pl-2">{line.content}</td>
              </tr>
            ))}
          </>
        ))}
      </tbody>
    </table>
  );
}

function splitHunkLines(hunk: DiffHunk) {
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
  return { leftLines, rightLines };
}

function SplitSideTable({
  hunks,
  side,
}: {
  hunks: DiffHunk[];
  side: "left" | "right";
}) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {hunks.map((hunk, hi) => {
          const { leftLines, rightLines } = splitHunkLines(hunk);
          const lines = side === "left" ? leftLines : rightLines;
          return (
            <>
              <tr key={`h${hi}`}>
                <td colSpan={3} className="bg-neutral-800 px-4 py-1 text-neutral-400">
                  {hunk.header}
                </td>
              </tr>
              {lines.map((line, li) => {
                const cls = line === null
                  ? "bg-neutral-900/50"
                  : side === "left" && line.origin === "-"
                    ? "bg-red-950/40 text-red-300"
                    : side === "right" && line.origin === "+"
                      ? "bg-green-950/40 text-green-300"
                      : "text-neutral-300";
                return (
                  <tr key={`${hi}-${li}`} className={cls}>
                    <td className="sticky left-0 z-10 w-12 select-none bg-inherit px-0 text-right text-neutral-600">
                      {side === "left" ? (line?.oldLineno ?? "") : (line?.newLineno ?? "")}
                    </td>
                    <td className="sticky left-12 z-10 w-6 select-none bg-inherit px-0 text-center">
                      {line ? (line.origin === " " ? " " : line.origin) : ""}
                    </td>
                    <td className="whitespace-pre pl-2">{line?.content ?? ""}</td>
                  </tr>
                );
              })}
            </>
          );
        })}
      </tbody>
    </table>
  );
}

function SplitDiffView({ diff }: { diff: FileDiff }) {
  if (diff.isBinary) {
    return <div className="px-4 py-2 text-neutral-500">Binary file</div>;
  }
  return (
    <div className="flex">
      <div className="w-1/2 overflow-x-auto border-r border-neutral-700">
        <SplitSideTable hunks={diff.hunks} side="left" />
      </div>
      <div className="w-1/2 overflow-x-auto">
        <SplitSideTable hunks={diff.hunks} side="right" />
      </div>
    </div>
  );
}

export function DiffPanel({
  selectedFile,
  compareBase,
  compareHead,
  layout,
  hideWhitespace,
  refreshKey,
}: {
  selectedFile: string | null;
  compareBase: string;
  compareHead: string;
  layout: "unified" | "split";
  hideWhitespace: boolean;
  refreshKey?: number;
}) {
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void refreshKey;
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
  });

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
    <div className={`bg-neutral-950 font-mono text-sm ${layout === "unified" ? "overflow-x-auto" : ""}`}>
      {layout === "split" ? (
        <SplitDiffView diff={diff} />
      ) : (
        <UnifiedDiffView diff={diff} />
      )}
    </div>
  );
}
