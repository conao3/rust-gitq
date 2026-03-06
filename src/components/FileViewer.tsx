import Editor from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { graphql } from "../graphql";
import { getLang } from "../lib/lang";

type FileData = {
  repository: {
    file: { path: string; content: string; size: number; isBinary: boolean } | null;
  };
};

export function FileViewer({
  filePath,
  currentRef,
}: {
  filePath: string | null;
  currentRef: string | null;
}) {
  const { data: fileData } = useQuery({
    queryKey: ["file", filePath, currentRef],
    queryFn: () =>
      graphql<FileData>(
        `query File($path: String!, $ref: String) { repository { file(path: $path, ref: $ref) { path content size isBinary } } }`,
        { path: filePath!, ref: currentRef },
      ).then((d) => d.repository.file),
    enabled: !!filePath,
  });

  if (!filePath) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Select a file to view
      </div>
    );
  }

  if (fileData?.isBinary) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Binary file
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-neutral-700 bg-neutral-800 px-4 py-1.5 text-sm">
        {filePath}
      </div>
      <div className="flex-1">
        <Editor
          value={fileData?.content ?? ""}
          language={getLang(filePath)}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
