"use server";

import { buildUserWorkspaceSummary } from "./context";
import { AI_TOOL_DEFINITIONS, executeAiTool } from "./tools";

export interface AiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiResponse {
  isConfigured: boolean;
  provider: string;
  response: string;
  toolExecutions?: { toolName: string; result: any }[];
  error?: string;
}

export async function checkAiConfig(): Promise<{
  isConfigured: boolean;
  provider: string;
  model: string;
  missingKeyName: string;
}> {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const isOpenAi = provider === "openai";
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

  if (isOpenAi) {
    return {
      isConfigured: hasOpenAiKey,
      provider: "OpenAI",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      missingKeyName: "OPENAI_API_KEY",
    };
  } else {
    return {
      isConfigured: hasAnthropicKey,
      provider: "Claude (Anthropic)",
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      missingKeyName: "ANTHROPIC_API_KEY",
    };
  }
}

export async function sendAiQuery(
  messages: AiChatMessage[]
): Promise<AiResponse> {
  const config = await checkAiConfig();

  if (!config.isConfigured) {
    return {
      isConfigured: false,
      provider: config.provider,
      response: `AI Assistant belum dikonfigurasi. Silakan tambahkan \`${config.missingKeyName}\` pada environment variable (.env.local atau Vercel Settings) untuk mengaktifkan asisten cerdas.`,
    };
  }

  const workspaceContext = await buildUserWorkspaceSummary();

  const systemPrompt = `
Kamu adalah AI Assistant cerdas untuk "My Workspace" — Personal Work & Life OS milik pengguna.
Bahasa respon: Bahasa Indonesia yang ramah, profesional, ringkas, dan jelas.

TUGAS UTAMA:
1. Memahami arsitektur & relasi mendalam antar entitas:
   Project -> Application -> Resource -> Account -> Task -> Activity -> Note.
2. Ketika pengguna bertanya tentang database / repository / deployment / akun suatu project, telusuri hubungan tersebut dan jawab secara lengkap (nama resource, akun yang menaungi, link/dashboard jika ada).
3. Jika pengguna meminta membuat task / note, gunakan tool yang tersedia untuk menyimpannya ke database.
4. JANGAN PERNAH meminta atau mengarang kredensial / password rahasia pengguna.

${workspaceContext}
`.trim();

  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

  if (provider === "claude" || provider === "anthropic") {
    return await handleAnthropicChat(messages, systemPrompt);
  } else {
    return await handleOpenAiChat(messages, systemPrompt);
  }
}

// -----------------------------------------------------------------------------
// OpenAI Implementation
// -----------------------------------------------------------------------------
async function handleOpenAiChat(
  messages: AiChatMessage[],
  systemPrompt: string
): Promise<AiResponse> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const openAiTools = AI_TOOL_DEFINITIONS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const conversation = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: conversation,
        tools: openAiTools,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        isConfigured: true,
        provider: "OpenAI",
        response: `Gagal memproses permintaan ke OpenAI API: ${res.status} ${res.statusText}`,
        error: errText,
      };
    }

    const data = await res.json();
    const choice = data.choices?.[0]?.message;

    // Check if model wants to invoke tools
    if (choice?.tool_calls && choice.tool_calls.length > 0) {
      const toolExecutions: { toolName: string; result: any }[] = [];
      const toolResultsMessages = [];

      for (const tc of choice.tool_calls) {
        const fnName = tc.function.name;
        const fnArgs = JSON.parse(tc.function.arguments || "{}");
        const execResult = await executeAiTool(fnName, fnArgs);
        toolExecutions.push({ toolName: fnName, result: execResult });

        toolResultsMessages.push({
          tool_call_id: tc.id,
          role: "tool",
          name: fnName,
          content: JSON.stringify(execResult),
        });
      }

      // Send tool results back for final answer
      const followUpRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [...conversation, choice, ...toolResultsMessages],
        }),
      });

      const followUpData = await followUpRes.json();
      const finalContent =
        followUpData.choices?.[0]?.message?.content ||
        "Aksi telah berhasil dijalankan.";

      return {
        isConfigured: true,
        provider: "OpenAI",
        response: finalContent,
        toolExecutions,
      };
    }

    return {
      isConfigured: true,
      provider: "OpenAI",
      response: choice?.content || "Tidak ada respon dari AI.",
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      provider: "OpenAI",
      response: "Terjadi kesalahan saat berkomunikasi dengan OpenAI API.",
      error: err.message,
    };
  }
}

// -----------------------------------------------------------------------------
// Anthropic (Claude) Implementation
// -----------------------------------------------------------------------------
async function handleAnthropicChat(
  messages: AiChatMessage[],
  systemPrompt: string
): Promise<AiResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

  const claudeTools = AI_TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  const anthropicMessages = messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: claudeTools,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        isConfigured: true,
        provider: "Claude",
        response: `Gagal memproses permintaan ke Anthropic API: ${res.status}`,
        error: errText,
      };
    }

    const data = await res.json();
    let textResponse = "";
    const toolExecutions: { toolName: string; result: any }[] = [];

    for (const block of data.content || []) {
      if (block.type === "text") {
        textResponse += block.text;
      } else if (block.type === "tool_use") {
        const result = await executeAiTool(block.name, block.input);
        toolExecutions.push({ toolName: block.name, result });
      }
    }

    return {
      isConfigured: true,
      provider: "Claude",
      response:
        textResponse ||
        (toolExecutions.length > 0
          ? "Aksi tool telah dijalankan sesuai permintaanmu."
          : "Respon diterima dari Claude."),
      toolExecutions,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      provider: "Claude",
      response: "Terjadi kesalahan saat berkomunikasi dengan Claude API.",
      error: err.message,
    };
  }
}
