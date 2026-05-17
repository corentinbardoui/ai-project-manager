import { supabase } from "./supabase";

export interface ProjectContext {
  project_name: string;
  description: string;
  user_profile: string;
  objective: string;
  constraints?: string;
}

export async function fetchProjectContext(): Promise<ProjectContext | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "project_context")
    .single();
  return (data?.value as ProjectContext) ?? null;
}
