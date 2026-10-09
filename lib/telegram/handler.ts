/**
 * Memproses pesan Telegram dari pemilik: AI Asisten yang sama dengan halaman /ai,
 * berjalan dengan sesi & RLS pemilik. Riwayat masuk ke percakapan "✈️ Telegram · <tanggal>".
 * Hanya chat pribadi dari TELEGRAM_OWNER_ID yang dilayani.
 *
 * Tambahan khusus Telegram:
 *  - file masuk (PDF/Word/Excel/teks) dibaca dan diteruskan ke AI seperti lampiran 📎 di web
 *  - dokumen buatan AI / dokumen tersimpan dikirim sebagai file (.docx / .md)
 *  - kartu Claude Code dengan tombol ▶️ Jalankan (antrian, dikerjakan agent laptop)
 */

import { firstTime, runOwnerTurn, withOwner, type ChannelSpec } from "@/lib/chatbot/runner";
import { buildFileBlock } from "@/lib/ai/fileBlocks";
import { canExtract, fileKind } from "@/lib/files/extractText";
import { extractTextFromBuffer } from "@/lib/files/extractServer";
import { markdownToDocx, safeFileBase } from "@/lib/documents/markdownToDocx";
import { readLocalOriginal } from "@/lib/files/localOriginal";
import { canStore, readStorageOriginal, saveOriginalToStorage, storagePathOf } from "@/lib/files/storageOriginal";
import type { GeneratedFile } from "@/lib/ai/generatedFile";
import type { ClaudeTaskDraft } from "@/lib/ai/claudeTask";
import { cancelJob, createDraftJob, queueJob, setJobMessage } from "@/lib/claudeQueue/jobs";
import { QUEUE_TTL_HOURS, jobButtons, jobCardText, parseJobCallback } from "@/lib/claudeQueue/format";
import { TG_HELP, parseTgCommand, toTelegramHtml, type TgCallback, type TgInbound } from "./core";
import { replyMarkdown } from "./reply";
import { MAX_DOWNLOAD_BYTES, answerCallback, downloadFile, editHtml, keepTyping, sendDocument, sendHtml, sendPlain } from "./api";

function log(...a: unknown[]) {
  console.log("[telegram]", ...a);
}

export const TELEGRAM_CHANNEL: ChannelSpec = {
  channel: "telegram",
  prefix: "✈️ Telegram",
  tag: "telegram",
  format: (md) => md, // tetap Markdown; diubah ke HTML saat dikirim per bagian
  // kartu Claude Code dikirim terpisah dengan tombol, jadi tanpa catatan teks
  secretNote: "⚠️ Chat bot Telegram tidak end-to-end terenkripsi. Lain kali simpan password lewat halaman Vault di web.",
};

export { replyMarkdown } from "./reply";

function ownerId() {
  return String(process.env.TELEGRAM_OWNER_ID || "").trim();
}

function wib(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)} WIB`;
}

/* ------------------------------ file masuk ------------------------------ */

/**
 * File dari pengguna -> isi pesan untuk AI (blok [ISI FILE]), balasan langsung, atau penolakan.
 * File ASLI selalu disimpan ke menu Documents (Supabase Storage) agar bisa dikirim balik walau laptop mati.
 */
export async function fileToMessage(msg: TgInbound): Promise<{ content?: string; reject?: string; reply?: string }> {
  const doc = msg.document!;
  const readable = canExtract(doc.fileName);
  const storable = canStore(doc.fileName);
  if (!readable && !storable) return { reject: "Jenis file belum didukung. Yang bisa disimpan/dibaca: PDF, Word, Excel, PowerPoint, gambar, TXT/CSV/MD, ZIP." };
  if (doc.fileSize > MAX_DOWNLOAD_BYTES) return { reject: "File lebih dari 20 MB (batas Telegram Bot). Unggah lewat My Workspace > Personal > Documents." };
  const dl = await downloadFile(doc.fileId);
  if (!dl.ok) return { reject: `Gagal mengambil file: ${dl.error}` };

  let ref: string | null = null;
  let storeError: string | null = null;
  if (storable) {
    const st = await withOwner(() => saveOriginalToStorage({ data: dl.data, fileName: doc.fileName })).catch((e) => ({ ok: false as const, error: (e as Error).message }));
    if (st.ok) ref = st.ref;
    else {
      storeError = st.error;
      log("gagal simpan file asli:", st.error);
    }
  }
  const savedLine = ref ? `✅ File asli **${doc.fileName}** disimpan di My Workspace > Personal > Documents. Minta kapan saja: "kirim ${doc.fileName.replace(/\.[^.]+$/, "")}".` : "";

  if (!readable) {
    if (ref) return { reply: `${savedLine}\n\n${fileKind(doc.fileName) === "image" ? "Isi gambar belum bisa dibaca (perlu OCR)." : "Isi file jenis ini belum bisa dibaca, tapi file aslinya aman tersimpan."}` };
    return { reject: `Gagal menyimpan file: ${storeError || "jenis tidak didukung"}` };
  }
  const ex = await extractTextFromBuffer(dl.data, doc.fileName);
  if (!ex.ok) {
    if (ref) return { reply: `${savedLine}\n\nIsinya tidak bisa dibaca: ${ex.reason}` };
    return { reject: `${doc.fileName}: ${ex.reason}` };
  }
  const block = buildFileBlock({ name: doc.fileName, project: "", path: ref || "Telegram" }, ex.text);
  const ask = msg.caption?.trim() || "Baca dokumen ini dan simpan fakta pentingnya. Bila project-nya jelas dari isi dokumen, kaitkan ke project itu.";
  const note = ref
    ? "\n\n(Catatan sistem: file ASLI sudah tersimpan otomatis di menu Documents. Jangan membuat dokumen baru dari file ini kecuali diminta.)"
    : storeError
      ? `\n\n(Catatan sistem: file asli GAGAL disimpan (${storeError}); hanya teksnya yang tersimpan. Sampaikan ini ke pengguna.)`
      : "";
  return { content: `${block}\n\n${ask}${note}` };
}

/* ------------------------------ file keluar ------------------------------ */

export async function fileBuffer(f: GeneratedFile): Promise<{ data: Buffer; name: string }> {
  const name = `${safeFileBase(f.title)}.${f.format}`;
  if (f.format === "md") return { data: Buffer.from(`# ${f.title}\n\n${f.markdown}\n`, "utf8"), name };
  const tgl = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).split("-").reverse().join("/");
  const subtitle = f.source === "created" ? `Dibuat ${tgl} · My Workspace` : `Dokumen tersimpan di My Workspace · diunduh ${tgl}`;
  return { data: await markdownToDocx(f.markdown, { title: f.title, subtitle }), name };
}

