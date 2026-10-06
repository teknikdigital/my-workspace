"use server";

import { createClient } from "@/lib/supabase/server";

export interface SmartNoteResult {
  title: string;
  content: string;
  tags: string[];
  suggestedProject?: string;
  error?: string;
}

export async function smartFormatNote(rawText: string): Promise<SmartNoteResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      title: "Catatan",
      content: rawText,
      tags: [],
      error: "OpenAI API Key belum terkonfigurasi di environment.",
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const systemPrompt = `
Kamu adalah AI perapih catatan profesional untuk platform "My Workspace".
Tugas:
1. Analisis teks mentah dari pengguna.
2. Buat judul catatan (title) yang ringkas dan padat.
3. Rapikan isi catatan (content) menjadi format Markdown yang rapi, berstruktur (heading, bullet points, code block bila ada).
4. Berikan 2-4 tags relevan (lowercase, contoh: ["arsitektur", "supabase", "database"]).
5. Format output WAJIB berupa JSON:
{
  "title": "string",
  "content": "string (markdown formatted)",
  "tags": ["string", "string"]
}
`.trim();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Berikut draf teks catatan saya:\n\n${rawText}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        title: "Catatan",
        content: rawText,
        tags: [],
        error: `Gagal memanggil OpenAI: ${res.statusText}`,
      };
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    return {
      title: parsed.title || "Catatan Terstruktur",
      content: parsed.content || rawText,
      tags: parsed.tags || [],
    };
  } catch (error: any) {
    return {
      title: "Catatan",
      content: rawText,
      tags: [],
      error: error.message || "Gagal memproses AI smart note",
    };
  }
}
