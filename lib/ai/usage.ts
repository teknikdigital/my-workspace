/**
 * Pencatat & pembatas biaya AI.
 *
 * - Setiap respons OpenAI/Claude membawa jumlah token (usage). Dicatat ke tabel ai_usage.
 * - Batas harian dalam Rupiah: env AI_DAILY_BUDGET_IDR (default 5000). Bila tercapai, chat AI dikunci
 *   sampai pergantian hari (WIB). Fitur lain My Workspace tetap berjalan.
 * - Harga per 1 juta token bisa diubah lewat env bila tarif penyedia berubah.
 *
 * Tabel: supabase/migrations/20261006000001_ai_usage.sql
 */

import { createClient } from "@/lib/supabase/server";

export interface TokenUsage {
  input: number; // termasuk cached
  cached: number;
  output: number;
}

// Harga USD per 1 juta token (input, cached input, output). Sumber: halaman harga penyedia, Okt 2026.
const PRICES: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, cached: 0.075, output: 0.6 },
  "gpt-4o": { input: 2.5, cached: 1.25, output: 10 },
  "gpt-4.1-mini": { input: 0.4, cached: 0.1, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, cached: 0.025, output: 0.4 },
  "claude-haiku-4-5": { input: 1, cached: 0.1, output: 5 },
  "claude-sonnet": { input: 3, cached: 0.3, output: 15 },
};

export function priceFor(model: string) {
  const envIn = Number(process.env.AI_PRICE_INPUT_PER_M);
  const envOut = Number(process.env.AI_PRICE_OUTPUT_PER_M);
  if (envIn > 0 && envOut > 0) return { input: envIn, cached: envIn / 2, output: envOut };
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.toLowerCase().startsWith(k) || model.toLowerCase().includes(k));
  return PRICES[key || "gpt-4o-mini"];
}

export function costUsd(model: string, u: TokenUsage): number {
  const p = priceFor(model);
  const uncached = Math.max(0, u.input - u.cached);
  return (uncached * p.input + u.cached * p.cached + u.output * p.output) / 1_000_000;
}

export const USD_IDR = () => Number(process.env.AI_USD_IDR) || 16500;
export const DAILY_BUDGET_IDR = () => Number(process.env.AI_DAILY_BUDGET_IDR) || 5000;

export function toIdr(usd: number) {
  return Math.round(usd * USD_IDR());
}

/** Awal hari ini dalam zona WIB (UTC+7), sebagai ISO string UTC. */
export function startOfTodayWib(now = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  const startWibAsUtc = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600 * 1000;
  return new Date(startWibAsUtc).toISOString();
}

export interface UsageSummary {
  tracking: boolean; // false bila tabel ai_usage belum dibuat
  todayIdr: number;
  todayTokens: number;
  budgetIdr: number;
  exceeded: boolean;
}

export async function getTodayUsage(): Promise<UsageSummary> {
  const budgetIdr = DAILY_BUDGET_IDR();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_usage")
      .select("input_tokens, output_tokens, cost_usd")
      .gte("created_at", startOfTodayWib());
    if (error) return { tracking: false, todayIdr: 0, todayTokens: 0, budgetIdr, exceeded: false };
    const usd = (data || []).reduce((s, r: any) => s + Number(r.cost_usd || 0), 0);
    const tokens = (data || []).reduce((s, r: any) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
    const todayIdr = toIdr(usd);
    return { tracking: true, todayIdr, todayTokens: tokens, budgetIdr, exceeded: todayIdr >= budgetIdr };
  } catch {
    return { tracking: false, todayIdr: 0, todayTokens: 0, budgetIdr, exceeded: false };
  }
}

export async function recordUsage(provider: string, model: string, u: TokenUsage) {
  if (!u.input && !u.output) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("ai_usage").insert({
      user_id: user.id,
      provider,
      model,
      input_tokens: u.input,
      cached_tokens: u.cached,
      output_tokens: u.output,
      cost_usd: costUsd(model, u),
    });
  } catch {
    /* pencatatan bersifat best-effort, chat tetap jalan */
  }
}
