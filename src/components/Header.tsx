import { useEffect, useState } from "react";
import { graphql } from "../graphql";

type Branch = { name: string; isHead: boolean };
type RepoData = {
  repository: {
    currentBranch: string;
    branches: Branch[];
  };
};

export function Header({
  repoPath,
  currentRef,
  viewMode,
  onBranchChange,
  onChangeRepo,
  onToggleCompare,
}: {
  repoPath: string;
  currentRef: string | null;
  viewMode: "browse" | "compare";
  onBranchChange: (ref: string) => void;
  onChangeRepo: () => void;
  onToggleCompare: () => void;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);

  const repoName = repoPath.split("/").pop() || repoPath;

  useEffect(() => {
    graphql<RepoData>(
      `{ repository { currentBranch branches { name isHead } } }`,
    ).then((data) => {
      setBranches(data.repository.branches);
      if (!currentRef) {
        onBranchChange(data.repository.currentBranch);
      }
    });
  }, [repoPath]);

  return (
    <div className="flex items-center gap-4 border-b border-neutral-700 bg-neutral-800 px-4 py-2">
      <button
        onClick={onChangeRepo}
        className="rounded border border-neutral-600 px-2 py-1 text-sm hover:bg-neutral-700"
      >
        ← Back
      </button>
      <span className="font-semibold">{repoName}</span>
      {viewMode === "browse" && (
        <select
          value={currentRef || ""}
          onChange={(e) => onBranchChange(e.target.value)}
          className="rounded border border-neutral-600 bg-neutral-700 px-2 py-1 text-sm"
        >
          {branches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={onToggleCompare}
        className={`rounded border px-2 py-1 text-sm ${
          viewMode === "compare"
            ? "border-blue-500 bg-blue-600 text-white"
            : "border-neutral-600 hover:bg-neutral-700"
        }`}
      >
        {viewMode === "compare" ? "Browse" : "Compare"}
      </button>
    </div>
  );
}
