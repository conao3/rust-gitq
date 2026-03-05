import {
  createRouter,
  createRootRoute,
  createRoute,
  createHashHistory,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { DirBrowser } from "./components/DirBrowser";
import { Header, type ViewMode } from "./components/Header";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import { CommitHistory } from "./components/CommitHistory";
import { BranchCompare } from "./components/BranchCompare";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

type IndexSearch = { path?: string };

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    path: typeof search.path === "string" ? search.path : undefined,
  }),
});

type RepoSearch = { repo: string; ref?: string };

const repoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/repo",
  validateSearch: (search: Record<string, unknown>): RepoSearch => ({
    repo: search.repo as string,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
});

type BrowseSearch = { file?: string };

const browseRoute = createRoute({
  getParentRoute: () => repoRoute,
  path: "/browse",
  validateSearch: (search: Record<string, unknown>): BrowseSearch => ({
    file: typeof search.file === "string" ? search.file : undefined,
  }),
});

const historyRoute = createRoute({
  getParentRoute: () => repoRoute,
  path: "/history",
});

type CompareSearch = { base?: string; head?: string };

const compareRoute = createRoute({
  getParentRoute: () => repoRoute,
  path: "/compare",
  validateSearch: (search: Record<string, unknown>): CompareSearch => ({
    base: typeof search.base === "string" ? search.base : undefined,
    head: typeof search.head === "string" ? search.head : undefined,
  }),
});

function IndexPage() {
  const { path } = indexRoute.useSearch();
  const navigate = useNavigate();

  return (
    <DirBrowser
      initialPath={path ?? null}
      onOpenRepo={(repoPath) => {
        void navigate({
          to: "/repo/browse",
          search: { repo: repoPath, ref: undefined, file: undefined },
        });
      }}
    />
  );
}

function RepoLayout() {
  const { repo, ref } = repoRoute.useSearch();
  const navigate = useNavigate();
  const location = useLocation();

  const viewMode: ViewMode = location.pathname.endsWith("/history")
    ? "history"
    : location.pathname.endsWith("/compare")
      ? "compare"
      : "browse";

  return (
    <div className="flex h-screen flex-col bg-neutral-900 text-neutral-200">
      <Header
        key={repo}
        repoPath={repo}
        currentRef={ref ?? null}
        viewMode={viewMode}
        onBranchChange={(newRef) => {
          if (viewMode === "compare") {
            const search = location.search as { base?: string; head?: string };
            void navigate({
              to: "/repo/compare",
              search: { repo, ref: newRef, base: search.base, head: search.head },
            });
          } else if (viewMode === "history") {
            void navigate({ to: "/repo/history", search: { repo, ref: newRef } });
          } else {
            void navigate({ to: "/repo/browse", search: { repo, ref: newRef } });
          }
        }}
        onChangeRepo={() => {
          const browserPath = repo.split("/").slice(0, -1).join("/") || "/";
          void navigate({ to: "/", search: { path: browserPath } });
        }}
        onViewModeChange={(mode) => {
          if (mode === "compare") {
            void navigate({
              to: "/repo/compare",
              search: { repo, ref, base: ref, head: "__working__" },
            });
          } else if (mode === "history") {
            void navigate({ to: "/repo/history", search: { repo, ref } });
          } else {
            void navigate({ to: "/repo/browse", search: { repo, ref, file: undefined } });
          }
        }}
      />
      <Outlet />
    </div>
  );
}

function BrowsePage() {
  const { repo, ref } = repoRoute.useSearch();
  const { file } = browseRoute.useSearch();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-0 flex-1">
      <FileTree
        currentRef={ref ?? null}
        selectedFile={file ?? null}
        onSelectFile={(path) => {
          void navigate({
            to: "/repo/browse",
            search: { repo, ref, file: path },
          });
        }}
      />
      <FileViewer filePath={file ?? null} currentRef={ref ?? null} />
    </div>
  );
}

function HistoryPage() {
  const { ref } = repoRoute.useSearch();
  return <CommitHistory key={ref} currentRef={ref ?? null} />;
}

function ComparePage() {
  const { repo, ref } = repoRoute.useSearch();
  const { base, head } = compareRoute.useSearch();
  const navigate = useNavigate();

  return (
    <BranchCompare
      compareBase={base ?? null}
      compareHead={head ?? null}
      onBaseChange={(newBase) => {
        void navigate({
          to: "/repo/compare",
          search: { repo, ref, base: newBase, head },
        });
      }}
      onHeadChange={(newHead) => {
        void navigate({
          to: "/repo/compare",
          search: { repo, ref, base, head: newHead },
        });
      }}
    />
  );
}

indexRoute.update({ component: IndexPage });
repoRoute.update({ component: RepoLayout });
browseRoute.update({ component: BrowsePage });
historyRoute.update({ component: HistoryPage });
compareRoute.update({ component: ComparePage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  repoRoute.addChildren([browseRoute, historyRoute, compareRoute]),
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
