"use client";

import React, { useState, useTransition } from "react";
import type { CredentialMetadata, VaultAuditLog } from "@/types/database";
import {
  createCredential,
  revealCredential,
  deleteCredential,
} from "@/lib/actions/vault";
import { formatDateTimeIndo } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ShieldCheck,
  PlusCircle,
  Eye,
  Copy,
  Trash2,
  Key,
  Lock,
  Loader2,
  Check,
  History,
  AlertTriangle,
} from "lucide-react";

interface VaultClientProps {
  initialCredentials: CredentialMetadata[];
  services: any[];
  auditLogs: VaultAuditLog[];
}

export function VaultClient({
  initialCredentials,
  services,
  auditLogs,
}: VaultClientProps) {
  const [activeTab, setActiveTab] = useState<"credentials" | "audit">("credentials");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Selected Credential for Re-auth Action
  const [selectedCredId, setSelectedCredId] = useState<string | null>(null);
  const [authAction, setAuthAction] = useState<"reveal" | "copy">("reveal");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Decrypted values in-memory per session
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Credential Form State
  const [label, setLabel] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [credentialType, setCredentialType] = useState<any>("secret");
  const [secretValue, setSecretValue] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createCredential({
        label,
        identifier: identifier || undefined,
        service_id: serviceId || undefined,
        credential_type: credentialType,
        secret_value: secretValue,
        notes: notes || undefined,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsAddModalOpen(false);
        setLabel("");
        setIdentifier("");
        setServiceId("");
        setCredentialType("secret");
        setSecretValue("");
        setNotes("");
      }
    });
  };

  const handleRequestRevealOrCopy = (id: string, action: "reveal" | "copy") => {
    // If already revealed and action is reveal, toggle hide
    if (action === "reveal" && revealedSecrets[id]) {
      setRevealedSecrets((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      return;
    }

    setSelectedCredId(id);
    setAuthAction(action);
    setAuthPassword("");
    setAuthError(null);
    setIsAuthModalOpen(true);
  };

  const handleConfirmReauth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredId) return;

    setAuthError(null);
    startTransition(async () => {
      const res = await revealCredential({
        credential_id: selectedCredId,
        auth_password: authPassword,
        action: authAction,
      });

      if (res.error) {
        setAuthError(res.error);
      } else if (res.decryptedValue) {
        if (authAction === "reveal") {
          setRevealedSecrets((prev) => ({
            ...prev,
            [selectedCredId]: res.decryptedValue!,
          }));
          setIsAuthModalOpen(false);
        } else if (authAction === "copy") {
          await navigator.clipboard.writeText(res.decryptedValue);
          setCopiedId(selectedCredId);
          setTimeout(() => setCopiedId(null), 3000);
          setIsAuthModalOpen(false);
        }
      }
    });
  };

  const handleDelete = (id: string, label: string) => {
    if (confirm(`Hapus kredensial "${label}" secara permanen dari Vault?`)) {
      startTransition(async () => {
        await deleteCredential(id);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">
              Credentials Vault
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
              <Lock className="h-3 w-3" />
              AES-256-GCM
            </span>
          </div>
          <p className="text-xs sm:text-sm text-mute mt-0.5">
            Penyimpanan aman terenkripsi untuk password, API key, service role key, dan secret token.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "credentials" ? "audit" : "credentials")}
            className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-card/60 px-3.5 py-2 text-xs font-semibold text-ink hover:bg-card transition-all"
          >
            <History className="h-4 w-4 text-mute" />
            <span>{activeTab === "credentials" ? "Audit Log" : "Daftar Vault"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-btn bg-teal px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-soft hover:bg-teal-dark transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Tambah Secret</span>
          </button>
        </div>
      </div>

      {activeTab === "credentials" ? (
        initialCredentials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {initialCredentials.map((cred) => {
              const isRevealed = Boolean(revealedSecrets[cred.id]);
              const secretText = revealedSecrets[cred.id];
              const isCopied = copiedId === cred.id;

              return (
                <div
                  key={cred.id}
                  className="flex flex-col justify-between rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft hover:border-teal/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal">
                        {cred.credential_type.replace("_", " ")}
                      </span>
                      {cred.service && (
                        <span className="text-[10px] font-semibold text-mute">
                          {cred.service.name}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-ink">{cred.label}</h3>
                    {cred.identifier && (
                      <p className="text-xs text-mute mt-0.5">ID: {cred.identifier}</p>
                    )}

                    {/* Secret Mask / Reveal Box */}
                    <div className="mt-3 rounded-btn border border-line bg-card/80 p-3">
                      <span className="text-[10px] font-bold uppercase text-mute block mb-1">
                        Encrypted Value
                      </span>
                      {isRevealed ? (
                        <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 break-all select-all font-semibold">
                          {secretText}
                        </div>
                      ) : (
                        <div className="font-mono text-xs text-mute tracking-widest select-none">
                          ••••••••••••••••••••••••••••••••
                        </div>
                      )}
                    </div>

                    {cred.notes && (
                      <p className="mt-2 text-xs text-mute line-clamp-2">{cred.notes}</p>
                    )}
                  </div>

                  {/* Actions: Reveal, Copy, Delete */}
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                    <div className="flex items-center gap-2">
                      {/* Reveal Button */}
                      <button
                        type="button"
                        onClick={() => handleRequestRevealOrCopy(cred.id, "reveal")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-teal/10 hover:text-teal transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>{isRevealed ? "Sembunyikan" : "Reveal"}</span>
                      </button>

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleRequestRevealOrCopy(cred.id, "copy")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-teal/10 hover:text-teal transition-all"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(cred.id, cred.label)}
                      className="rounded p-1 text-mute hover:text-red hover:bg-red/10 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Vault masih kosong"
            description="Simpan API Key (OpenAI, Claude, Anthropic), Service Role Key Supabase, atau password sistem dengan aman."
            actionLabel="Tambah Kredensial Pertama"
            onAction={() => setIsAddModalOpen(true)}
          />
        )
      ) : (
        /* AUDIT LOG VIEW */
        <div className="rounded-panel border border-line bg-glass p-6 backdrop-blur-sm shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-teal" />
              <h3 className="text-base font-bold text-ink">Vault Access Audit Log</h3>
            </div>
            <span className="text-xs text-mute">
              Semua aksi reveal, copy, dan modifikasi tercatat tanpa menyimpan isi secret.
            </span>
          </div>

          <div className="space-y-2">
            {auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-btn border border-line bg-card/60 p-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded text-[9px] ${
                        log.action === "reveal"
                          ? "bg-amber-500/10 text-amber-600"
                          : log.action === "copy"
                          ? "bg-teal/10 text-teal"
                          : log.action === "create"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-semibold text-ink">
                      {log.credential_label || "Secret"}
                    </span>
                  </div>
                  <span className="text-mute text-[11px]">
                    {formatDateTimeIndo(log.created_at)}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-mute">Belum ada aktivitas audit log.</p>
            )}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH KREDENSIAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Simpan Kredensial ke Vault"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Label Kredensial *
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="mis. Supabase Service Role Key / OpenAI API Key"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Tipe Kredensial
              </label>
              <select
                value={credentialType}
                onChange={(e) => setCredentialType(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="api_key">API Key</option>
                <option value="service_role_key">Service Role Key</option>
                <option value="token">Access Token</option>
                <option value="password">Password</option>
                <option value="recovery_code">Recovery Code</option>
                <option value="secret">Secret / Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Layanan Terkait
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
              >
                <option value="">-- Tanpa Layanan --</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Identifier (Opsional)
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="mis. admin@workspace.io / proj_ref_123"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Nilai Rahasia / Secret * (Dienkripsi dengan AES-256-GCM)
            </label>
            <textarea
              required
              rows={3}
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              placeholder="Masukkan secret value yang akan dienkripsi di server..."
              className="w-full rounded-btn border border-line bg-card p-3 text-xs font-mono text-ink focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Catatan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan keamanan atau tanggal kedaluwarsa..."
              className="w-full rounded-btn border border-line bg-card p-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          {formError && (
            <div className="rounded-btn bg-red/10 border border-red/20 p-2 text-xs font-semibold text-red">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-btn border border-line px-4 py-2 text-xs font-semibold text-mute hover:bg-line/20"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-btn bg-teal px-4 py-2 text-xs font-bold text-white hover:bg-teal-dark disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Enkripsi & Simpan</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL RE-AUTHENTICATION UNTUK REVEAL / COPY */}
      <Modal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Verifikasi Keamanan (Re-Authentication)"
      >
        <form onSubmit={handleConfirmReauth} className="space-y-4">
          <div className="flex items-start gap-3 rounded-btn border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
            <p>
              Untuk menjaga kerahasiaan, masukkan kata sandi akunmu sebelum menampilkan atau menyalin nilai rahasia ini.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">
              Kata Sandi Akun
            </label>
            <input
              type="password"
              required
              autoFocus
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 rounded-btn border border-line bg-card px-3 text-sm text-ink focus:border-teal focus:outline-none"
            />
          </div>

          {authError && (
            <div className="rounded-btn bg-red/10 border border-red/20 p-2 text-xs font-semibold text-red">
              {authError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="rounded-btn border border-line px-4 py-2 text-xs font-semibold text-mute hover:bg-line/20"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-btn bg-teal px-4 py-2 text-xs font-bold text-white hover:bg-teal-dark disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Konfirmasi & Lanjutkan</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
