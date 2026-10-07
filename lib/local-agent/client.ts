/**
 * Client untuk My Workspace Agent (launcher aplikasi lokal).
 *
 * Dipanggil dari BROWSER (bukan server Vercel): browser di laptop yang
 * menghubungi agent di http://127.0.0.1:4545. Karena itu fitur ini hanya
 * berfungsi saat My Workspace dibuka di laptop yang menjalankan agent.
 *
 * Token & URL agent disimpan di localStorage (per browser), tidak pernah
 * dikirim ke server My Workspace.
 */

export type ProcStatus = "running" | "external" | "starting" | "unresponsive" | "crashed" | "stopped";
export type AppStatus = ProcStatus | "partial";

export interface LocalProcess {
  name: string;
  port: number | null;
  cwd: string;
  command: string;
  status: ProcStatus;
  pid: number | null;
  startedAt: number | null;
  exitCode: number | null;
}

export interface LocalAction {
  id: string;
  label: string;
  confirm: string | null;
  running: boolean;
  exitCode: number | null;
  lastRunAt: number | null;
}

export interface LocalApp {
  id: string;
  name: string;
  group: string;
  description: string;
  url: string | null;
  embeddable: boolean;
  folder?: string; // folder project (tujuan file)
  inbox?: string; // subfolder _Masuk
  status: AppStatus;
  processes: LocalProcess[];
  actions: LocalAction[];
  /** Claude Code (agent >= 1.4.0). mode "read" = terkunci baca saja. */
  claude?: { mode: ClaudeMode; project?: string; running: boolean; lastSessionId: string | null };
}

export type ClaudeMode = "edit" | "read";
export type ClaudeModel = "sonnet" | "opus" | "haiku";
export const CLAUDE_MIN_AGENT_VERSION = "1.4.0";

export interface ClaudeEvent {
  t: number;
  kind: "info" | "text" | "tool" | "error";
  text: string;
  tool?: string;
  file?: string;
}

export interface ClaudeRun {
  runId?: string;
  status: "idle" | "running" | "done" | "error" | "stopped" | "timeout";
  mode?: ClaudeMode;
  model?: string;
  prompt?: string;
  startedAt?: number;
  finishedAt?: number | null;
  eventCount?: number;
  events?: ClaudeEvent[];
  result?: {
    isError: boolean;
    text: string;
    sessionId: string | null;
    costUsd: number | null;
    numTurns: number | null;
    denials: string[];
  } | null;
  summary?: string | null;
  files?: string[];
  activity?: { status: "sending" | "logged" | "failed"; message?: string } | null;
  error?: string | null;
}

export interface ClaudeInfo {
  available: boolean;
  path: string;
  version?: string;
  defaultModel?: string;
  error?: string;
}

export interface LogLine {
  t: number;
  s: "out" | "err" | "agent";
  m: string;
}

export interface AgentSettings {
  url: string;
  token: string;
}

const KEY_URL = "mw.localAgent.url";
const KEY_TOKEN = "mw.localAgent.token";
export const DEFAULT_AGENT_URL = "http://127.0.0.1:4545";
/** Versi agent minimum yang cocok dengan halaman ini (lihat agent/server.cjs VERSION). */
export const MIN_AGENT_VERSION = "1.3.0";
export function isOlderVersion(v: string, min: string) {
  const a = v.split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  return false;
}
/** Link Windows (didaftarkan oleh agent\Daftarkan-Tombol-Web.bat) untuk menyalakan agent. */
export const AGENT_LAUNCH_URL = "mwagent://start";

export function loadAgentSettings(): AgentSettings {
  try {
    return {
      url: localStorage.getItem(KEY_URL) || DEFAULT_AGENT_URL,
      token: localStorage.getItem(KEY_TOKEN) || "",
    };
  } catch {
    return { url: DEFAULT_AGENT_URL, token: "" };
  }
}

export function saveAgentSettings(s: AgentSettings) {
  try {
    localStorage.setItem(KEY_URL, s.url.trim().replace(/\/+$/, "") || DEFAULT_AGENT_URL);
    localStorage.setItem(KEY_TOKEN, s.token.trim());
  } catch {
    /* localStorage tidak tersedia: abaikan */
  }
}

export class AgentError extends Error {
  constructor(
    message: string,
    public kind: "offline" | "unauthorized" | "forbidden" | "server"
  ) {
    super(message);
  }
}

