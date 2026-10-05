import { searchWorkspace } from "@/lib/actions/search";
import { createTask, getTasks } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";
import { getProjectById } from "@/lib/actions/projects";

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
        body: { type: "string", description: "Isi teks catatan" },
        scope: {
          type: "string",
          enum: ["personal", "work", "project"],
          description: "Scope catatan",
        },
      },
      required: ["body"],
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

export async function executeAiTool(toolName: string, args: any): Promise<any> {
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
          body: args.body,
          scope: args.scope || "work",
        });
        return res;
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
