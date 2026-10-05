import React from "react";
import { checkAiConfig } from "@/lib/ai/service";
import { AiChatClient } from "./AiChatClient";

export const revalidate = 0;

export default async function AiPage() {
  const config = await checkAiConfig();
  return <AiChatClient initialConfig={config} />;
}
