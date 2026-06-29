import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminTaskRow } from "@/lib/admin/types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS = ["open", "in_progress", "done"];
const PRIORITY = ["p0", "p1", "p2", "none"];
const CATEGORY = ["bug", "task", "idea", "ops", "launch"];

/** True when the failure is just "admin_tasks not created yet" (migration pending). */
function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const blob = `${e?.code ?? ""} ${e?.message ?? ""}`;
  return /admin_tasks/.test(blob) && /(does not exist|schema cache|42P01|PGRST205|PGRST20)/i.test(blob);
}

async function guard(): Promise<boolean> {
  return verifySession();
}

/** GET /api/admin/tasks — full board (service role). */
export async function GET(): Promise<Response> {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from("admin_tasks")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ tasks: [], needsMigration: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tasks: (data ?? []) as AdminTaskRow[] });
}

/** POST /api/admin/tasks — add a to-do { title, details?, priority?, category? }. */
export async function POST(req: Request): Promise<Response> {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; details?: string | null; priority?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: "Title is too long (max 200)." }, { status: 400 });

  const priority = body.priority && PRIORITY.includes(body.priority) ? body.priority : "p2";
  const category = body.category && CATEGORY.includes(body.category) ? body.category : "task";
  const details = body.details ? String(body.details).trim().slice(0, 2000) : null;

  const { data, error } = await getSupabaseAdmin()
    .from("admin_tasks")
    .insert({ title, details, priority, category, status: "open" } as never)
    .select("*")
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: "Run the admin_tasks migration first.", needsMigration: true }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ task: data as AdminTaskRow });
}

/** PATCH /api/admin/tasks — edit { id, title?, details?, status?, priority?, category? }. */
export async function PATCH(req: Request): Promise<Response> {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id?: string;
    title?: string;
    details?: string | null;
    status?: string;
    priority?: string;
    category?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    if (t.length > 200) return NextResponse.json({ error: "Title is too long (max 200)." }, { status: 400 });
    patch.title = t;
  }
  if (body.details !== undefined) {
    patch.details = body.details ? String(body.details).trim().slice(0, 2000) : null;
  }
  if (body.status !== undefined) {
    if (!STATUS.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    patch.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!PRIORITY.includes(body.priority)) return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
    patch.priority = body.priority;
  }
  if (body.category !== undefined) {
    if (!CATEGORY.includes(body.category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    patch.category = body.category;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from("admin_tasks").update(patch as never).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/tasks?id=… — remove a to-do. */
export async function DELETE(req: Request): Promise<Response> {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const { error } = await getSupabaseAdmin().from("admin_tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
