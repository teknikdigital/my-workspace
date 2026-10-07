import React from "react";
import { checkAiConfig, getAiUsageToday } from "@/lib/ai/service";
import { getAiConversation, listAiConversations } from "@/lib/actions/aiChats";
import { AiChatClient } from "./AiChatClient";

export const revalidate = 0;

/** /ai?c=<id> membuka percakapan tersimpan (tetap sama setelah halaman di-refresh). */
export default async function AiPage({ searchParams }: { searchParams?: { c?: string } }) {
  const c = typeof searchParams?.c === "string" ? searchParams.c : "";
  const [config, usage, list, current] = await Promise.all([
    checkAiConfig(),
    getAiUsageToday(),
    listAiConversations(),
    c ? getAiConversation(c) : Promise.resolve(null),
  ]);
  return (
    <AiChatClient
      key={current?.conversation.id || "new"}
      initialConfig={config}
      initialUsage={usage}
      initialConversations={list}
      initialConversation={current}
    />
  );
}
