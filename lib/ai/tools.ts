import { searchWorkspace } from "@/lib/actions/search";
import { createTask, getTasks } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";
import { getProjectById } from "@/lib/actions/projects";
import { createCredential, getCredentialsMetadata } from "@/lib/actions/vault";
import { registerAccount } from "@/lib/actions/accountRegistry";
import { PLACEHOLDER_RE, type DetectedSecret } from "@/lib/ai/secretGuard";

/** Konteks per-request: rahasia yang dicegat dari chat (lihat lib/ai/secretGuard.ts). */
export interface AiToolContext {
  secrets: DetectedSecret[];
  used: Set<string>; // placeholder yang sudah disimpan ke Vault
  /** Draf instruksi Claude Code (dijalankan dari browser setelah pengguna menekan Jalankan). */
  claudeTasks?: ClaudeTaskDraft[];
  /** Kanal chat. Tool file (buat/kirim dokumen) hanya tersedia di kanal yang bisa mengirim file. */
  channel?: AiChannel;
  /** File yang disiapkan AI untuk dikirim kanal (Telegram). */
  files?: GeneratedFile[];
}

export type AiChannel = "web" | "telegram" | "whatsapp";
/** Kanal yang bisa mengirim file ke pengguna. */
export const FILE_CHANNELS: AiChannel[] = ["telegram"];
import { makeClaudeTask, type ClaudeTaskDraft } from "@/lib/ai/claudeTask";
import { makeGeneratedFile, type GeneratedFile } from "@/lib/ai/generatedFile";
import { findDocumentForFile, saveGeneratedDocument } from "@/lib/actions/generatedDocs";
import { ensureProject, checkProjectReadiness, findProjectByName } from "@/lib/actions/projectAssist";
import { saveDocumentFacts, readProjectDocument } from "@/lib/actions/documentMemory";
import { logActivity, getActivitySummary } from "@/lib/actions/activityLog";
import { registerResource, registerApplication, updateProjectDetails } from "@/lib/actions/workspaceRegistry";

