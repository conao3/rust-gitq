import { useEffect, useState } from "react";
import { graphql } from "../graphql";

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
  const [content, setContent] = useState<string | null>(null);
  const [isBinary, setIsBinary] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setContent(null);
      return;
    }
    graphql<FileData>(
      `query File($path: String!, $ref: String) { repository { file(path: $path, ref: $ref) { path content size isBinary } } }`,
      { path: filePath, ref: currentRef },
    ).then((data) => {
      if (data.repository.file) {
        setContent(data.repository.file.content);
        setIsBinary(data.repository.file.isBinary);
      } else {
        setContent(null);
      }
    });
  }, [filePath, currentRef]);

  if (!filePath) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Select a file to view
      </div>
    );
  }

  if (isBinary) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        Binary file
      </div>
    );
  }

  const lines = content?.split("\n") || [];

  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-neutral-700 bg-neutral-800 px-4 py-1.5 text-sm">
        {filePath}
      </div>
      <pre className="text-sm">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-neutral-800/50">
                <td className="select-none border-r border-neutral-700 px-3 py-0 text-right text-neutral-500">
                  {i + 1}
                </td>
                <td className="whitespace-pre px-4 py-0">{line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </pre>
    </div>
  );
}
