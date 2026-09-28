import { supabase, isSupabaseConfigured } from "./supabase";
import type { DesignDocument } from "@/stores/planner-store";

export type SavedDesign = {
  id: string;
  user_id: string;
  title: string;
  design_data: DesignDocument;
  created_at: string;
  updated_at: string;
};

function getSupabaseOrThrow() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Please set up environment variables.");
  }
  return supabase;
}

export async function saveDesignToCloud(
  userId: string,
  design: DesignDocument,
  designId?: string,
): Promise<SavedDesign> {
  const client = getSupabaseOrThrow();
  const payload = {
    user_id: userId,
    title: design.title,
    design_data: design,
  };

  if (designId) {
    const { data, error } = await client
      .from("saved_designs")
      .update(payload)
      .eq("id", designId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await client
    .from("saved_designs")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function loadDesignFromCloud(
  userId: string,
  designId: string,
): Promise<SavedDesign | null> {
  const client = getSupabaseOrThrow();
  const { data, error } = await client
    .from("saved_designs")
    .select("*")
    .eq("id", designId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data;
}

export async function listUserDesigns(userId: string): Promise<SavedDesign[]> {
  const client = getSupabaseOrThrow();
  const { data, error } = await client
    .from("saved_designs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteDesignFromCloud(
  userId: string,
  designId: string,
): Promise<void> {
  const client = getSupabaseOrThrow();
  const { error } = await client
    .from("saved_designs")
    .delete()
    .eq("id", designId)
    .eq("user_id", userId);

  if (error) throw error;
}
