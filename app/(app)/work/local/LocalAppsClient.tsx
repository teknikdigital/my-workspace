"use client";

/**
 * Halaman "Lokal": daftar aplikasi di laptop yang dijalankan lewat My Workspace Agent.
 * Semua request ke agent dilakukan dari browser (lihat lib/local-agent/client.ts).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MonitorPlay,
  Play,
  Square,
  RotateCw,
  ExternalLink,
  Eye,
  FolderOpen,
  ScrollText,
  Settings2,
  WifiOff,
  KeyRound,
  Loader2,
  X,
  RefreshCw,
  ShieldAlert,
  Wrench,
  Power,
  CheckCircle2,
  XCircle,
  Upload,
  Inbox,
  Bot,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ClaudeRunPanel } from "@/components/local/ClaudeRunPanel";
import { cn } from "@/lib/utils";
import {
  agent,
  AgentError,
  AGENT_LAUNCH_URL,
  MIN_AGENT_VERSION,
  formatBytes,
  isOlderVersion,
  DEFAULT_AGENT_URL,
  loadAgentSettings,
  saveAgentSettings,
  STATUS_META,
  type AgentSettings,
  type LocalApp,
  type LogLine,
} from "@/lib/local-agent/client";

type Conn = "checking" | "ok" | "offline" | "unauthorized" | "forbidden";
const POLL_MS = 4000;

export function LocalAppsClient() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [conn, setConn] = useState<Conn>("checking");
  const [connMsg, setConnMsg] = useState("");
  const [apps, setApps] = useState<LocalApp[]>([]);
  const [busy, setBusy] = useState<Record<string, string>>({}); // appId -> aksi berjalan
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [preview, setPreview] = useState<LocalApp | null>(null);
  const [logApp, setLogApp] = useState<LocalApp | null>(null);
  const [claudeApp, setClaudeApp] = useState<LocalApp | null>(null);
  const [agentVersion, setAgentVersion] = useState<string | null>(null);

  // Muat pengaturan dari localStorage (hanya di browser)
  useEffect(() => {
    const s = loadAgentSettings();
    setSettings(s);
    if (!s.token) setShowSettings(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!settings) return;
    try {
      const list = await agent.list(settings);
      setApps(list);
      setConn("ok");
      setConnMsg("");
      agent.version(settings).then(setAgentVersion).catch(() => setAgentVersion(null));
    } catch (e) {
      const err = e as AgentError;
      setConn(err.kind === "server" ? "offline" : err.kind);
      setConnMsg(err.message);
    }
  }, [settings]);

  // Polling status selama tab terlihat
  useEffect(() => {
    if (!settings) return;
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [settings, refresh]);

  const doAction = async (app: LocalApp, action: CardAction) => {
    if (!settings) return;
    // Mencegah mematikan My Workspace yang sedang dipakai membuka halaman ini
    if ((action === "stop" || action === "restart") && app.url && sameOrigin(app.url)) {
      if (!confirm(`"${app.name}" adalah aplikasi yang sedang Anda buka. Tetap ${action === "stop" ? "matikan" : "restart"}?`))
        return;
    }
    setActionError(null);
    setBusy((b) => ({ ...b, [app.id]: action }));
    try {
      await agent[action](settings, app.id);
      await refresh();
    } catch (e) {
      setActionError(`${app.name}: ${(e as Error).message}`);
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[app.id];
        return n;
      });
    }
  };

  const runAction = async (app: LocalApp, actionId: string) => {
    if (!settings) return;
    const a = app.actions.find((x) => x.id === actionId);
    if (a?.confirm && !confirm(a.confirm)) return;
    setActionError(null);
    try {
      const r = await agent.runAction(settings, app.id, actionId);
      if (r.skipped) setActionError(`${app.name}: ${a?.label} ${r.skipped}`);
      setLogApp(app); // tampilkan output langsung
      await refresh();
    } catch (e) {
      setActionError(`${app.name}: ${(e as Error).message}`);
    }
  };

  // Kirim file langsung ke <folder project>\_Masuk lewat agent
  const sendFiles = async (app: LocalApp, list: File[]) => {
    if (!settings || !list.length) return;
    setActionError(null);
    setNotice(null);
    setBusy((b) => ({ ...b, [app.id]: "upload" }));
    const ok: string[] = [];
    const failed: string[] = [];
    for (const f of list) {
      try {
        const r = await agent.uploadFile(settings, app.id, f);
        ok.push(`${r.savedAs} (${formatBytes(r.bytes)})`);
      } catch (e) {
        failed.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setBusy((b) => {
      const n = { ...b };
      delete n[app.id];
      return n;
    });
    if (ok.length) setNotice(`${app.name}: ${ok.length} file masuk ke ${app.inbox || "_Masuk"} → ${ok.join(", ")}`);
    if (failed.length) setActionError(`${app.name}: gagal ${failed.join("; ")}`);
  };

  const groups = useMemo(() => {
    const m = new Map<string, LocalApp[]>();
    for (const a of apps) m.set(a.group, [...(m.get(a.group) || []), a]);
    return Array.from(m.entries());
  }, [apps]);

  const runningCount = apps.filter((a) => a.status === "running" || a.status === "external").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Aplikasi Lokal</h1>
          <p className="text-xs sm:text-sm text-mute">
            Jalankan dan buka aplikasi di laptop (localhost) langsung dari My Workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnBadge conn={conn} running={runningCount} total={apps.length} />
          <button
            type="button"
            onClick={() => refresh()}
            title="Muat ulang status"
            className="rounded-btn border border-line bg-glass p-2.5 text-mute hover:text-ink transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-2 rounded-btn border border-line bg-glass px-3.5 py-2.5 text-xs font-bold text-ink hover:border-teal/40 transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            <span>Pengaturan Agent</span>
          </button>
        </div>
      </div>

      {conn === "ok" && agentVersion && isOlderVersion(agentVersion, MIN_AGENT_VERSION) && (
        <div className="rounded-btn border border-orange/40 bg-orange/10 px-4 py-3 text-xs text-ink">
          Agent yang berjalan masih versi <b>{agentVersion}</b> (butuh {MIN_AGENT_VERSION}). Beberapa tombol belum
          tersedia. Jalankan <b>Hentikan-Agent.bat</b> lalu <b>Jalankan-Agent.bat</b> di folder agent.
        </div>
      )}

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-btn border border-ok/30 bg-ok/10 px-4 py-3 text-xs text-ok">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-btn border border-red/30 bg-red/10 px-4 py-3 text-xs text-red">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Isi */}
      {conn === "checking" && (
        <div className="flex items-center gap-2 text-sm text-mute">
          <Loader2 className="h-4 w-4 animate-spin" /> Menghubungi agent...
        </div>
      )}

      {conn !== "ok" && conn !== "checking" && (
        <AgentHelp conn={conn} message={connMsg} onOpenSettings={() => setShowSettings(true)} />
      )}

      {conn === "ok" &&
        groups.map(([group, list]) => (
          <section key={group} className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-mute">{group}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {list.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  busy={busy[app.id]}
                  onAction={(a) => doAction(app, a)}
                  onRunAction={(id) => runAction(app, id)}
                  onSendFiles={(list) => sendFiles(app, list)}
                  onPreview={() => setPreview(app)}
                  onLogs={() => setLogApp(app)}
                  onClaude={() => setClaudeApp(app)}
                />
              ))}
            </div>
          </section>
        ))}

      {conn === "ok" && apps.length === 0 && (
        <p className="text-sm text-mute">Belum ada aplikasi di apps.json agent.</p>
      )}

      {/* Modal & panel */}
      {settings && (
        <SettingsModal
          isOpen={showSettings}
          initial={settings}
          connected={conn === "ok"}
          onClose={() => setShowSettings(false)}
          onAgentStopped={() => {
            setShowSettings(false);
            setConn("offline");
            setApps([]);
          }}
          onSave={(s) => {
            saveAgentSettings(s);
            setSettings(loadAgentSettings());
            setConn("checking");
            setShowSettings(false);
          }}
        />
      )}
      {settings && logApp && <LogsModal app={logApp} settings={settings} onClose={() => setLogApp(null)} />}
      {claudeApp && (
        <Modal isOpen size="xl" onClose={() => setClaudeApp(null)} title={`Claude Code: ${claudeApp.name}`}>
          <ClaudeRunPanel apps={apps} appId={claudeApp.id} lockApp onFinished={() => refresh()} />
        </Modal>
      )}
      {preview && <PreviewPanel app={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function sameOrigin(url: string) {
  try {
    const u = new URL(url);
    const here = window.location;
    const norm = (h: string) => (h === "127.0.0.1" ? "localhost" : h);
    return norm(u.hostname) === norm(here.hostname) && u.port === here.port;
  } catch {
    return false;
  }
}

function ConnBadge({ conn, running, total }: { conn: Conn; running: number; total: number }) {
  if (conn === "ok")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-3 py-1.5 text-[11px] font-semibold text-ok">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Agent aktif · {running}/{total} jalan
      </span>
    );
  if (conn === "checking") return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red/30 bg-red/10 px-3 py-1.5 text-[11px] font-semibold text-red">
      <WifiOff className="h-3 w-3" /> Agent tidak terhubung
    </span>
  );
}

