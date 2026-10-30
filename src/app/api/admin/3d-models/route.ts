import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

async function adminClients(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowed = (process.env.FURNITURE_RAMA_ADMIN_EMAILS ?? "").split(",").map(email=>email.trim().toLowerCase()).filter(Boolean);
  if (!url || !publicKey || !serviceKey || allowed.length === 0) return { error: NextResponse.json({ error: "Admin model library not configured." }, { status: 503, headers: noStore }) };
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore }) };
  const auth = createClient(url, publicKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await auth.auth.getUser(bearer);
  if (error || !user?.email || !allowed.includes(user.email.toLowerCase())) return { error: NextResponse.json({ error: "Not authorized." }, { status: 403, headers: noStore }) };
  return { database: createClient(url, serviceKey, { auth: { persistSession: false } }) };
}

export async function GET(request: NextRequest) {
  const client = await adminClients(request);
  if (client.error) return client.error;
  const { data, error } = await client.database!.from("rama_3d_models").select("id,product_name,product_sku,source_image_url,model_url,status,notes,created_at").order("created_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: "Model library unavailable. Check migration and configuration." }, { status: 503, headers: noStore });
  return NextResponse.json({ models: data }, { headers: noStore });
}

export async function PATCH(request: NextRequest) {
  const client = await adminClients(request);
  if (client.error) return client.error;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
  const { id, status, notes } = input as Record<string, unknown>;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || (status !== "approved" && status !== "rejected") || typeof notes !== "string" || notes.length > 1500) return NextResponse.json({ error: "Invalid review." }, { status: 400, headers: noStore });
  const db = client.database!;
  const { data: existing, error: fetchError } = await db.from("rama_3d_models").select("model_url").eq("id", id).maybeSingle();
  if (fetchError || !existing) return NextResponse.json({ error: "Model not found." }, { status: 404, headers: noStore });
  if (status === "approved" && !existing.model_url) return NextResponse.json({ error: "A saved model is required before approval." }, { status: 400, headers: noStore });
  const { error } = await db.from("rama_3d_models").update({ status, notes, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "Unable to save review." }, { status: 500, headers: noStore });
  return NextResponse.json({ success: true }, { headers: noStore });
}
