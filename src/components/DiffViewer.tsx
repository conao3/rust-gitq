import { DiffEditor } from "@monaco-editor/react";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { graphql } from "../graphql";
import { getLang } from "../lib/lang";

type FileResult = {
  repository: {
    file: { content: string; isBinary: boolean } | null;
  };
};

const FILE_QUERY = `query File($path: String!, $ref: String) {
  repository { file(path: $path, ref: $ref) { content isBinary } }
}`;

export function DiffPanel({
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
  const [ready, setReady] = useState(false);

  const handleMount = useCallback(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);

  const { data: originalFile, isLoading: isLoadingOriginal } = useQuery({
    queryKey: ["file", selectedFile, compareBase],
    queryFn: () =>
      graphql<FileResult>(FILE_QUERY, { path: selectedFile!, ref: compareBase }).then(
        (d) => d.repository.file,
      ),
    enabled: !!selectedFile,
  });

  const { data: modifiedFile, isLoading: isLoadingModified } = useQuery({
    queryKey: ["file", selectedFile, compareHead],
    queryFn: () =>
      graphql<FileResult>(FILE_QUERY, { path: selectedFile!, ref: compareHead }).then(
        (d) => d.repository.file,
      ),
    enabled: !!selectedFile,
    refetchInterval: compareHead === "__working__" ? 2000 : false,
  });

  if (!selectedFile) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Select a file to view diff
      </div>
    );
  }

  if (isLoadingOriginal || isLoadingModified) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-400">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-300" />
        Loading...
      </div>
    );
  }

  if (originalFile?.isBinary || modifiedFile?.isBinary) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Binary file
      </div>
    );
  }

  return (
    <div className={ready ? "h-full" : "h-full invisible"}>
      <DiffEditor
        original={originalFile?.content ?? ""}
        modified={modifiedFile?.content ?? ""}
        language={getLang(selectedFile)}
        theme="vs-dark"
        onMount={handleMount}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderSideBySide: layout === "split",
          ignoreTrimWhitespace: hideWhitespace,
          hideUnchangedRegions: { enabled: true },
        }}
      />
    </div>
  );
}
