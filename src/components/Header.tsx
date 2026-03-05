import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { graphql } from "../graphql";
import { BranchSelect } from "./BranchSelect";

type Branch = { name: string; isHead: boolean; remote: string | null };
type RepoData = {
  repository: {
    currentBranch: string;
    branches: Branch[];
  };
};

export type ViewMode = "browse" | "history" | "compare";

export function Header({
  repoPath,
  currentRef,
  viewMode,
  onBranchChange,
  onChangeRepo,
  onViewModeChange,
}: {
  repoPath: string;
  currentRef: string | null;
  viewMode: ViewMode;
  onBranchChange: (ref: string) => void;
  onChangeRepo: () => void;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const { data } = useQuery({
    queryKey: ["branches"],
    queryFn: () => graphql<RepoData>(
      `{ repository { currentBranch branches { name isHead remote } } }`,
    ).then((d) => d.repository),
  });

  useEffect(() => {
    if (data && !currentRef) {
      onBranchChange(data.currentBranch);
    }
  }, [data, currentRef, onBranchChange]);

  const repoName = repoPath.split("/").pop() || repoPath;
  const branches = data?.branches ?? [];

  return (
    <div className="flex items-center gap-4 border-b border-neutral-700 bg-neutral-800 px-4 py-2">
      <button
        onClick={onChangeRepo}
        className="rounded border border-neutral-600 px-2 py-1 text-sm hover:bg-neutral-700"
      >
        &larr; Back
      </button>
      <span className="font-semibold">{repoName}</span>
      {viewMode === "browse" && (
        <BranchSelect
          value={currentRef}
          onChange={onBranchChange}
          branches={branches}
        />
      )}
      <div className="flex overflow-hidden rounded border border-neutral-600">
        {(["browse", "history", "compare"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={`px-2.5 py-1 text-xs capitalize ${
              viewMode === mode
                ? "bg-neutral-600 text-neutral-200"
                : "text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