function AgentHelp({ conn, message, onOpenSettings }: { conn: Conn; message: string; onOpenSettings: () => void }) {
  const isLocalhost =
    typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return (
    <div className="rounded-panel border border-line bg-glass p-6 shadow-soft space-y-4">
      {conn === "offline" && (
        <>
          <div className="flex items-center gap-2 text-ink font-bold">
            <WifiOff className="h-5 w-5 text-red" /> Agent belum berjalan di laptop ini
          </div>
          <a
            href={AGENT_LAUNCH_URL}
            className="inline-flex items-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
          >
            <Power className="h-4 w-4" /> Nyalakan Agent
          </a>
          <p className="text-xs text-mute">
            Tombol ini butuh <b className="text-ink">Daftarkan-Tombol-Web.bat</b> dijalankan sekali. Saat diklik pertama
            kali, browser akan meminta izin membuka aplikasi: pilih Izinkan. Status di halaman ini akan pulih otomatis
            dalam beberapa detik.
          </p>
          <p className="text-xs font-semibold text-ink pt-1">Atau secara manual:</p>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-mute">
            <li>
              Buka folder <code className="text-ink">D:\Project\myworkspace\agent</code>.
            </li>
            <li>
              Double-click <b className="text-ink">Jalankan-Agent.bat</b>.
            </li>
            <li>Token otomatis tersalin. Klik Pengaturan Agent lalu tempel token.</li>
            <li>
              Agar selalu aktif saat Windows menyala, jalankan sekali <b className="text-ink">Pasang-AutoStart.bat</b>.
            </li>
          </ol>
          {!isLocalhost && (
            <p className="text-xs text-mute">
              Jika Anda membuka dari HP atau laptop lain, fitur ini memang tidak tersedia: aplikasi lokal hanya bisa
              dibuka dari laptop yang menjalankan agent. Di Chrome/Edge, izinkan juga permintaan &quot;akses jaringan
              lokal&quot; bila muncul.
            </p>
          )}
        </>
      )}
      {conn === "unauthorized" && (
        <div className="flex items-center gap-2 text-ink font-bold">
          <KeyRound className="h-5 w-5 text-orange" /> Token agent belum diisi atau salah
        </div>
      )}
      {conn === "forbidden" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-ink font-bold">
            <ShieldAlert className="h-5 w-5 text-red" /> Agent menolak alamat halaman ini
          </div>
          <p className="text-sm text-mute">
            Tambahkan <code className="text-ink">{typeof window !== "undefined" ? window.location.origin : ""}</code> ke
            daftar <code className="text-ink">allowedOrigins</code> di <code className="text-ink">agent\apps.json</code>,
            lalu restart agent (Hentikan-Agent.bat, kemudian Jalankan-Agent.bat).
          </p>
        </div>
      )}
      {message && <p className="text-xs text-mute">Detail: {message}</p>}
      <button
        type="button"
        onClick={onOpenSettings}
        className="inline-flex items-center gap-2 rounded-btn bg-teal px-4 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
      >
        <Settings2 className="h-4 w-4" /> Pengaturan Agent
      </button>
    </div>
  );
}

