import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { taskId, agentId } = await req.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: task }, { data: agent }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", taskId).single(),
    supabase.from("custom_agents").select("*").eq("id", agentId).single(),
  ]);

  if (!task || !agent) {
    return new Response(JSON.stringify({ error: "Task or agent not found" }), {
      status: 404,
    });
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: agent.system_prompt,
    prompt: `Voici la tâche qui te est assignée :

**Titre :** ${task.title}
**Description :** ${task.description ?? "(aucune description)"}
**Statut actuel :** ${task.status}

Réalise cette tâche de façon concrète et détaillée. Produis un résultat directement exploitable.`,
  });

  return result.toDataStreamResponse();
}