async function call<T>(s: AgentSettings, path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  // Catatan: saat My Workspace dibuka dari domain Vercel, Chrome/Edge akan meminta izin
  // "akses jaringan lokal" satu kali. Agent sudah mengirim header Private Network Access.
  const init: RequestInit = {
    method,
    headers: body === undefined ? { "X-Agent-Token": s.token } : { "X-Agent-Token": s.token, "Content-Type": "application/json" },
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  let res: Response;
  try {
    res = await fetch(`${s.url}${path}`, init);
  } catch {
    throw new AgentError("Agent tidak dapat dihubungi", "offline");
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) throw new AgentError(json.error || "Token salah", "unauthorized");
  if (res.status === 403) throw new AgentError(json.error || "Origin ditolak agent", "forbidden");
  if (!res.ok) throw new AgentError(json.error || `HTTP ${res.status}`, "server");
  return json as T;
}

export const agent = {
  health: (s: AgentSettings) => call<{ ok: boolean; version: string }>(s, "/health"),
  // Normalisasi: agent versi lama belum mengirim field baru (mis. actions)
  list: (s: AgentSettings) =>
    call<{ apps: Partial<LocalApp>[] }>(s, "/apps").then((r) =>
      (r.apps || []).map(
        (x) => ({ ...x, processes: x.processes || [], actions: x.actions || [] }) as LocalApp
      )
    ),
  version: (s: AgentSettings) => call<{ version: string }>(s, "/health").then((r) => r.version),
  start: (s: AgentSettings, id: string) => call(s, `/apps/${id}/start`, "POST"),
  stop: (s: AgentSettings, id: string) => call(s, `/apps/${id}/stop`, "POST"),
  restart: (s: AgentSettings, id: string) => call(s, `/apps/${id}/restart`, "POST"),
  openFolder: (s: AgentSettings, id: string) => call(s, `/apps/${id}/open-folder`, "POST"),
  runAction: (s: AgentSettings, id: string, actionId: string) =>
    call<{ ok: boolean; pid?: number; skipped?: string }>(s, `/apps/${id}/actions/${actionId}`, "POST"),
  reloadConfig: (s: AgentSettings) => call<{ count: number }>(s, "/reload-config", "POST"),
  stopAgent: (s: AgentSettings) => call(s, "/agent/stop", "POST"),
  openInbox: (s: AgentSettings, id: string) => call(s, `/apps/${id}/open-inbox`, "POST"),
  listFiles: (s: AgentSettings, id: string) =>
    call<{ inbox: string; files: InboxFile[] }>(s, `/apps/${id}/files`),
  uploadFile,
  // Claude Code (agent >= 1.4.0)
  claudeInfo: (s: AgentSettings, refresh = false) => call<ClaudeInfo>(s, `/claude${refresh ? "?refresh=1" : ""}`),
  claudeRun: (
    s: AgentSettings,
    id: string,
    req: { prompt: string; mode: ClaudeMode; model?: ClaudeModel; resume?: string | null }
  ) => call<{ ok: boolean; runId: string }>(s, `/apps/${id}/claude`, "POST", req),
  claudeStatus: (s: AgentSettings, id: string, since = 0) => call<ClaudeRun>(s, `/apps/${id}/claude?since=${since}`),
  claudeStop: (s: AgentSettings, id: string) => call<{ ok: boolean }>(s, `/apps/${id}/claude/stop`, "POST"),
  logs: (s: AgentSettings, id: string) =>
    call<{ processes: { name: string; lines: LogLine[] }[] }>(s, `/apps/${id}/logs`).then((r) => r.processes),
};

export interface InboxFile {
  name: string;
  bytes: number;
  modifiedAt: number;
}

export interface UploadResult {
  app: string;
  savedAs: string;
  path: string;
  bytes: number;
}

/**
 * Kirim file langsung dari browser ke agent (tidak lewat Vercel/AI), masuk ke <folder project>\_Masuk.
 * Pakai XMLHttpRequest agar progres upload bisa ditampilkan.
 */
function uploadFile(
  s: AgentSettings,
  appId: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${s.url}/apps/${appId}/files?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("X-Agent-Token", s.token);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new AgentError("Agent tidak dapat dihubungi", "offline"));
    xhr.onload = () => {
      let body: any = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* abaikan */
      }
      if (xhr.status === 401) return reject(new AgentError(body.error || "Token salah", "unauthorized"));
      if (xhr.status === 403) return reject(new AgentError(body.error || "Origin ditolak agent", "forbidden"));
      if (xhr.status < 200 || xhr.status >= 300) return reject(new AgentError(body.error || `HTTP ${xhr.status}`, "server"));
      resolve(body as UploadResult);
    };
    xhr.send(file);
  });
}

/** Format ukuran byte menjadi teks yang mudah dibaca (B, KB, MB). */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Tebak project tujuan dari teks pesan (mis. "simpan ke Rally District"). */
export function guessTargetApp(text: string, apps: Pick<LocalApp, "id" | "name">[]): string | null {
  const t = text.toLowerCase();
  const hits = apps.filter((a) => {
    const name = a.name.toLowerCase();
    const short = name.split(/[\s(/]/)[0];
    return t.includes(name) || t.includes(a.id.replace(/-/g, " ")) || t.includes(a.id) || (short.length >= 5 && t.includes(short));
  });
  return hits.length === 1 ? hits[0].id : null;
}

export const STATUS_META: Record<AppStatus, { label: string; dot: string; text: string }> = {
  running: { label: "Berjalan", dot: "bg-ok", text: "text-ok" },
  external: { label: "Berjalan (di luar agent)", dot: "bg-ok", text: "text-ok" },
  starting: { label: "Menyalakan...", dot: "bg-orange animate-pulse", text: "text-orange" },
  partial: { label: "Sebagian berjalan", dot: "bg-orange", text: "text-orange" },
  unresponsive: { label: "Tidak merespons, cek Log", dot: "bg-red animate-pulse", text: "text-red" },
  crashed: { label: "Error / berhenti", dot: "bg-red", text: "text-red" },
  stopped: { label: "Mati", dot: "bg-mute/50", text: "text-mute" },
};
