"use client";

import React, { useState, useRef, useEffect, useTransition, useCallback } from "react";
import { sendAiQuery, type AiChatMessage } from "@/lib/ai/service";
import { guardMessages } from "@/lib/ai/secretGuard";
import { Markdown } from "@/components/ui/Markdown";
import { guessTargetApp } from "@/lib/local-agent/client";
import { AttachmentBar, newPendingFile, uploadAll, useAgentApps, useExtraction, type PendingFile } from "./AttachmentBar";
import type { UsageSummary } from "@/lib/ai/usage";
import type { ClaudeTaskDraft } from "@/lib/ai/claudeTask";
import { ClaudeTaskCard } from "./ClaudeTaskCard";
import { ConversationList } from "./ConversationList";
import type { ConversationSummary, StoredMessage } from "@/lib/ai/conversationStore";
import {
  deleteAiConversation,
  getAiConversation,
  renameAiConversation,
  saveClaudeTaskRun,
  setAiConversationPinned,
  listAiConversations,
} from "@/lib/actions/aiChats";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Wrench,
  AlertCircle,
  HelpCircle,
  Database,
  CheckSquare,
  Paperclip,
  PanelLeft,
  X,
} from "lucide-react";

const WELCOME: AiChatMessage = {
  role: "assistant",
  content:
    "Halo! Saya asisten AI untuk My Workspace. Saya memahami hubungan antara project, aplikasi, database, repository, akun, dan task milikmu. Ada yang bisa saya bantu?",
};

/** Ganti URL tanpa memuat ulang halaman, agar refresh membuka percakapan yang sama. */
function setUrl(conversationId: string | null) {
  try {
    window.history.replaceState(null, "", conversationId ? `/ai?c=${conversationId}` : "/ai");
  } catch {
    /* abaikan */
  }
}

interface AiChatClientProps {
  initialConfig: {
    isConfigured: boolean;
    provider: string;
    model: string;
    missingKeyName: string;
  };
  initialUsage?: UsageSummary;
  initialConversations?: { available: boolean; items: ConversationSummary[]; reason?: string };
  initialConversation?: { conversation: ConversationSummary; messages: StoredMessage[] } | null;
}

