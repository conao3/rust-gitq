import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { graphql } from "../graphql";

type FsEntry = { name: string; path: string; isGitRepo: boolean };

export function DirBrowser({
  initialPath,
  onOpenRepo,
}: {
  initialPath?: string | null;
  onOpenRepo: (path: string) => void;
}) {
  const [currentPath, setCurrentPath] = useState<string | null>(initialPath ?? null);

  const { data: homePath } = useQuery({
    queryKey: ["homePath"],
    queryFn: () => graphql<{ homePath: string }>(`{ homePath }`).then((d) => d.homePath),
    enabled: currentPath === null,
  });

  useEffect(() => {
    if (homePath && currentPath === null) setCurrentPath(homePath);
  }, [homePath, currentPath]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["directory", currentPath],
    queryFn: () =>
      graphql<{ listDirectory: FsEntry[] }>(
        `query ListDir($path: String!) { listDirectory(path: $path) { name path isGitRepo } }`,
        { path: currentPath! },
      ).then((d) => d.listDirectory),
    enabled: currentPath !== null,
  });

  const pathSegments = currentPath?.split("/").filter(Boolean) || [];

  const handleClick = async (entry: FsEntry) => {
    if (entry.isGitRepo) {
      await graphql(
        `query OpenRepo($path: String!) { openRepository(path: $path) { path } }`,
        { path: entry.path },
      );
      onOpenRepo(entry.path);
    } else {
      setCurrentPath(entry.path);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-neutral-900 text-neutral-200">
      <div className="flex items-center gap-1 border-b border-neutral-700 bg-neutral-800 px-4 py-2 text-sm">
        <button
          onClick={() => setCurrentPath("/")}
          className="rounded px-1 hover:bg-neutral-700"
        >
          /
        </button>
        {pathSegments.map((seg, i) => {
          const segPath = "/" + pathSegments.slice(0, i + 1).join("/");
          return (
            <span key={segPath} className="flex items-center gap-1">
              <span className="text-neutral-500">/</span>
              <button
                onClick={() => setCurrentPath(segPath)}
                className="rounded px-1 hover:bg-neutral-700"
              >
                {seg}
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {currentPath && currentPath !== "/" && (
          <div
            onClick={() =>
              setCurrentPath(currentPath.split("/").slice(0, -1).join("/") || "/")
            }
            className="flex cursor-pointer items-center gap-3 border-b border-neutral-800 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            <span className="text-neutral-500">..</span>
          </div>
        )}
        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-300" />
            Loading...
          </div>
        )}
        {entries.map((entry) => (
          <div
            key={entry.path}
            onClick={() => handleClick(entry)}
            className="flex cursor-pointer items-center gap-3 border-b border-neutral-800 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            {entry.isGitRepo ? (
              <span className="shrink-0 rounded bg-green-900 px-1.5 py-0.5 text-xs text-green-300">
                repo
              </span>
            ) : (
              <span className="shrink-0 text-neutral-500">📁</span>
            )}
            <span className={entry.isGitRepo ? "font-medium text-green-400" : ""}>
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