export const AI_TOOL_DEFINITIONS = [
  {
    name: "search_workspace",
    description: "Cari data project, aplikasi, resource link, akun, task, atau catatan di workspace.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Kata kunci pencarian, misal 'warehouse', 'supabase', 'energy'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_today_tasks",
    description: "Ambil daftar task yang jatuh tempo hari ini atau task aktif yang belum selesai.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_task",
    description: "Buat task baru untuk pengguna.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul task yang jelas" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Tingkat prioritas",
        },
        due_date: {
          type: "string",
          description: "Tanggal jatuh tempo format YYYY-MM-DD (opsional)",
        },
        project_id: { type: "string", description: "UUID project jika terkait (opsional)" },
        project_name: { type: "string", description: "Nama project jika UUID tidak diketahui (opsional)" },
      },
      required: ["title"],
    },
  },
  {
    name: "create_note",
    description: "Simpan catatan baru ke workspace pengguna.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul catatan" },
        content: { type: "string", description: "Isi teks catatan (markdown)" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Daftar tag kategori",
        },
        project_id: { type: "string", description: "UUID project jika terkait" },
      },
      required: ["content"],
    },
  },
  {
    name: "create_vault_credential",
    description: "Simpan data rahasia / kredensial (password, API key, token, PIN) ke dalam Encrypted Vault terenkripsi AES-256-GCM dengan aman.",
    parameters: {
      type: "object",
      properties: {
        label: { type: "string", description: "Nama / label kredensial (contoh: 'OpenAI Prod Key', 'Root DB Password')" },
        identifier: { type: "string", description: "Username, email, atau key identifier (opsional)" },
        secret_value: {
          type: "string",
          description:
            "Nilai rahasia. Bila pesan pengguna berisi placeholder seperti [[RAHASIA_1]], isi PERSIS dengan placeholder itu (server yang menukarnya dengan nilai asli).",
        },
        credential_type: {
          type: "string",
          enum: ["password", "api_key", "token", "service_role_key", "recovery_code", "secret"],
          description: "Tipe kredensial",
        },
        notes: { type: "string", description: "Catatan tambahan" },
      },
      required: ["label", "secret_value"],
    },
  },
  {
    name: "list_vault_credentials",
    description: "Tampilkan daftar kredensial rahasia yang tersimpan di Encrypted Vault (hanya metadata: label, tipe, identifier, catatan — TANPA menampilkan nilai rahasia/password).",
    parameters: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Kata kunci pencarian opsional untuk filter kredensial berdasarkan label atau identifier",
        },
      },
    },
  },
  {
    name: "register_account",
    description:
      "Daftarkan atau perbarui akun layanan (GitHub, Google, Supabase, Vercel, dll) dan sambungkan otomatis ke project/aplikasi. " +
      "Service dicari/dibuat otomatis, akun yang sudah ada (service + email/username sama) diperbarui, bukan dibuat ganda. " +
      "Bisa juga dipakai hanya untuk menghubungkan akun yang sudah ada ke project (cukup isi service + projects). " +
      "JANGAN masukkan password/API key/token di field mana pun: gunakan create_vault_credential untuk rahasia.",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string", description: "Nama layanan, contoh: GitHub, Google, Supabase, Vercel, OpenAI" },
        email: { type: "string", description: "Email login akun (opsional bila username diisi)" },
        username: { type: "string", description: "Username akun (opsional)" },
        label: { type: "string", description: "Nama tampilan akun (opsional, otomatis dibuat bila kosong)" },
        phone: { type: "string", description: "Nomor telepon (opsional)" },
        purpose_tags: {
          type: "array",
          items: { type: "string" },
          description: "Tag kegunaan, contoh: ['dev', 'billing', 'personal']",
        },
        notes: { type: "string", description: "Catatan non-rahasia" },
        is_personal: { type: "boolean", description: "true bila akun pribadi" },
        projects: {
          type: "array",
          items: { type: "string" },
          description: "Nama project yang memakai akun ini, contoh: ['SIAP TPM', 'Rapiuang']",
        },
        applications: {
          type: "array",
          items: { type: "string" },
          description: "Nama aplikasi yang memakai akun ini",
        },
        role: { type: "string", description: "Peran akun di project/aplikasi, default owner" },
      },
      required: ["service"],
    },
  },
  {
    name: "create_project",
    description:
      "Buat project baru di workspace. Bila project dengan nama sama sudah ada, project lama dikembalikan (tidak dibuat ganda).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nama project, contoh: Rally District" },
        description: { type: "string", description: "Deskripsi singkat tujuan project (opsional)" },
        status: {
          type: "string",
          enum: ["planning", "development", "testing", "production", "maintenance", "archived"],
          description: "Tahap project, default development",
        },
        category: { type: "string", description: "Kategori, mis. web app, internal tool (opsional)" },
        tech_stack: { type: "array", items: { type: "string" }, description: "mis. ['Next.js', 'Supabase']" },
        progress: { type: "number", description: "Progress 0-100 (opsional)" },
      },
      required: ["name"],
    },
  },
  {
    name: "check_project_readiness",
    description:
      "Analisis kesiapan project: deskripsi, tech stack, repository, database, deployment, akun, aplikasi, task (termasuk yang lewat tenggat), dan catatan. Mengembalikan skor dan daftar yang kurang.",
    parameters: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nama project (atau UUID)" },
      },
      required: ["project"],
    },
  },
  {
    name: "save_document_facts",
    description:
      "Simpan fakta penting dari isi file yang dibaca (NIB, NPWP, nomor izin/kontrak, tanggal, alamat, nilai) sebagai catatan dokumen tersemat di project, agar bisa diingat dan ditanyakan lagi tanpa membaca ulang file. File yang sama -> catatan diperbarui.",
    parameters: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nama project tujuan file (dari header blok ISI FILE)" },
        file_name: { type: "string", description: "Nama file" },
        file_path: { type: "string", description: "Lokasi file di laptop (dari header blok ISI FILE)" },
        summary: { type: "string", description: "Ringkasan isi 1-2 kalimat" },
        facts: {
          type: "array",
          description: "Daftar fakta, mis. [{label:'NIB', value:'1234567890123'}, {label:'Nama Usaha', value:'...'}]",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "string" },
            },
            required: ["label", "value"],
          },
        },
      },
      required: ["file_name", "facts"],
    },
  },
  {
    name: "register_resource",
    description:
      "Daftarkan resource project dan hubungkan ke project: repository (GitHub), database (Supabase), deployment (Vercel/Netlify/cPanel/domain), dokumentasi (Drive/Sheet/Figma). Kategori & peran ditebak dari URL. Resource dengan URL sama tidak dibuat ganda.",
    parameters: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nama project" },
        url: { type: "string", description: "URL resource, mis. github.com/user/repo, https://xxxx.supabase.co, https://app.vercel.app" },
        name: { type: "string", description: "Nama tampilan (opsional)" },
        role: {
          type: "string",
          enum: ["repository", "database", "deployment", "documentation", "other"],
          description: "Peran di project (opsional, ditebak dari URL)",
        },
        account: { type: "string", description: "Email/username akun yang menaungi resource (opsional)" },
        application: { type: "string", description: "Nama aplikasi yang memakai resource (opsional)" },
        notes: { type: "string", description: "Catatan non-rahasia (opsional)" },
      },
      required: ["project"],
    },
  },
  {
    name: "register_application",
    description:
      "Daftarkan atau perbarui aplikasi (web app, backend, Apps Script, dll) di sebuah project. Nama sama di project yang sama -> diperbarui.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nama aplikasi" },
        project: { type: "string", description: "Nama project" },
        framework: { type: "string", description: "mis. Next.js 16, Express, Apps Script" },
        type: { type: "string", enum: ["nextjs", "apps_script", "pwa", "streamlit", "static", "backend", "other"] },
        production_url: { type: "string" },
        staging_url: { type: "string" },
        status: { type: "string", enum: ["planning", "development", "testing", "production", "maintenance", "archived"] },
        description: { type: "string" },
      },
      required: ["name", "project"],
    },
  },
  {
    name: "update_project",
    description: "Ubah detail project: deskripsi, status, progress, kategori, tech stack, dan folder lokal di laptop.",
    parameters: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nama project" },
        description: { type: "string", description: "Deskripsi: tujuan, pengguna, fitur inti" },
        status: { type: "string", enum: ["planning", "development", "testing", "production", "maintenance", "archived"] },
        progress: { type: "number", description: "0-100" },
        category: { type: "string" },
        tech_stack: { type: "array", items: { type: "string" } },
        local_folder: { type: "string", description: "Lokasi folder project di laptop, mis. D:\\Rally District" },
      },
      required: ["project"],
    },
  },
  {
    name: "read_project_document",
    description:
      "Baca bagian dokumen project yang tersimpan utuh (catatan 📚, mis. README/serah terima/spesifikasi) yang relevan dengan pertanyaan. Tanpa query: daftar isi.",
    parameters: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nama project" },
        query: { type: "string", description: "Pertanyaan/kata kunci, mis. 'langkah deploy', 'file sql yang dilarang'" },
        document: { type: "string", description: "Sebagian nama file dokumen (opsional)" },
      },
      required: ["project"],
    },
  },
  {
    name: "log_activity",
    description:
      "Catat pekerjaan yang sudah/sedang dikerjakan pengguna ke Activity, terhubung ke project. Bisa sekaligus menandai task selesai dan memperbarui progress project. Satu panggilan per project.",
    parameters: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nama project (kosongkan untuk pekerjaan umum, mis. rapat)" },
        summary: { type: "string", description: "Ringkasan pekerjaan, 1 kalimat jelas" },
        details: { type: "string", description: "Detail tambahan (opsional)" },
        activity_type: {
          type: "string",
          enum: ["development", "bugfix", "deployment", "review", "documentation", "testing", "meeting", "planning", "configuration", "other"],
        },
        status: { type: "string", enum: ["in_progress", "completed", "blocked", "cancelled"] },
        files_changed: { type: "array", items: { type: "string" } },
        date: { type: "string", description: "Tanggal YYYY-MM-DD (WIB) bila bukan hari ini, mis. untuk 'kemarin'" },
        complete_tasks: { type: "array", items: { type: "string" }, description: "Judul task yang selesai" },
        progress: { type: "number", description: "Progress project terbaru 0-100 bila disebut pengguna" },
      },
      required: ["summary"],
    },
  },
  {
    name: "get_activity_summary",
    description:
      "Ringkasan pekerjaan per project untuk periode tertentu (hari ini, kemarin, minggu ini, 7 hari, bulan ini), termasuk task yang selesai. Untuk laporan harian/mingguan.",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "yesterday", "week", "last7", "month"] },
        project: { type: "string", description: "Filter satu project (opsional)" },
      },
      required: ["period"],
    },
  },
  {
    name: "send_to_claude_code",
    description:
      "Siapkan instruksi untuk Claude Code (AI coding di laptop pengguna) agar mengerjakan sesuatu di folder project: fitur, perbaikan bug, refactor, dokumentasi, atau analisis/review kode. " +
      "Pakai juga untuk permintaan membuat fitur, halaman, laporan/report, export PDF/Excel, atau file di aplikasi project walau pengguna tidak menyebut Claude. " +
      "Tool ini TIDAK langsung menjalankan; pengguna melihat kartu instruksi dan menekan tombol Jalankan. Baca HANDOFF.md project dulu (read_project_document) agar instruksi sesuai kondisi terkini.",
    parameters: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description:
            "Nama project (mis. RapiUang, Rally District, My Workspace, SIAP TPM). Untuk analisis LINTAS banyak project pakai koleksi baca-saja: " +
            "'Semua Project' (project pribadi: My Workspace, RapiUang, Rally District) atau 'Bio Farma Digitalisasi' (semua project di D:\\Biofarma\\Digitalisasi), mode read.",
        },
        instruction: {
          type: "string",
          description:
            "Instruksi lengkap dalam Bahasa Indonesia: tujuan, konteks dari HANDOFF (stack, file/area terkait), batasan (mis. jangan tambah dependency tanpa alasan), dan kriteria selesai (mis. npm run build lulus). Tanpa rahasia.",
        },
        mode: { type: "string", enum: ["edit", "read"], description: "edit = boleh mengubah file; read = hanya analisis/review" },
        model: { type: "string", enum: ["sonnet", "opus", "haiku"], description: "Default sonnet. opus hanya bila pengguna minta atau tugas sangat kompleks." },
      },
      required: ["project", "instruction"],
    },
  },
  {
    name: "get_project_details",
    description: "Dapatkan detail mendalam relasi arsitektur sebuah project (database, repo, deploy, akun, app).",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID project" },
      },
      required: ["project_id"],
    },
  },
];

