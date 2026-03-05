import { useState } from "react";
import { DirBrowser } from "./components/DirBrowser";
import { Header } from "./components/Header";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import { BranchCompare } from "./components/BranchCompare";

export function App() {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [currentRef, setCurrentRef] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"browse" | "compare">("browse" as const);
  const [compareBase, setCompareBase] = useState<string | null>(null);
  const [compareHead, setCompareHead] = useState<string | null>(null);
  const [browserPath, setBrowserPath] = useState<string | null>(null);

  if (!repoPath) {
    return <DirBrowser initialPath={browserPath} onOpenRepo={(path) => {
      setBrowserPath(path.split("/").slice(0, -1).join("/") || "/");
      setRepoPath(path);
    }} />;
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-900 text-neutral-200">
      <Header
        repoPath={repoPath}
        currentRef={currentRef}
        viewMode={viewMode}
        onBranchChange={setCurrentRef}
        onChangeRepo={() => {
          setRepoPath(null);
          setSelectedFile(null);
          setCurrentRef(null);
          setViewMode("browse" as const);
        }}
        onToggleCompare={() => {
          if (viewMode === "browse") {
            setViewMode("compare" as const);
            setCompareBase(currentRef);
            setCompareHead(null);
          } else {
            setViewMode("browse" as const);
          }
        }}
      />
      {viewMode === "compare" ? (
        <BranchCompare
          compareBase={compareBase}
          compareHead={compareHead}
          onBaseChange={setCompareBase}
          onHeadChange={setCompareHead}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <FileTree
            currentRef={currentRef}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
          <FileViewer filePath={selectedFile} currentRef={currentRef} />
        </div>
      )}
    </div>
  );
}
