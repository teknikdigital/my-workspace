"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { searchWorkspace } from "@/lib/actions/search";
import type { SearchResultItem } from "@/types/database";
import {
  Briefcase,
  Layers,
  Link as LinkIcon,
  Users,
  CheckSquare,
  FileText,
  Search,
  X,
  Loader2,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, SearchResultItem[]>>({});
  const [isSearching, startTransition] = useTransition();
  const router = useRouter();

  // Toggle on Ctrl+K or Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setResults({});
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchWorkspace(query);
        setResults(res);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (urlPath: string) => {
    setOpen(false);
    setQuery("");
    router.push(urlPath);
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "project":
        return <Briefcase className="h-4 w-4 text-teal" />;
      case "application":
        return <Layers className="h-4 w-4 text-orange" />;
      case "resource":
        return <LinkIcon className="h-4 w-4 text-emerald-500" />;
      case "account":
        return <Users className="h-4 w-4 text-purple-500" />;
      case "task":
        return <CheckSquare className="h-4 w-4 text-amber-500" />;
      case "note":
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <Search className="h-4 w-4 text-mute" />;
    }
  };

  const getEntityHeader = (type: string) => {
    switch (type) {
      case "project":
        return "Projects";
      case "application":
        return "Applications";
      case "resource":
        return "Resources";
      case "account":
        return "Accounts";
      case "task":
        return "Tasks";
      case "note":
        return "Notes";
      default:
        return type;
    }
  };

  if (!open) return null;

  const hasResults = Object.keys(results).length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-panel border border-line bg-card p-2 shadow-soft overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="w-full" shouldFilter={false}>
          <div className="flex items-center gap-3 border-b border-line px-3 pb-2 pt-1">
            <Search className="h-4 w-4 text-teal shrink-0" />
            <Command.Input
              autoFocus
              id="cmd-palette-input"
              value={query}
              onValueChange={setQuery}
              placeholder="Ketik untuk mencari project, aplikasi, resource, task..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-mute focus:outline-none"
            />
            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-teal" />}
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-mute hover:text-ink hover:bg-line/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            {!query.trim() && (
              <div className="py-8 text-center text-xs text-mute">
                Mulai mengetik untuk mencari data di seluruh workspace...
              </div>
            )}

            {query.trim() && !isSearching && !hasResults && (
              <div className="py-8 text-center text-sm text-mute">
                Tidak ada hasil ditemukan untuk &ldquo;{query}&rdquo;
              </div>
            )}

            {Object.entries(results).map(([entityType, items]) => (
              <Command.Group
                key={entityType}
                heading={
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-teal">
                    {getEntityHeader(entityType)}
                  </div>
                }
              >
                {items.map((item) => (
                  <Command.Item
                    key={`${item.entity_type}-${item.entity_id}`}
                    value={`${item.title} ${item.subtitle}`}
                    onSelect={() => handleSelect(item.url_path)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-ink hover:bg-teal/10 hover:text-teal aria-selected:bg-teal/10 aria-selected:text-teal transition-all"
                  >
                    <div className="flex items-center gap-3 truncate">
                      {getEntityIcon(item.entity_type)}
                      <div className="truncate">
                        <div className="font-medium text-ink truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-xs text-mute truncate">{item.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-mute uppercase font-semibold">Buka</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