export function AiChatClient({ initialConfig, initialUsage, initialConversations, initialConversation }: AiChatClientProps) {
  const [usage, setUsage] = useState<UsageSummary | undefined>(initialUsage);
  const [messages, setMessages] = useState<AiChatMessage[]>(
    initialConversation?.messages.length ? initialConversation.messages : [WELCOME]
  );
  const [input, setInput] = useState("");
  // Riwayat percakapan (Supabase)
  const [conversationId, setConversationId] = useState<string | null>(initialConversation?.conversation.id || null);
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations?.items || []);
  const [historyAvailable, setHistoryAvailable] = useState(initialConversations?.available ?? true);
  const [historyReason, setHistoryReason] = useState(initialConversations?.reason);
  const recheckHistory = async () => {
    const r = await listAiConversations().catch(() => null);
    if (!r) return;
    setHistoryAvailable(r.available);
    setHistoryReason(r.reason);
    if (r.available) setConversations(r.items);
  };
  const [loadingConv, setLoadingConv] = useState<string | null>(null);
  const [showList, setShowList] = useState(false); // panel riwayat di layar kecil
  const [convError, setConvError] = useState<string | null>(null);

  const newChat = () => {
    setMessages([WELCOME]);
    setConversationId(null);
    setUrl(null);
    setShowList(false);
  };

  const openConversation = async (id: string) => {
    if (id === conversationId) return setShowList(false);
    setLoadingConv(id);
    setConvError(null);
    const r = await getAiConversation(id).catch(() => null);
    setLoadingConv(null);
    if (!r) {
      setConvError("Percakapan tidak bisa dibuka (mungkin sudah dihapus).");
      setConversations((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    setMessages(r.messages.length ? r.messages : [WELCOME]);
    setConversationId(id);
    setUrl(id);
    setShowList(false);
  };

  const renameConversation = async (id: string, title: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    const r = await renameAiConversation(id, title);
    if (!r.success) setConvError(r.error || "Gagal mengganti nama");
  };

  const pinConversation = async (id: string, pinned: boolean) => {
    setConversations((prev) =>
      [...prev.map((c) => (c.id === id ? { ...c, pinned } : c))].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.last_message_at.localeCompare(a.last_message_at)
      )
    );
    const r = await setAiConversationPinned(id, pinned);
    if (!r.success) setConvError(r.error || "Gagal menyematkan");
  };

  const removeConversation = async (id: string) => {
    const r = await deleteAiConversation(id);
    if (!r.success) return setConvError(r.error || "Gagal menghapus");
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) newChat();
  };

  /** Simpan status run Claude Code ke kartu (tampil lagi setelah refresh). */
  const recordTaskRun = useCallback(async (messageId: string | undefined, taskId: string, run: ClaudeTaskDraft["lastRun"]) => {
    if (!run) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.claudeTasks
          ? { ...m, claudeTasks: m.claudeTasks.map((t) => (t.id === taskId ? { ...t, lastRun: run } : t)) }
          : m
      )
    );
    if (messageId) await saveClaudeTaskRun(messageId, taskId, run).catch(() => undefined);
  }, []);
  // Lampiran file -> folder project lewat agent lokal
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [targetId, setTargetId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { apps: agentApps, state: agentState } = useAgentApps(files.length > 0);
  const updateFile = useCallback(
    (id: string, patch: Partial<PendingFile>) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f))),
    []
  );
  useExtraction(files, updateFile); // baca isi file di browser

  // Pilih project tujuan otomatis dari isi pesan (bisa diganti manual)
  useEffect(() => {
    if (!files.length || targetId) return;
    const guess = guessTargetApp(input, agentApps);
    if (guess) setTargetId(guess);
  }, [input, agentApps, files.length, targetId]);
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  const quickPrompts = [
    "Database Warehouse Monitoring apa?",
    "Apa task saya hari ini?",
    "Di mana link Supabase Warehouse?",
    "Apa terakhir yang saya kerjakan di Warehouse Monitoring?",
    "Buat task untuk audit konfigurasi RLS besok",
  ];

  const handleSend = async (textToSend?: string) => {
    let queryText = (textToSend || input).trim();
    const hasFiles = files.length > 0 && !textToSend;
    if ((!queryText && !hasFiles) || isPending || uploading) return;

    // 1. Upload lampiran dulu (langsung ke agent di laptop, tidak lewat AI)
    if (hasFiles) {
      setAttachError(null);
      const target = targetId || guessTargetApp(queryText, agentApps) || "";
      if (agentState !== "ok") {
        setAttachError("Agent tidak aktif, file belum bisa dikirim.");
        return;
      }
      if (!target) {
        setAttachError("Pilih project tujuan di 'Simpan ke' atau sebut nama project di pesan.");
        return;
      }
      setUploading(true);
      const summary = await uploadAll(files, target, updateFile);
      setUploading(false);
      queryText = `${queryText || "Saya mengirim file."}\n\n${summary}`;
      setFiles([]);
      setTargetId("");
    }

    const newMessages: AiChatMessage[] = [
      ...messages,
      { role: "user", content: queryText },
    ];

    setMessages(newMessages);
    setInput("");

    startTransition(async () => {
      const res = await sendAiQuery(newMessages, conversationId);
      if (res.usageToday) setUsage(res.usageToday);
      const history = [...(res.maskedMessages || newMessages)];
      const conv = res.conversation;
      if (res.historySaved === false) {
        setHistoryAvailable(false);
        setHistoryReason(res.historyError);
      }
      if (conv) {
        // Tandai pesan pengguna terakhir dengan id tersimpan
        const lastUser = history.map((m) => m.role).lastIndexOf("user");
        if (lastUser >= 0) history[lastUser] = { ...history[lastUser], id: conv.userMessageId };
        setConversationId(conv.id);
        setUrl(conv.id);
        const now = new Date().toISOString();
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === conv.id);
          const item: ConversationSummary = existing
            ? { ...existing, last_message_at: now }
            : { id: conv.id, title: conv.title, pinned: false, last_message_at: now };
          const rest = prev.filter((c) => c.id !== conv.id);
          return [...rest.filter((c) => c.pinned), item, ...rest.filter((c) => !c.pinned)].sort(
            (a, b) => Number(b.pinned) - Number(a.pinned) || b.last_message_at.localeCompare(a.last_message_at)
          );
        });
      }
      // Ganti riwayat dengan versi tersamar dari server: password tidak tersimpan lagi di memori browser
      setMessages([
        ...history,
        {
          role: "assistant",
          content: res.response,
          ...(conv ? { id: conv.assistantMessageId } : {}),
          ...(res.claudeTasks?.length ? { claudeTasks: res.claudeTasks } : {}),
        },
      ]);
    });
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-210px)] max-h-[780px]">
      {/* Riwayat percakapan: panel kiri (layar lebar) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col rounded-panel border border-line bg-glass backdrop-blur-md shadow-soft overflow-hidden">
        <ConversationList
            items={conversations}
            available={historyAvailable}
            reason={historyReason}
            onRecheck={recheckHistory}
            currentId={conversationId}
            loadingId={loadingConv}
            onNew={newChat}
            onOpen={openConversation}
            onRename={renameConversation}
            onPin={pinConversation}
            onDelete={removeConversation}
        />
      </aside>
      {/* Riwayat percakapan: panel melayang (layar kecil) */}
      {showList && (
        <div className="fixed inset-0 z-50 flex bg-black/40 lg:hidden" onClick={() => setShowList(false)}>
          <aside className="h-full w-72 max-w-[85vw] bg-card shadow-soft" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs font-bold text-ink">
              Riwayat chat
              <button type="button" onClick={() => setShowList(false)} aria-label="Tutup" className="p-1 text-mute">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-41px)]">
              <ConversationList
            items={conversations}
            available={historyAvailable}
            reason={historyReason}
            onRecheck={recheckHistory}
            currentId={conversationId}
            loadingId={loadingConv}
            onNew={newChat}
            onOpen={openConversation}
            onRename={renameConversation}
            onPin={pinConversation}
            onDelete={removeConversation}
              />
            </div>
          </aside>
        </div>
      )}
    <div className="flex flex-1 min-w-0 flex-col rounded-panel border border-line bg-glass backdrop-blur-md shadow-soft overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-card/60">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowList(true)}
            title="Riwayat chat"
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full border border-line text-mute hover:text-teal"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-teal via-teal-dark to-orange text-white shadow-sm font-bold">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <span>AI Workspace Assistant</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  initialConfig.isConfigured
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                }`}
              >
                {initialConfig.isConfigured
                  ? `${initialConfig.provider} (${initialConfig.model})`
                  : "Belum Dikonfigurasi"}
              </span>
            </h2>
            <p className="text-[11px] text-mute">
              Memahami konteks project, arsitektur, task, dan relasi multi-akun.
            </p>
            {usage && (
              <p
                className={`text-[10px] font-semibold ${usage.exceeded ? "text-red" : "text-mute"}`}
                title={usage.tracking ? `${usage.todayTokens.toLocaleString("id-ID")} token hari ini` : "Jalankan migration ai_usage untuk mengaktifkan pencatat"}
              >
                {usage.tracking
                  ? `Pemakaian hari ini: Rp ${usage.todayIdr.toLocaleString("id-ID")} / Rp ${usage.budgetIdr.toLocaleString("id-ID")}`
                  : "Pencatat pemakaian belum aktif (tabel ai_usage belum dibuat)"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Unconfigured Alert Banner if needed */}
      {!initialConfig.isConfigured && (
        <div className="flex items-center gap-3 bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            API Key belum diisi. Tambahkan <code>{initialConfig.missingKeyName}</code> di <code>.env.local</code> atau Vercel.
          </span>
        </div>
      )}

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isUser
                    ? "bg-teal text-white"
                    : "bg-gradient-to-tr from-teal via-teal-dark to-orange text-white"
                }`}
              >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? "bg-teal text-white rounded-tr-none shadow-sm"
                    : "bg-card/90 border border-line text-ink rounded-tl-none shadow-soft"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap">
                    {/* Samarkan rahasia di layar sejak pesan dikirim (sebelum balasan server tiba) */}
                    {guardMessages([msg]).maskedMessages[0].content}
                  </div>
                ) : (
                  // Jawaban AI: tampilkan Markdown (tebal, judul, daftar) dengan rapi
                  <>
                    <Markdown text={msg.content} />
                    {msg.claudeTasks?.map((t) => (
                      <ClaudeTaskCard key={t.id} task={t} onRun={(run) => recordTaskRun(msg.id, t.id, run)} />
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {isPending && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-teal via-teal-dark to-orange text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl bg-card border border-line p-3.5 shadow-soft flex items-center gap-2 text-xs text-mute">
              <Loader2 className="h-4 w-4 animate-spin text-teal" />
              <span>Memahami konteks workspace dan merespon...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="border-t border-line bg-card/40 px-4 py-2.5 overflow-x-auto flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase text-mute whitespace-nowrap">
          Saran:
        </span>
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={isPending}
            className="rounded-full border border-line bg-card/80 px-3 py-1 text-[11px] font-medium text-ink hover:border-teal hover:text-teal whitespace-nowrap transition-all"
          >
            {prompt}
          </button>
        ))}
      </div>

      {convError && (
        <p className="border-t border-line bg-red/10 px-4 py-2 text-[11px] text-red" onClick={() => setConvError(null)}>
          {convError}
        </p>
      )}
      {attachError && <p className="border-t border-line bg-red/10 px-4 py-2 text-[11px] text-red">{attachError}</p>}
      <AttachmentBar
        files={files}
        onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
        onToggleRead={(id, read) => updateFile(id, { read })}
        apps={agentApps}
        agentState={agentState}
        targetId={targetId}
        onTargetChange={setTargetId}
        disabled={uploading}
      />

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-line bg-card p-3"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []).map(newPendingFile);
            setFiles((prev) => [...prev, ...picked]);
            setAttachError(null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending || uploading}
          title="Lampirkan file (disimpan ke folder project di laptop)"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-mute hover:text-teal hover:border-teal disabled:opacity-50 transition-all"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanyakan apa saja. Password otomatis dicegat & disimpan ke Vault, tidak dikirim ke AI."
          autoComplete="off"
          disabled={isPending}
          className="flex-1 h-10 rounded-full border border-line bg-glass px-4 text-xs sm:text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none"
        />

        <button
          type="submit"
          disabled={(!input.trim() && files.length === 0) || isPending || uploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal to-teal-dark text-white shadow-soft hover:opacity-95 disabled:opacity-50 transition-all"
        >
          {isPending || uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
    </div>
  );
}
