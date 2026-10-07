"use client";

/**
 * Daftar percakapan AI Assistant (riwayat chat tersimpan di Supabase).
 * Chat baru, buka, ganti nama (inline), sematkan, hapus (konfirmasi inline).
 */

import React, { useState } from "react";
import { MessageSquarePlus, Pin, PinOff, Pencil, Trash2, Check, X, MessageSquare, DatabaseZap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/ai/conversationStore";

function relTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "baru saja";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(today.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return "kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function ConversationList({
  items,
  available,
  reason,
  onRecheck,
  currentId,
  loadingId,
  onNew,
  onOpen,
  onRename,
  onPin,
  onDelete,
}: {
  items: ConversationSummary[];
  available: boolean;
  reason?: string;
  onRecheck?: () => void;
  currentId: string | null;
  loadingId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 border-b border-line">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-btn bg-teal px-3 py-2 text-xs font-bold text-white shadow-soft hover:bg-teal-dark"
        >
          <MessageSquarePlus className="h-4 w-4" /> Chat baru
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {!available && (
          <div className="m-1 rounded-btn border border-orange/40 bg-orange/10 p-3 text-[11px] text-ink">
            <div className="mb-1 flex items-center gap-1.5 font-bold">
              <DatabaseZap className="h-3.5 w-3.5 text-orange" /> Riwayat belum aktif
            </div>
            Jalankan migration <code>20261007000001_ai_conversations.sql</code> di Supabase SQL Editor (project My Workspace).
            {reason && <p className="mt-1 break-words font-mono text-[10px] text-mute">Detail: {reason}</p>}
            {onRecheck && (
              <button
                type="button"
                onClick={onRecheck}
                className="mt-2 rounded border border-line bg-card px-2 py-1 text-[11px] font-semibold hover:border-teal"
              >
                Cek lagi
              </button>
            )}
          </div>
        )}
        {available && items.length === 0 && <p className="p-3 text-[11px] text-mute">Belum ada percakapan tersimpan.</p>}
        {items.map((c) => {
          const active = c.id === currentId;
          return (
            <div
              key={c.id}
              className={cn(
                "group relative rounded-btn px-2.5 py-2 text-xs transition-colors",
                active ? "bg-teal/10 text-ink" : "text-ink hover:bg-line/30"
              )}
            >
              {editing === c.id ? (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) onRename(c.id, draft.trim());
                    setEditing(null);
                  }}
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                    maxLength={80}
                    className="min-w-0 flex-1 rounded border border-teal bg-card px-1.5 py-1 text-xs"
                  />
                  <button type="submit" aria-label="Simpan" className="p-1 text-ok">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Batal" onClick={() => setEditing(null)} className="p-1 text-mute">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : confirmDel === c.id ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-red">Hapus percakapan ini?</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(c.id);
                        setConfirmDel(null);
                      }}
                      className="rounded bg-red px-2 py-0.5 text-[10px] font-bold text-white"
                    >
                      Hapus
                    </button>
                    <button type="button" onClick={() => setConfirmDel(null)} className="rounded border border-line px-2 py-0.5 text-[10px]">
                      Batal
                    </button>
                  </span>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-start gap-2 text-left">
                    {c.pinned ? (
                      <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange" />
                    ) : (
                      <MessageSquare className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", active ? "text-teal" : "text-mute")} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", active && "font-bold")}>{c.title}</span>
                      <span className="block text-[10px] text-mute">{loadingId === c.id ? "Membuka..." : relTime(c.last_message_at)}</span>
                    </span>
                  </button>
                  <div className="absolute right-1.5 top-1.5 hidden items-center gap-0.5 rounded bg-card/95 shadow-sm group-hover:flex">
                    <button
                      type="button"
                      title={c.pinned ? "Lepas sematan" : "Sematkan (tidak terhapus otomatis)"}
                      onClick={() => onPin(c.id, !c.pinned)}
                      className="p-1 text-mute hover:text-orange"
                    >
                      {c.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      title="Ganti nama"
                      onClick={() => {
                        setDraft(c.title);
                        setEditing(c.id);
                      }}
                      className="p-1 text-mute hover:text-teal"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Hapus" onClick={() => setConfirmDel(c.id)} className="p-1 text-mute hover:text-red">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {available && (
        <p className="border-t border-line p-2 text-center text-[10px] text-mute">
          Tersimpan 180 hari sejak pesan terakhir. Disematkan = permanen.
        </p>
      )}
    </div>
  );
}
