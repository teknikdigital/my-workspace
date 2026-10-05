import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { activityWebhookSchema } from "@/lib/validators/integrations";

/**
 * POST /api/activity
 *
 * Structured Activity Receiver for Claude, CI, or external sources.
 * Authentication: Bearer token verified against SHA-256 hashes in integration_tokens table.
 *
 * Example payload:
 * {
 *   "project": "Warehouse Monitoring",
 *   "activity_type": "development",
 *   "summary": "Memperbaiki RLS inventory",
 *   "files_changed": ["inventory.sql"],
 *   "status": "completed",
 *   "source": "claude"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract and validate Bearer token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Token autentikasi diperlukan" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return NextResponse.json(
        { error: "Token tidak boleh kosong" },
        { status: 401 }
      );
    }

    // 2. Hash the provided token and look up in DB
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const supabase = createAdminClient();

    const { data: tokenRecord, error: tokenError } = await supabase
      .from("integration_tokens")
      .select("id, user_id, name")
      .eq("token_hash", tokenHash)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json(
        { error: "Token tidak valid" },
        { status: 401 }
      );
    }

    // 3. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body request harus berupa JSON valid" },
        { status: 400 }
      );
    }

    const parsed = activityWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Payload tidak valid",
          details: parsed.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    // 4. Resolve project_id from project name (fuzzy match, user-scoped)
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", tokenRecord.user_id)
      .ilike("name", `%${payload.project}%`)
      .limit(1);

    const projectId = projects?.[0]?.id || null;

    // 5. Resolve application_id if provided
    let applicationId: string | null = null;
    if (payload.application && projectId) {
      const { data: apps } = await supabase
        .from("applications")
        .select("id")
        .eq("user_id", tokenRecord.user_id)
        .eq("project_id", projectId)
        .ilike("name", `%${payload.application}%`)
        .limit(1);
      applicationId = apps?.[0]?.id || null;
    }

    // 6. Insert activity log
    const { data: activityLog, error: insertError } = await supabase
      .from("activity_logs")
      .insert({
        user_id: tokenRecord.user_id,
        project_id: projectId,
        application_id: applicationId,
        task_id: payload.task_id || null,
        activity_type: payload.activity_type,
        summary: payload.summary,
        files_changed: payload.files_changed,
        status: payload.status,
        source: payload.source,
      })
      .select("id, summary, project_id, source, created_at")
      .single();

    if (insertError) {
      console.error("Activity webhook insert error:", insertError.message);
      return NextResponse.json(
        { error: "Gagal menyimpan aktivitas" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        activity_id: activityLog.id,
        project_id: projectId,
        message: `Aktivitas "${payload.summary}" berhasil dicatat.`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Activity webhook unexpected error:", (err as Error).message);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/activity
 * Health check / documentation endpoint
 */
export async function GET() {
  return NextResponse.json({
    name: "My Workspace — Structured Activity Receiver",
    version: "1.0",
    endpoints: {
      "POST /api/activity": {
        description: "Submit structured activity from Claude, CI, or external tools",
        authentication: "Bearer <token> (created in Settings > Integration Tokens)",
        payload: {
          project: "string (required) — project name for fuzzy matching",
          activity_type: "development | bugfix | deployment | review | documentation | testing | other",
          summary: "string (required) — activity description",
          files_changed: "string[] (optional) — list of modified files",
          status: "in_progress | completed | blocked | cancelled",
          source: "claude | github | vercel | ci | external",
          application: "string (optional) — application name for fuzzy matching",
          task_id: "uuid (optional) — link to existing task",
        },
      },
    },
  });
}
