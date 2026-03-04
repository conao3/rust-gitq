import { useState } from "react";
import { DirBrowser } from "./components/DirBrowser";
import { Header } from "./components/Header";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";

export function App() {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [currentRef, setCurrentRef] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (!repoPath) {
    return <DirBrowser onOpenRepo={setRepoPath} />;
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-900 text-neutral-200">
      <Header
        repoPath={repoPath}
        currentRef={currentRef}
        onBranchChange={setCurrentRef}
        onChangeRepo={() => {
          setRepoPath(null);
          setSelectedFile(null);
          setCurrentRef(null);
        }}
      />
      <div className="flex min-h-0 flex-1">
        <FileTree
          currentRef={currentRef}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
        <FileViewer filePath={selectedFile} currentRef={currentRef} />
      </div>
    </div>
  );
}
