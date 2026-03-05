import { useQuery } from "@tanstack/react-query";
import { graphql } from "../graphql";
import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

type FileData = {
  repository: {
    file: { path: string; content: string; size: number; isBinary: boolean } | null;
  };
};

const EXT_TO_LANG: Record<string, string> = {
  rs: "rust",
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  go: "go",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  zig: "zig",
  lua: "lua",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  ps1: "powershell",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  mdx: "mdx",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  nix: "nix",
  clj: "clojure",
  cljs: "clojure",
  cljc: "clojure",
  edn: "clojure",
  el: "elisp",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  ml: "ocaml",
  mli: "ocaml",
  r: "r",
  R: "r",
  php: "php",
  pl: "perl",
  vim: "viml",
  tf: "hcl",
  proto: "proto",
  makefile: "make",
  cmake: "cmake",
  ini: "ini",
  conf: "ini",
  diff: "diff",
  patch: "diff",
  gitignore: "gitignore",
} as const;

function getLang(filePath: string): string | null {
  const name = filePath.split("/").pop() ?? "";
  const lower = name.toLowerCase();
  if (lower === "makefile" || lower === "gnumakefile") return "make";
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "cmakelists.txt") return "cmake";
  if (lower === ".gitignore") return "gitignore";
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  return EXT_TO_LANG[ext] ?? null;
}

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: [],
    });
  }
  return highlighterPromise;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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

  const { data: highlightedLines } = useQuery({
    queryKey: ["highlight", filePath, fileData?.content],
    queryFn: async () => {
      const lang = getLang(filePath!);
      if (!lang) return fileData!.content.split("\n").map((l) => escapeHtml(l));
      const hl = await getHighlighter();
      if (!hl.getLoadedLanguages().includes(lang)) {
        await hl.loadLanguage(lang as Parameters<Highlighter["loadLanguage"]>[0]);
      }
      const tokens = hl.codeToTokens(fileData!.content, { lang: lang as BundledLanguage, theme: "github-dark" });
      return tokens.tokens.map((line) =>
        line.map((token) => `<span style="color:${token.color}">${escapeHtml(token.content)}</span>`).join(""),
      );
    },
    enabled: !!fileData && !fileData.isBinary && !!filePath,
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

  const lines = fileData?.content?.split("\n") ?? [];

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
                {highlightedLines ? (
                  <td
                    className="whitespace-pre px-4 py-0"
                    dangerouslySetInnerHTML={{ __html: highlightedLines[i] ?? "" }}
                  />
                ) : (
                  <td className="whitespace-pre px-4 py-0">{line}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </pre>
    </div>
  );
}