type CardAction = "start" | "stop" | "restart" | "openFolder" | "openInbox";

function AppCard({
  app,
  busy,
  onAction,
  onRunAction,
  onSendFiles,
  onPreview,
  onLogs,
  onClaude,
}: {
  app: LocalApp;
  busy?: string;
  onAction: (a: CardAction) => void;
  onRunAction: (actionId: string) => void;
  onSendFiles: (files: File[]) => void;
  onPreview: () => void;
  onLogs: () => void;
  onClaude: () => void;
}) {
  const meta = STATUS_META[app.status];
  const isUp = app.status === "running" || app.status === "external";
  const isDown = app.status === "stopped" || app.status === "crashed";
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onSendFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex flex-col justify-between gap-4 rounded-panel border bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-teal/40 transition-all",
        dragOver ? "border-teal border-dashed" : "border-line"
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <MonitorPlay className="h-5 w-5 shrink-0 text-teal" />
            <h3 className="font-bold text-ink truncate">{app.name}</h3>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap", meta.text)}>
            <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        </div>
        {app.description && <p className="text-xs text-mute">{app.description}</p>}
        <div className="flex flex-wrap gap-1.5">
          {app.processes.map((p) => (
            <span
              key={p.name}
              title={`${p.command}\n${p.cwd}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-mute"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[p.status].dot)} />
              {p.name}
              {p.port ? ` :${p.port}` : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isDown || app.status === "partial" ? (
          <ActionBtn primary icon={Play} label="Start" loading={busy === "start"} onClick={() => onAction("start")} />
        ) : (
          <ActionBtn icon={Square} label="Stop" loading={busy === "stop"} onClick={() => onAction("stop")} />
        )}
        <ActionBtn icon={RotateCw} label="Restart" loading={busy === "restart"} onClick={() => onAction("restart")} />
        {app.url && (
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            title={isUp ? "Buka di tab baru" : "Aplikasi belum siap, tetap bisa dicoba dibuka"}
            className={cn(btnBase, isUp ? btnPrimary : btnGhost)}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Buka
          </a>
        )}
        {app.url && app.embeddable && (
          <ActionBtn icon={Eye} label="Preview" disabled={isDown} onClick={onPreview} />
        )}
        <ActionBtn icon={ScrollText} label="Log" onClick={onLogs} />
        <ActionBtn icon={FolderOpen} label="Folder" loading={busy === "openFolder"} onClick={() => onAction("openFolder")} />
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            onSendFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
        <ActionBtn icon={Upload} label="Kirim File" loading={busy === "upload"} onClick={() => fileRef.current?.click()} />
        <ActionBtn icon={Inbox} label="_Masuk" loading={busy === "openInbox"} onClick={() => onAction("openInbox")} />
        {app.claude && (
          <ActionBtn
            icon={app.claude.running ? Loader2 : Bot}
            label={app.claude.running ? "Claude bekerja..." : "Claude"}
            primary={app.claude.running}
            onClick={onClaude}
          />
        )}
      </div>

      {app.actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {app.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onRunAction(a.id)}
              disabled={a.running}
              title={a.lastRunAt ? `Terakhir: ${new Date(a.lastRunAt).toLocaleString("id-ID")}` : "Belum pernah dijalankan"}
              className={cn(btnBase, "border border-dashed border-line text-mute hover:text-ink hover:border-teal/40")}
            >
              {a.running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : a.exitCode === 0 ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
              ) : a.exitCode !== null ? (
                <XCircle className="h-3.5 w-3.5 text-red" />
              ) : (
                <Wrench className="h-3.5 w-3.5" />
              )}
              {a.running ? `${a.label}...` : a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const btnBase =
  "inline-flex items-center gap-1.5 rounded-btn px-3 py-2 text-[11px] font-bold transition-all disabled:opacity-50 disabled:pointer-events-none";
const btnPrimary = "bg-teal text-white shadow-soft hover:bg-teal-dark";
const btnGhost = "border border-line text-ink hover:border-teal/40";

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  loading,
  disabled,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(btnBase, primary ? btnPrimary : btnGhost)}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function SettingsModal({
  isOpen,
  initial,
  connected,
  onClose,
  onSave,
  onAgentStopped,
}: {
  isOpen: boolean;
  initial: AgentSettings;
  connected: boolean;
  onClose: () => void;
  onSave: (s: AgentSettings) => void;
  onAgentStopped: () => void;
}) {
  const [url, setUrl] = useState(initial.url);
  const [token, setToken] = useState(initial.token);
  const [test, setTest] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(initial.url);
      setToken(initial.token);
      setTest(null);
    }
  }, [isOpen, initial]);

  const runTest = async () => {
    setTest("Menguji...");
    const s = { url: url.trim().replace(/\/+$/, ""), token: token.trim() };
    try {
      await agent.list(s);
      setTest("✓ Terhubung dan token benar");
    } catch (e) {
      setTest(`✗ ${(e as Error).message}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pengaturan Agent">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ url, token });
        }}
      >
        <p className="text-xs text-mute">
          Token ada di <code className="text-ink">agent\.agent-token</code> (otomatis tersalin saat menjalankan
          Jalankan-Agent.bat atau Lihat-Token.bat). Disimpan hanya di browser ini.
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-ink">Token agent</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Tempel token di sini"
            autoComplete="off"
            className="w-full rounded-btn border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-ink">Alamat agent</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={DEFAULT_AGENT_URL}
            className="w-full rounded-btn border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
          />
        </label>
        {test && <p className="text-xs text-mute">{test}</p>}
        {connected && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button
              type="button"
              className={cn(btnBase, btnGhost)}
              onClick={async () => {
                try {
                  const r = await agent.reloadConfig(initial);
                  setTest(`✓ apps.json dimuat ulang (${r.count} aplikasi)`);
                } catch (e) {
                  setTest(`✗ ${(e as Error).message}`);
                }
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Muat ulang apps.json
            </button>
            <button
              type="button"
              className={cn(btnBase, "border border-red/40 text-red hover:bg-red/10")}
              onClick={async () => {
                if (!confirm("Hentikan agent? Semua aplikasi yang dinyalakan lewat agent ikut berhenti.")) return;
                try {
                  await agent.stopAgent(initial);
                } catch {
                  /* agent sudah mati */
                }
                onAgentStopped();
              }}
            >
              <Power className="h-3.5 w-3.5" /> Hentikan Agent
            </button>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={runTest} className={cn(btnBase, btnGhost)}>
            Uji Koneksi
          </button>
          <button type="submit" className={cn(btnBase, btnPrimary)}>
            Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LogsModal({ app, settings, onClose }: { app: LocalApp; settings: AgentSettings; onClose: () => void }) {
  const [procs, setProcs] = useState<{ name: string; lines: LogLine[] }[]>([]);
  const [tab, setTab] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const p = await agent.logs(settings, app.id);
        if (alive) {
          setProcs(p);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [app.id, settings]);

  const lines = procs[tab]?.lines || [];
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <Modal isOpen onClose={onClose} title={`Log: ${app.name}`}>
      <div className="space-y-3">
        {procs.length > 1 && (
          <div className="flex gap-1">
            {procs.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setTab(i)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold",
                  i === tab ? "bg-teal text-white" : "text-mute hover:text-ink"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        {err && <p className="text-xs text-red">{err}</p>}
        <pre
          ref={boxRef}
          className="h-80 overflow-auto rounded-btn border border-line bg-black/80 p-3 text-[11px] leading-relaxed text-gray-100 whitespace-pre-wrap break-all"
        >
          {lines.length === 0
            ? "Belum ada log. Log hanya tersedia untuk aplikasi yang dinyalakan lewat agent."
            : lines.map((l, i) => (
                <div key={i} className={l.s === "err" ? "text-red-300" : l.s === "agent" ? "text-teal-300" : ""}>
                  <span className="text-gray-500">{new Date(l.t).toLocaleTimeString("id-ID")} </span>
                  {l.m}
                </div>
              ))}
        </pre>
      </div>
    </Modal>
  );
}

function PreviewPanel({ app, onClose }: { app: LocalApp; onClose: () => void }) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-3 sm:p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex flex-1 flex-col overflow-hidden rounded-panel border border-line bg-card shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <MonitorPlay className="h-4 w-4 text-teal shrink-0" />
            <span className="font-bold text-sm text-ink truncate">{app.name}</span>
            <code className="text-[11px] text-mute truncate">{app.url}</code>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setKey((k) => k + 1)} title="Muat ulang" className="rounded-full p-2 text-mute hover:text-ink">
              <RotateCw className="h-4 w-4" />
            </button>
            <a
              href={app.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka di tab baru"
              className="rounded-full p-2 text-mute hover:text-ink"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button onClick={onClose} title="Tutup" className="rounded-full p-2 text-mute hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <iframe key={key} src={app.url || "about:blank"} title={app.name} className="flex-1 w-full bg-white" />
      </div>
    </div>
  );
}
