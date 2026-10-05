"use client";

import React, { useState, useCallback } from "react";
import {
  Settings,
  Plug,
  Key,
  Github,
  Cloud,
  Database,
  Globe,
  Bot,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Power,
  PowerOff,
  Eye,
  EyeOff,
  Shield,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Integration, IntegrationToken } from "@/types/integrations";
import {
  upsertIntegration,
  toggleIntegration,
  deleteIntegration,
  createIntegrationToken,
  deleteIntegrationToken,
} from "@/lib/actions/integrations";

type SettingsTab = "integrations" | "tokens";

const PROVIDER_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string; description: string }
> = {
  github: {
    label: "GitHub",
    icon: Github,
    color: "#24292f",
    description: "Sinkronisasi repository dan metadata commit.",
  },
  vercel: {
    label: "Vercel",
    icon: Cloud,
    color: "#000000",
    description: "Pantau deployment dan domain project.",
  },
  supabase: {
    label: "Supabase",
    icon: Database,
    color: "#3ecf8e",
    description: "Hubungkan ke database dan auth project.",
  },
  google: {
    label: "Google",
    icon: Globe,
    color: "#4285f4",
    description: "Akses Google Sheets, Drive, dan Apps Script.",
  },
  claude: {
    label: "Claude",
    icon: Bot,
    color: "#d97706",
    description: "Terima structured activity dari Claude AI.",
  },
};

interface SettingsClientProps {
  initialIntegrations: Integration[];
  initialTokens: IntegrationToken[];
}

