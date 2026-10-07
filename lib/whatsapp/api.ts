/**
 * Pengirim pesan WhatsApp Cloud API (Graph API). Versi default v25.0, bisa diganti env WHATSAPP_GRAPH_VERSION.
 * WHATSAPP_GRAPH_URL hanya untuk pengujian (mengarahkan ke server tiruan).
 */

function base() {
  const ver = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";
  const root = (process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com").replace(/\/+$/, "");
  return `${root}/${ver}/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; error?: string }> {
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!token || !process.env.WHATSAPP_PHONE_NUMBER_ID) return { ok: false, status: 0, error: "WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID belum diisi" };
  try {
    const res = await fetch(`${base()}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true, status: res.status };
    const j: any = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, error: j?.error?.message || res.statusText };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
}

export function sendText(to: string, body: string) {
  return post("messages", { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body, preview_url: false } });
}

/** Tandai dibaca + tampilkan indikator "sedang mengetik" selama AI memproses. */
export function markReadTyping(messageId: string) {
  return post("messages", { messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } });
}