/** Tool khusus kanal yang bisa mengirim file (Telegram). */
export const FILE_TOOL_DEFINITIONS = [
  {
    name: "create_document_file",
    description:
      "Buat dokumen (TOR, notulen, surat, laporan, SOP, proposal, ringkasan, checklist, dll) dan kirim ke pengguna sebagai file Word (.docx) atau Markdown. " +
      "Tulis ISI LENGKAP dokumen di content (Markdown: # judul bagian, daftar, tabel pipa). Dokumen juga disimpan sebagai catatan '📝 judul' di My Workspace.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul dokumen, mis. 'TOR Rapat Koordinasi Isolator'" },
        content: { type: "string", description: "Isi lengkap dokumen dalam Markdown. Jangan ulangi judul sebagai heading pertama." },
        format: { type: "string", enum: ["docx", "md"], description: "Default docx. md hanya bila pengguna meminta Markdown." },
        project: { type: "string", description: "Project terkait (opsional)" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "get_document_file",
    description:
      "Kirim dokumen yang SUDAH TERSIMPAN di My Workspace sebagai file: dokumen yang pernah diunggah (mis. NIB, kontrak, PDF), " +
      "dokumen buatan AI, atau catatan (mis. 'kirim NIB Rally District', 'kirim TOR isolator kemarin', 'minta HANDOFF RapiUang'). " +
      "Pencarian per kata pada judul/nama file dan nama project. Untuk dokumen unggahan, FILE ASLI (mis. PDF) dikirim bila masih ada di laptop; bila tidak, versi teksnya.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Kata kunci judul/nama file, mis. 'NIB', 'TOR isolator', 'HANDOFF'" },
        project: { type: "string", description: "Nama project (opsional, mempersempit pencarian)" },
        format: { type: "string", enum: ["docx", "md"], description: "Default docx" },
      },
      required: ["query"],
    },
  },
];

