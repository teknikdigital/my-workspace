# Claude Code dari My Workspace

My Workspace bisa memberi instruksi ke Claude Code di laptop. Jalurnya:

```
AI Asisten (menyusun instruksi dari HANDOFF.md)
  -> kartu "Instruksi untuk Claude Code" di chat (Anda periksa, boleh edit)
  -> tombol Jalankan (browser -> agent 127.0.0.1:4545)
  -> agent menjalankan: claude -p "<instruksi>" di folder project
  -> progres + hasil tampil langsung
  -> selesai (mode edit): Activity tercatat + HANDOFF.md terkirim ke My Workspace
```

Bisa juga langsung tanpa AI: **Work > Lokal > kartu project > tombol Claude**.

## Syarat
- Claude Code terpasang (`claude --version`) dan login langganan (`claude` lalu `/status`: "Claude Pro account").
- Agent versi 1.4.0 (matikan lalu nyalakan ulang agent setelah update).
- Hanya dari laptop yang menjalankan agent. Dari HP / Vercel, kartu menampilkan instruksi saja.

## Keamanan
| | Mode "Boleh ubah file" | Mode "Baca saja" |
|---|---|---|
| Izin dasar | `acceptEdits` | `dontAsk` |
| Baca file project | Ya | Ya |
| Ubah file project | Ya | Tidak |
| Perintah | baca (ls, cat, grep, head, Get-ChildItem, git status/diff/log), npm run lint/test/build, npx tsc/eslint/vitest/vite build, node (script uji) | baca saja |
| Selalu ditolak | git push/reset/clean/checkout, npm run dev/start, npm install, rm/Remove-Item, WebFetch/WebSearch, membaca .env | sama |

- Project dikunci baca saja lewat `agent/apps.json`: `"claude": { "mode": "read" }`. Default untuk SIAP TPM dan Warehouse Monitoring.
  Ubah ke `"edit"` lalu klik **Muat ulang apps.json** di Pengaturan Agent bila memang ingin Claude mengubah file di sana.
- Variabel `ANTHROPIC_*` dibuang dari env proses, jadi selalu memakai login langganan, bukan API key/router.
- Batas waktu 30 menit per instruksi (`claude.timeoutMinutes`), maksimal 2 instruksi bersamaan. Tombol Hentikan mematikan seluruh proses.
- Perintah di luar daftar izin otomatis ditolak (tidak ada yang bisa menyetujui di tengah jalan) dan dilaporkan di bagian "Perintah yang ditolak".
- Selalu cek `git diff` sebelum commit. Agent tidak pernah commit/push.

## Konfigurasi (agent/apps.json)
```json
"claude": { "path": "C:\\Users\\julia\\.local\\bin\\claude.exe", "defaultModel": "sonnet", "timeoutMinutes": 30, "maxConcurrent": 2 },
"apps": [ { "id": "rapiuang", ..., "claude": { "mode": "edit", "project": "RapiUang" } } ]
```
`project` = nama project di My Workspace (untuk Activity). Opsional per app: `"settings": "D:\\path\\router-settings.json"` untuk memakai router lain lewat `--settings`.

## Log
- Progres mentah: `agent\logs\<app>-claude.log`.
- Biaya: `total_cost_usd` adalah estimasi harga API. Dengan langganan Pro, pemakaian memotong kuota langganan, bukan ditagih.

## Aturan untuk sesi Claude Code manual
Salin `docs/CLAUDE_GLOBAL.md` ke `C:\Users\julia\.claude\CLAUDE.md` agar sesi manual (terminal / aplikasi desktop) juga
membaca dan memperbarui HANDOFF.md serta mencatat ke My Workspace.