async function sendFiles(chatId: number, files: GeneratedFile[]) {
  const stop = keepTyping(chatId, 4000, "upload_document");
  try {
    for (const f of files) {
      try {
        // dokumen unggahan: kirim FILE ASLI (menu Documents di Storage, atau folder _Masuk laptop)
        if (f.originalPath) {
          const fromStorage = !!storagePathOf(f.originalPath);
          const orig = fromStorage ? await withOwner(() => readStorageOriginal(f.originalPath!)) : await readLocalOriginal(f.originalPath);
          if (orig.ok) {
            const r = await sendDocument(chatId, orig.data, orig.name, `${f.title} (file asli)`);
            if (r.ok) continue;
            log("gagal kirim file asli:", r.status, r.error);
          } else if (!f.originalOnly) {
            await replyMarkdown(chatId, `ℹ️ ${orig.reason}. Dikirim versi teksnya.`);
          }
          if (f.originalOnly) {
            const why = orig.ok ? "gagal dikirim Telegram" : orig.reason;
            await replyMarkdown(chatId, `File asli "${f.title}" tidak bisa dikirim (${why}). Buka My Workspace > Personal > Documents.`);
            continue;
          }
        }
        const { data, name } = await fileBuffer(f);
        const r = await sendDocument(chatId, data, name, f.title);
        if (!r.ok) {
          log("gagal kirim file:", r.status, r.error);
          await replyMarkdown(chatId, `Gagal mengirim file ${name}: ${r.error}. Isinya tetap tersimpan sebagai catatan di My Workspace.`);
        }
      } catch (e) {
        log("gagal membuat file:", (e as Error).message);
        await replyMarkdown(chatId, `Gagal membuat file "${f.title}": ${(e as Error).message}`);
      }
    }
  } finally {
    stop();
  }
}

/* ------------------------------ kartu Claude Code ------------------------------ */

async function sendClaudeCards(chatId: number, tasks: ClaudeTaskDraft[], conversationId: string | null) {
  await withOwner(async () => {
    for (const t of tasks) {
      const created = await createDraftJob(t, { conversationId, chatId, source: "telegram" });
      if (!created.ok) {
        await replyMarkdown(
          chatId,
          `🛠 Instruksi Claude Code untuk **${t.project}** sudah disiapkan, tapi tombol Jalankan belum bisa dipakai: ${created.error}\n` +
            "Sementara jalankan dari laptop: My Workspace > AI > percakapan Telegram ini > **Jalankan di Claude Code**."
        );
        continue;
      }
      const r = await sendHtml(chatId, toTelegramHtml(jobCardText(created.job, created.note ? `ℹ️ ${created.note}` : undefined)), {
        replyMarkup: jobButtons(created.job.id),
      });
      if (r.ok && r.result?.message_id) await setJobMessage(created.job.id, Number(r.result.message_id));
      else log("gagal kirim kartu Claude:", r.status, r.error);
    }
  });
}

/* ------------------------------ pesan masuk ------------------------------ */