/** Daftar tool untuk konteks ini: tool file hanya untuk kanal yang bisa mengirim file. */
export function toolsFor(ctx?: AiToolContext) {
  return ctx?.channel && FILE_CHANNELS.includes(ctx.channel) ? [...AI_TOOL_DEFINITIONS, ...FILE_TOOL_DEFINITIONS] : AI_TOOL_DEFINITIONS;
}

export async function executeAiTool(toolName: string, args: any, ctx?: AiToolContext): Promise<any> {
  try {
    switch (toolName) {
      case "search_workspace": {
        const results = await searchWorkspace(args.query);
        return { success: true, results };
      }
      case "get_today_tasks": {
        const allTasks = await getTasks();
        const todayStr = new Date().toISOString().split("T")[0];
        const todayTasks = allTasks.filter(
          (t) => t.status !== "done" && (!t.due_date || t.due_date <= todayStr)
        );
        return { success: true, tasks: todayTasks };
      }
      case "create_task": {
        // Izinkan AI menyebut nama project; diterjemahkan ke UUID bila cocok tepat satu
        if (!args.project_id && args.project_name) {
          const m = await findProjectByName(args.project_name);
          if (m.kind === "match") args.project_id = m.row.id;
        }
        const res = await createTask({
          title: args.title,
          status: "todo",
          priority: args.priority || "medium",
          due_date: args.due_date || undefined,
          project_id: args.project_id || undefined,
          source: "ai",
        });
        return res;
      }
      case "create_note": {
        const res = await createNote({
          title: args.title || undefined,
          content: args.content || args.body || "",
          tags: args.tags || [],
          project_id: args.project_id || undefined,
        });
        return res;
      }
      case "create_vault_credential": {
        // Tukar placeholder [[RAHASIA_n]] dengan nilai asli yang dicegat dari chat
        let secretValue: string = String(args.secret_value || "").trim();
        const ph = secretValue.match(PLACEHOLDER_RE);
        if (ph) {
          const found = ctx?.secrets.find((x) => x.placeholder === secretValue);
          if (!found) return { success: false, error: `Placeholder ${secretValue} tidak dikenal di pesan ini.` };
          if (ctx?.used.has(found.placeholder)) {
            return { success: true, message: `${found.placeholder} sudah disimpan sebelumnya, tidak disimpan ganda.` };
          }
          secretValue = found.value;
          ctx?.used.add(found.placeholder);
        }
        const res = await createCredential({
          label: args.label,
          identifier: args.identifier || null,
          secret_value: secretValue,
          credential_type: args.credential_type || "secret",
          notes: args.notes || null,
        });
        if (res.error) {
          return { success: false, error: res.error };
        }
        return { success: true, message: `Kredensial '${args.label}' berhasil disimpan ke Encrypted Vault.` };
      }
      case "list_vault_credentials": {
        const creds = await getCredentialsMetadata();
        const keyword = (args.search || "").toLowerCase();
        const filtered = keyword
          ? creds.filter(
              (c: any) =>
                c.label?.toLowerCase().includes(keyword) ||
                c.identifier?.toLowerCase().includes(keyword) ||
                c.notes?.toLowerCase().includes(keyword) ||
                c.credential_type?.toLowerCase().includes(keyword)
            )
          : creds;
        // Return metadata only — NEVER return encrypted values
        const safeList = filtered.map((c: any) => ({
          id: c.id,
          label: c.label,
          identifier: c.identifier || "-",
          credential_type: c.credential_type,
          notes: c.notes || "-",
          created_at: c.created_at,
          service: c.service?.name || "-",
        }));
        return {
          success: true,
          total: safeList.length,
          credentials: safeList,
          note: "Nilai rahasia tidak ditampilkan demi keamanan. Gunakan halaman Vault untuk reveal dengan verifikasi password.",
        };
      }
      // create_account dipertahankan sebagai alias lama
      case "register_account":
      case "create_account": {
        return await registerAccount({
          service: args.service || "Lainnya",
          email: args.email,
          username: args.username,
          label: args.label,
          phone: args.phone,
          purpose_tags: args.purpose_tags,
          notes: args.notes,
          is_personal: args.is_personal,
          projects: args.projects,
          applications: args.applications,
          role: args.role,
        });
      }
      case "create_project": {
        return await ensureProject({
          name: args.name,
          description: args.description,
          status: args.status,
          category: args.category,
          tech_stack: args.tech_stack,
          progress: typeof args.progress === "number" ? Math.max(0, Math.min(100, Math.round(args.progress))) : undefined,
        });
      }
      case "check_project_readiness": {
        return await checkProjectReadiness(args.project);
      }
      case "save_document_facts": {
        return await saveDocumentFacts({
          project: args.project,
          file_name: args.file_name,
          file_path: args.file_path,
          summary: args.summary,
          facts: Array.isArray(args.facts) ? args.facts : [],
        });
      }
      case "register_resource": {
        return await registerResource(args);
      }
      case "register_application": {
        return await registerApplication(args);
      }
      case "update_project": {
        return await updateProjectDetails(args);
      }
      case "read_project_document": {
        return await readProjectDocument({ project: args.project, query: args.query, document: args.document });
      }
      case "log_activity": {
        return await logActivity(args);
      }
      case "get_activity_summary": {
        return await getActivitySummary({ period: args.period, project: args.project });
      }
      case "send_to_claude_code": {
        const { draft, error } = makeClaudeTask(args, ctx?.claudeTasks?.length || 0);
        if (error || !draft) return { success: false, error };
        const m = await findProjectByName(draft.project);
        if (m.kind === "match") draft.project = m.row.name;
        if (ctx) (ctx.claudeTasks ||= []).push(draft);
        return {
          success: true,
          prepared: true,
          project: draft.project,
          mode: draft.mode,
          note: "Kartu instruksi tampil di chat. Minta pengguna memeriksa lalu menekan 'Jalankan di Claude Code' (hanya bisa dari laptop dengan agent menyala).",
        };
      }
      case "create_document_file": {
        if (!ctx?.channel || !FILE_CHANNELS.includes(ctx.channel)) return { success: false, error: "Kanal ini tidak bisa mengirim file" };
        const { file, error } = makeGeneratedFile(args, ctx.files?.length || 0);
        if (error || !file) return { success: false, error };
        const saved = await saveGeneratedDocument({ title: file.title, markdown: file.markdown, project: args.project });
        (ctx.files ||= []).push(file);
        return {
          success: true,
          file: `${file.title}.${file.format}`,
          saved_as_note: saved.success ? saved.note : null,
          note: "File akan dikirim otomatis ke chat. Jawab 1-2 kalimat saja (isi utama dokumen), JANGAN salin isi dokumen di jawaban.",
        };
      }
      case "get_document_file": {
        if (!ctx?.channel || !FILE_CHANNELS.includes(ctx.channel)) return { success: false, error: "Kanal ini tidak bisa mengirim file" };
        if ((ctx.files?.length || 0) >= 3) return { success: false, error: "Maksimal 3 file per pesan" };
        const doc = await findDocumentForFile({ query: args.query, project: args.project });
        if (!doc.success) return doc;
        (ctx.files ||= []).push({
          title: doc.title.replace(/\.(pdf|docx?|xlsx?|pptx|txt|md|csv|png|jpe?g)$/i, ""),
          format: args.format === "md" ? "md" : "docx",
          markdown: doc.content.slice(0, 60_000),
          source: "stored",
          originalPath: doc.originalPath,
        });
        return {
          success: true,
          file: doc.title,
          project: doc.project,
          original_file: doc.originalPath ? "akan dikirim bila masih ada di laptop" : "tidak ada (dikirim versi teks)",
          other_matches: doc.others.length ? doc.others : undefined,
          note: "File akan dikirim otomatis. Sebut judulnya; bila other_matches ada, tawarkan dokumen lain itu.",
        };
      }
      case "get_project_details": {
        const project = await getProjectById(args.project_id);
        return { success: true, project };
      }
      default:
        return { error: `Tool ${toolName} tidak dikenali` };
    }
  } catch (err: any) {
    return { error: err.message || "Gagal menjalankan tool" };
  }
}
