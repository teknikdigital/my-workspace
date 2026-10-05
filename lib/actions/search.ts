"use server";

import { createClient } from "@/lib/supabase/server";
import type { SearchResultItem } from "@/types/database";

export async function searchWorkspace(query: string): Promise<Record<string, SearchResultItem[]>> {
  if (!query || !query.trim()) return {};

  const cleanQuery = query.trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  // Try calling the search_workspace RPC function
  const { data: rpcData, error: rpcError } = await supabase.rpc("search_workspace", {
    q: cleanQuery,
  });

  if (!rpcError && rpcData && Array.isArray(rpcData)) {
    const grouped: Record<string, SearchResultItem[]> = {};
    for (const item of rpcData) {
      if (!grouped[item.entity_type]) grouped[item.entity_type] = [];
      grouped[item.entity_type].push(item);
    }
    return grouped;
  }

  // Fallback: direct table queries with RLS if RPC is not yet loaded in DB
  const grouped: Record<string, SearchResultItem[]> = {
    project: [],
    application: [],
    resource: [],
    account: [],
    task: [],
    note: [],
  };

  const [projRes, appRes, resRes, accRes, taskRes, noteRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, category")
      .or(`name.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%,category.ilike.%${cleanQuery}%`)
      .limit(5),
    supabase
      .from("applications")
      .select("id, name, framework, type")
      .or(`name.ilike.%${cleanQuery}%,framework.ilike.%${cleanQuery}%`)
      .limit(5),
    supabase
      .from("resources")
      .select("id, title, url, category")
      .or(`title.ilike.%${cleanQuery}%,url.ilike.%${cleanQuery}%`)
      .limit(5),
    supabase
      .from("accounts")
      .select("id, label, identifier")
      .or(`label.ilike.%${cleanQuery}%,identifier.ilike.%${cleanQuery}%`)
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, description, status")
      .or(`title.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%`)
      .limit(5),
    supabase
      .from("notes")
      .select("id, title, body")
      .or(`title.ilike.%${cleanQuery}%,body.ilike.%${cleanQuery}%`)
      .limit(5),
  ]);

  if (projRes.data) {
    grouped.project = projRes.data.map((p) => ({
      entity_type: "project",
      entity_id: p.id,
      title: p.name,
      subtitle: p.description || p.category || "Project",
      url_path: `/work/projects/${p.id}`,
    }));
  }

  if (appRes.data) {
    grouped.application = appRes.data.map((a) => ({
      entity_type: "application",
      entity_id: a.id,
      title: a.name,
      subtitle: a.framework || a.type || "Aplikasi",
      url_path: `/work/applications`,
    }));
  }

  if (resRes.data) {
    grouped.resource = resRes.data.map((r) => ({
      entity_type: "resource",
      entity_id: r.id,
      title: r.title,
      subtitle: r.url || r.category || "Resource",
      url_path: `/work/resources`,
    }));
  }

  if (accRes.data) {
    grouped.account = accRes.data.map((acc) => ({
      entity_type: "account",
      entity_id: acc.id,
      title: acc.label,
      subtitle: acc.identifier || "Akun",
      url_path: `/work/accounts`,
    }));
  }

  if (taskRes.data) {
    grouped.task = taskRes.data.map((t) => ({
      entity_type: "task",
      entity_id: t.id,
      title: t.title,
      subtitle: t.description || t.status || "Task",
      url_path: `/work/tasks`,
    }));
  }

  if (noteRes.data) {
    grouped.note = noteRes.data.map((n) => ({
      entity_type: "note",
      entity_id: n.id,
      title: n.title || "Catatan tanpa judul",
      subtitle: (n.body || "").slice(0, 80),
      url_path: `/personal/notes`,
    }));
  }

  // Remove empty groups
  const filtered: Record<string, SearchResultItem[]> = {};
  for (const [key, val] of Object.entries(grouped)) {
    if (val.length > 0) filtered[key] = val;
  }
  return filtered;
}
