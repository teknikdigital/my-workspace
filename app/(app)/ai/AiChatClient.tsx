"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { sendAiQuery, type AiChatMessage } from "@/lib/ai/service";
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
} from "lucide-react";

interface AiChatClientProps {
  initialConfig: {
    isConfigured: boolean;
    provider: string;
    model: string;
    missingKeyName: string;
  };
}

export function AiChatClient({ initialConfig }: AiChatClientProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      role: "assistant",
      content:
        "Halo! Saya asisten AI untuk My Workspace. Saya memahami hubungan antara project, aplikasi, database, repository, akun, dan task milikmu. Ada yang bisa saya bantu?",
    },
  ]);
  const [input, setInput] = useState("");
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

  const handleSend = (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || isPending) return;

    const newMessages: AiChatMessage[] = [
      ...messages,
      { role: "user", content: queryText },
    ];

    setMessages(newMessages);
    setInput("");

    startTransition(async () => {
      const res = await sendAiQuery(newMessages);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.response,
        },
      ]);
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] max-h-[780px] rounded-panel border border-line bg-glass backdrop-blur-md shadow-soft overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-card/60">
        <div className="flex items-center gap-3">
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
                <div className="whitespace-pre-wrap">{msg.content}</div>
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

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-line bg-card p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanyakan relasi project, database apa yang dipakai, atau buat task..."
          disabled={isPending}
          className="flex-1 h-10 rounded-full border border-line bg-glass px-4 text-xs sm:text-sm text-ink placeholder:text-mute focus:border-teal focus:outline-none"
        />

        <button
          type="submit"
          disabled={!input.trim() || isPending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal to-teal-dark text-white shadow-soft hover:opacity-95 disabled:opacity-50 transition-all"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