export async function handleTelegram(msg: TgInbound): Promise<void> {
  if (msg.chatType !== "private") return; // grup/channel tidak dilayani

  const owner = ownerId();
  if (!owner) {
    // mode setup: beri tahu ID agar bisa diisi ke TELEGRAM_OWNER_ID (AI tidak dijalankan)
    await sendPlain(
      msg.chatId,
      `ID Telegram Anda: ${msg.fromId}\nIsi TELEGRAM_OWNER_ID=${msg.fromId} di Vercel (dan .env.local), lalu Redeploy.`
    );
    return;
  }
  if (String(msg.fromId) !== owner) {
    log(`pesan dari pengguna tidak dikenal (${String(msg.fromId).slice(0, 3)}***) diabaikan`);
    return;
  }
  if (!(await firstTime(`tg:${msg.updateId}`))) return;
  if (msg.date && Date.now() / 1000 - msg.date > 15 * 60) {
    log("pesan lebih dari 15 menit diabaikan:", msg.updateId);
    return;
  }

  let content = msg.text;
  if (!content && msg.document) {
    const stop = keepTyping(msg.chatId);
    const f = await fileToMessage(msg).finally(stop);
    if (f.reject) return replyMarkdown(msg.chatId, f.reject);
    if (f.reply) return replyMarkdown(msg.chatId, f.reply);
    content = f.content!;
  }
  if (!content) {
    await replyMarkdown(
      msg.chatId,
      msg.kind === "photo"
        ? "Foto belum bisa dibaca (perlu OCR). Kirim dokumen sebagai PDF berteks atau Word lewat 📎 > File."
        : "Saat ini bot baru bisa membaca teks dan file PDF/Word/Excel/TXT."
    );
    return;
  }
  const cmd = msg.text ? parseTgCommand(msg.text) : null;
  if (cmd === "help") return replyMarkdown(msg.chatId, TG_HELP);

  const stopTyping = keepTyping(msg.chatId);
  let turn: Awaited<ReturnType<typeof runOwnerTurn>> | null = null;
  let errorText: string | null = null;
  try {
    turn = await runOwnerTurn(TELEGRAM_CHANNEL, content, cmd === "new");
  } catch (e) {
    log("error:", (e as Error).message);
    errorText = `Maaf, terjadi kesalahan di My Workspace: ${(e as Error).message}`.slice(0, 500);
  } finally {
    stopTyping();
  }
  if (!turn) return replyMarkdown(msg.chatId, errorText || "Maaf, tidak ada jawaban.");

  await replyMarkdown(msg.chatId, turn.text);
  if (turn.files?.length) await sendFiles(msg.chatId, turn.files);
  if (turn.claudeTasks?.length) {
    try {
      await sendClaudeCards(msg.chatId, turn.claudeTasks, turn.conversationId);
    } catch (e) {
      log("kartu Claude gagal:", (e as Error).message);
    }
  }
}

/* ------------------------------ tombol ------------------------------ */

export async function handleTelegramCallback(cb: TgCallback): Promise<void> {
  if (String(cb.fromId) !== ownerId() || !ownerId()) {
    await answerCallback(cb.callbackId, "Tidak diizinkan");
    return;
  }
  if (!(await firstTime(`tg:${cb.updateId}`))) return;
  const parsed = parseJobCallback(cb.data);
  if (!parsed) {
    await answerCallback(cb.callbackId, "Tombol tidak dikenal");
    return;
  }

  try {
    if (parsed.action === "run") {
      const r = await withOwner(() => queueJob(parsed.jobId));
      if (!r.ok) {
        await answerCallback(cb.callbackId, r.error);
        return;
      }
      await answerCallback(cb.callbackId, r.agentOnline ? "Masuk antrian, agent laptop aktif" : "Masuk antrian");
      const note = r.agentOnline
        ? undefined
        : r.agentLastSeen
          ? `⚠️ Agent laptop tidak aktif (terakhir ${wib(r.agentLastSeen)}). Dijalankan otomatis saat laptop menyala (maks ${QUEUE_TTL_HOURS} jam), Anda akan diberi kabar.`
          : "⚠️ Agent laptop belum pernah terhubung ke antrian. Pastikan agent v1.5.0 berjalan dan token integrasi tersimpan (lihat docs/TELEGRAM.md).";
      if (cb.chatId && cb.messageId)
        await editHtml(cb.chatId, cb.messageId, toTelegramHtml(jobCardText(r.job, note)), {
          inline_keyboard: [[{ text: "✖️ Batal", callback_data: `cq:cancel:${r.job.id}` }]],
        });
      return;
    }
    const r = await withOwner(() => cancelJob(parsed.jobId));
    await answerCallback(cb.callbackId, r.ok ? "Dibatalkan" : r.error);
    if (r.ok && cb.chatId && cb.messageId) await editHtml(cb.chatId, cb.messageId, toTelegramHtml(jobCardText(r.job)));
  } catch (e) {
    log("callback error:", (e as Error).message);
    await answerCallback(cb.callbackId, `Gagal: ${(e as Error).message}`);
  }
}
