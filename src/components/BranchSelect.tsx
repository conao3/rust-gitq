import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Branch = { name: string; isHead: boolean; remote: string | null };

export function BranchSelect({
  value,
  onChange,
  branches,
  placeholder,
}: {
  value: string | null;
  onChange: (ref: string) => void;
  branches: Branch[];
  placeholder?: string;
}) {
  const localBranches = branches.filter((b) => !b.remote);
  const remoteNames = [...new Set(branches.filter((b) => b.remote).map((b) => b.remote!))];

  const displayText =
    value === "__working__"
      ? "working"
      : value || placeholder || "select...";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 rounded border border-neutral-600 bg-neutral-700 px-2 py-1 text-sm hover:bg-neutral-600">
          <span className={value === "__working__" ? "italic" : ""}>
            {displayText}
          </span>
          <ChevronDownIcon className="ml-1 size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          className={value === "__working__" ? "italic bg-accent" : "italic"}
          onSelect={() => onChange("__working__")}
        >
          working
        </DropdownMenuItem>
        {localBranches.map((b) => (
          <DropdownMenuItem
            key={b.name}
            className={value === b.name ? "bg-accent" : ""}
            onSelect={() => onChange(b.name)}
          >
            {b.name}
          </DropdownMenuItem>
        ))}
        {remoteNames.length > 0 && <DropdownMenuSeparator />}
        {remoteNames.map((remote) => (
          <DropdownMenuSub key={remote}>
            <DropdownMenuSubTrigger>{remote}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {branches
                .filter((b) => b.remote === remote)
                .map((b) => (
                  <DropdownMenuItem
                    key={b.name}
                    className={value === b.name ? "bg-accent" : ""}
                    onSelect={() => onChange(b.name)}
                  >
                    {b.name.slice(remote.length + 1)}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