export default function SettingsClient({
  initialIntegrations,
  initialTokens,
}: SettingsClientProps) {
  const [tab, setTab] = useState<SettingsTab>("integrations");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-3 text-[28px] font-extrabold tracking-tight text-ink">
          <Settings className="h-7 w-7 text-teal" />
          Pengaturan Integrasi
        </h1>
        <p className="mt-1 text-sm text-mute">
          Kelola koneksi layanan eksternal dan token autentikasi webhook.
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 rounded-full border border-line bg-glass p-1.5 backdrop-blur-md shadow-soft w-fit">
        {(
          [
            { key: "integrations", label: "Integrasi", icon: Plug },
            { key: "tokens", label: "Token API", icon: Key },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            id={`settings-tab-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 select-none",
              tab === key
                ? "bg-teal text-white shadow-soft"
                : "text-mute hover:bg-card/70 hover:text-ink"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "integrations" ? (
        <IntegrationsPanel initialIntegrations={initialIntegrations} />
      ) : (
        <TokensPanel initialTokens={initialTokens} />
      )}
    </div>
  );
}

// ==============================================================================
// INTEGRATIONS PANEL
// ==============================================================================

function IntegrationsPanel({
  initialIntegrations,
}: {
  initialIntegrations: Integration[];
}) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [loading, setLoading] = useState<string | null>(null);
  const [configModal, setConfigModal] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allProviders = ["github", "vercel", "supabase", "google", "claude"];

  const handleToggle = useCallback(
    async (integration: Integration) => {
      setLoading(integration.id);
      setError(null);
      const result = await toggleIntegration(integration.id, !integration.is_enabled);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setIntegrations((prev) =>
          prev.map((i) => (i.id === integration.id ? result.data! : i))
        );
      }
      setLoading(null);
    },
    []
  );

  const handleConnect = useCallback(
    async (provider: string) => {
      if (!configValue.trim()) {
        setError("Masukkan API key atau token.");
        return;
      }
      setLoading(provider);
      setError(null);
      const result = await upsertIntegration({
        provider,
        is_enabled: true,
        config_value: configValue.trim(),
      });
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setIntegrations((prev) => {
          const exists = prev.find((i) => i.provider === provider);
          if (exists) return prev.map((i) => (i.provider === provider ? result.data! : i));
          return [...prev, result.data!];
        });
        setConfigModal(null);
        setConfigValue("");
        setShowConfig(false);
      }
      setLoading(null);
    },
    [configValue]
  );

  const handleDisconnect = useCallback(
    async (integration: Integration) => {
      setLoading(integration.id);
      setError(null);
      const result = await deleteIntegration(integration.id);
      if (result.error) {
        setError(result.error);
      } else {
        setIntegrations((prev) => prev.filter((i) => i.id !== integration.id));
      }
      setLoading(null);
    },
    []
  );

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="flex items-center gap-2 rounded-2xl border border-red/20 bg-red/5 px-4 py-3 text-sm text-red"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allProviders.map((provider) => {
          const meta = PROVIDER_META[provider];
          const integration = integrations.find((i) => i.provider === provider);
          const isConnected = integration?.is_enabled;
          const isLoading = loading === provider || loading === integration?.id;
          const Icon = meta.icon;

          return (
            <div
              key={provider}
              id={`integration-card-${provider}`}
              className={cn(
                "relative overflow-hidden rounded-3xl border p-5 transition-all duration-300",
                isConnected
                  ? "border-ok/30 bg-ok/5 shadow-soft"
                  : "border-line bg-card hover:shadow-soft"
              )}
            >
              {/* Status indicator */}
              <div className="absolute right-4 top-4">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-colors",
                    isConnected ? "bg-ok animate-pulse" : "bg-mute/40"
                  )}
                />
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${meta.color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-ink">{meta.label}</h3>
                  <p className="mt-0.5 text-xs text-mute leading-relaxed">
                    {meta.description}
                  </p>
                </div>
              </div>

              {/* Status badge */}
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    isConnected
                      ? "bg-ok/10 text-ok"
                      : "bg-mute/10 text-mute"
                  )}
                >
                  {isConnected ? (
                    <>
                      <Power className="h-2.5 w-2.5" /> Terhubung
                    </>
                  ) : (
                    <>
                      <PowerOff className="h-2.5 w-2.5" /> Tidak Aktif
                    </>
                  )}
                </span>
                {integration?.last_synced_at && (
                  <span className="text-[10px] text-mute">
                    Sinkron: {new Date(integration.last_synced_at).toLocaleDateString("id-ID")}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                {integration ? (
                  <>
                    <button
                      onClick={() => handleToggle(integration)}
                      disabled={isLoading}
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200",
                        isConnected
                          ? "bg-mute/10 text-mute hover:bg-mute/20"
                          : "bg-teal text-white hover:bg-teal-2"
                      )}
                    >
                      {isLoading ? "..." : isConnected ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => handleDisconnect(integration)}
                      disabled={isLoading}
                      className="rounded-xl p-2 text-red/60 hover:bg-red/10 hover:text-red transition-colors"
                      title="Hapus integrasi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setConfigModal(provider);
                      setConfigValue("");
                      setShowConfig(false);
                      setError(null);
                    }}
                    className="flex-1 rounded-xl bg-teal px-3 py-2 text-xs font-semibold text-white transition-all duration-200 hover:bg-teal-2"
                  >
                    Hubungkan
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Config modal */}
      {configModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setConfigModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-card border border-line p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${PROVIDER_META[configModal].color}15` }}
              >
                {React.createElement(PROVIDER_META[configModal].icon, {
                  className: "h-5 w-5",
                  style: { color: PROVIDER_META[configModal].color },
                })}
              </div>
              <div>
                <h3 className="font-bold text-ink">
                  Hubungkan {PROVIDER_META[configModal].label}
                </h3>
                <p className="text-xs text-mute">
                  Masukkan API key atau token untuk mengaktifkan integrasi.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-1/50 px-3 py-2 text-xs text-mute">
                <Shield className="h-3.5 w-3.5 text-teal" />
                Token dienkripsi AES-256-GCM sebelum disimpan.
              </div>

              <div className="relative">
                <input
                  type={showConfig ? "text" : "password"}
                  value={configValue}
                  onChange={(e) => setConfigValue(e.target.value)}
                  placeholder="Masukkan API key / token..."
                  className="w-full rounded-xl border border-line bg-bg-1 px-4 py-3 pr-10 text-sm text-ink placeholder:text-mute/50 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
                >
                  {showConfig ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setConfigModal(null)}
                  className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-mute hover:bg-card/80 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleConnect(configModal)}
                  disabled={!configValue.trim() || loading === configModal}
                  className="flex-1 rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-2 transition-colors disabled:opacity-50"
                >
                  {loading === configModal ? "Menyimpan..." : "Simpan & Aktifkan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// TOKENS PANEL
// ==============================================================================

function TokensPanel({
  initialTokens,
}: {
  initialTokens: IntegrationToken[];
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!newTokenName.trim()) return;
    setLoading(true);
    setError(null);
    const result = await createIntegrationToken({ name: newTokenName.trim() });
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setTokens((prev) => [result.data!, ...prev]);
      setNewTokenValue(result.data.plain_token);
      setNewTokenName("");
    }
    setLoading(false);
  }, [newTokenName]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    setError(null);
    const result = await deleteIntegrationToken(id);
    if (result.error) {
      setError(result.error);
    } else {
      setTokens((prev) => prev.filter((t) => t.id !== id));
    }
    setDeletingId(null);
  }, []);

  const handleCopy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="rounded-2xl border border-teal/20 bg-teal/5 p-4 text-sm text-ink">
        <div className="flex items-start gap-3">
          <Key className="mt-0.5 h-5 w-5 text-teal shrink-0" />
          <div>
            <h3 className="font-bold">Token API untuk Webhook</h3>
            <p className="mt-1 text-xs text-mute leading-relaxed">
              Token ini digunakan untuk mengautentikasi permintaan ke endpoint{" "}
              <code className="rounded bg-card px-1.5 py-0.5 text-[10px] font-mono text-teal">
                POST /api/activity
              </code>
              . Kirim token sebagai{" "}
              <code className="rounded bg-card px-1.5 py-0.5 text-[10px] font-mono text-teal">
                Authorization: Bearer &lt;token&gt;
              </code>{" "}
              header. Token hanya ditampilkan sekali saat dibuat.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-2xl border border-red/20 bg-red/5 px-4 py-3 text-sm text-red"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* New Token Value (shown once after creation) */}
      {newTokenValue && (
        <div className="rounded-2xl border border-orange/30 bg-orange/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-orange">
            <AlertCircle className="h-4 w-4" />
            Token baru berhasil dibuat! Salin sekarang — tidak bisa dilihat lagi.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-hidden rounded-xl border border-line bg-card px-3 py-2.5 text-xs font-mono text-ink truncate">
              {newTokenValue}
            </code>
            <button
              onClick={() => handleCopy(newTokenValue)}
              className="shrink-0 rounded-xl border border-line bg-card p-2.5 text-mute hover:text-teal hover:border-teal/30 transition-colors"
              title="Salin token"
            >
              {copied ? (
                <Check className="h-4 w-4 text-ok" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            onClick={() => setNewTokenValue(null)}
            className="text-xs text-mute hover:text-ink transition-colors"
          >
            Tutup pesan ini
          </button>
        </div>
      )}

      {/* Create Token Form */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <h3 className="mb-3 font-bold text-ink flex items-center gap-2">
          <Plus className="h-4 w-4 text-teal" />
          Buat Token Baru
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder="Nama token (mis: Claude Coding, GitHub Actions)..."
            className="flex-1 rounded-xl border border-line bg-bg-1 px-4 py-2.5 text-sm text-ink placeholder:text-mute/50 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={!newTokenName.trim() || loading}
            className="shrink-0 rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-2 transition-colors disabled:opacity-50"
          >
            {loading ? "Membuat..." : "Buat"}
          </button>
        </div>
      </div>

      {/* Existing Tokens */}
      {tokens.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-8 text-center">
          <Key className="mx-auto h-10 w-10 text-mute/30" />
          <h3 className="mt-3 font-bold text-ink">Belum Ada Token</h3>
          <p className="mt-1 text-xs text-mute">
            Buat token pertama untuk mengautentikasi webhook dari Claude atau CI/CD.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              id={`token-${token.id}`}
              className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 transition-colors hover:border-teal/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal/10">
                  <Key className="h-4 w-4 text-teal" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">{token.name}</p>
                  <p className="text-[10px] text-mute">
                    Dibuat: {new Date(token.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(token.id)}
                disabled={deletingId === token.id}
                className="rounded-xl p-2 text-red/60 hover:bg-red/10 hover:text-red transition-colors"
                title="Hapus token"
              >
                {deletingId === token.id ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red border-t-transparent" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* API Documentation */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
        <h3 className="font-bold text-ink flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-teal" />
          Cara Penggunaan
        </h3>

        <div className="space-y-3 text-xs text-mute">
          <p className="font-semibold text-ink">Contoh request dari Claude / CI:</p>
          <pre className="overflow-x-auto rounded-xl border border-line bg-bg-1 p-3 font-mono text-[11px] text-ink leading-relaxed">
{`curl -X POST /api/activity \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{
    "project": "Warehouse Monitoring",
    "activity_type": "development",
    "summary": "Memperbaiki RLS inventory",
    "files_changed": ["inventory.sql"],
    "status": "completed",
    "source": "claude"
  }'`}
          </pre>
        </div>
      </div>
    </div>
  );
}
