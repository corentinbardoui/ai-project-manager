import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool, convertToCoreMessages } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SHADOW_PREFIX, ONBOARDING_TRIGGER, DEFAULT_SYSTEM_PROMPT, ONBOARDING_SYSTEM_PROMPT } from "@/lib/agents";
import type { Task } from "@/types/database";
import type { ProjectContext } from "@/lib/projectContext";

export const maxDuration = 60;

const PIPELINE_STATUSES = ["backlog", "todo", "in_progress", "done"] as const;
type PipelineStatus = typeof PIPELINE_STATUSES[number];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const { messages, tasks, agentId, isOnboarding, projectContext, workspaceId } = await req.json() as {
    messages: { role: string; content: string }[];
    tasks: Task[];
    agentId: string;
    isOnboarding: boolean;
    projectContext: ProjectContext | null;
    workspaceId: string | null;
  };

  console.log("[api/chat] agentId:", agentId, "| onboarding:", isOnboarding, "| messages:", messages.length);

  const supabase = getSupabase();

  let systemPrompt: string;

  if (isOnboarding) {
    systemPrompt = ONBOARDING_SYSTEM_PROMPT;
  } else {
    const { data: customAgent } = await supabase
      .from("custom_agents")
      .select("system_prompt")
      .eq("id", agentId)
      .single();
    const agentPrompt = customAgent?.system_prompt ?? DEFAULT_SYSTEM_PROMPT;

    const contextSection = projectContext
      ? `\n\n## Contexte du projet\n**Projet :** ${projectContext.project_name}\n**Description :** ${projectContext.description}\n**Profil utilisateur :** ${projectContext.user_profile}\n**Objectif :** ${projectContext.objective}${projectContext.constraints ? `\n**Contraintes :** ${projectContext.constraints}` : ""}`
      : "";

    const boardSnapshot = JSON.stringify(
      tasks.slice(0, 15).map((t) => ({ id: t.id, title: t.title, status: t.status }))
    );

    systemPrompt = agentPrompt + contextSection + `\n\n## Pipeline (${tasks.length} tâches total, 15 premières)\n${boardSnapshot}`;
  }

  const allProcessed = messages.map(
    (msg: { role: string; content: string }) => {
      if (msg.role === "user" && msg.content === ONBOARDING_TRIGGER) {
        return { ...msg, content: "Démarre la configuration de l'espace de travail." };
      }
      if (msg.role === "user" && msg.content.startsWith(SHADOW_PREFIX)) {
        return {
          ...msg,
          content: `[Événement pipeline automatique] ${msg.content.replace(SHADOW_PREFIX, "")} Réagis brièvement et réévalue les priorités si nécessaire.`,
        };
      }
      return msg;
    }
  );
  const processedMessages = allProcessed.slice(-4) as { role: "user" | "assistant" | "system"; content: string }[];

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: convertToCoreMessages(processedMessages),
    tools: {
      propose_tasks: tool({
        description:
          "Propose des tâches à l'utilisateur sous forme de cartes dans le chat. NE les ajoute PAS en base — l'utilisateur choisit quelles tâches ajouter au board en cliquant sur le bouton.",
        parameters: z.object({
          tasks: z.array(z.object({
            title: z.string().describe("Titre court et clair de la tâche"),
            description: z.string().optional().describe("Description détaillée optionnelle"),
            status: z.enum(["backlog", "todo"]).default("backlog").describe("Section suggérée"),
          })).describe("Liste de tâches à proposer à l'utilisateur"),
        }),
        execute: async ({ tasks }) => ({ proposed: tasks }),
      }),

      reprioritize_tasks: tool({
        description:
          "Réévalue les priorités du pipeline. Passe les tâches les plus urgentes/actionnables en `todo` (Prochaines Actions, max 5). Remet le reste en `backlog`.",
        parameters: z.object({
          promote_ids: z
            .array(z.string())
            .max(5)
            .describe("IDs des tâches à promouvoir en `todo` — max 5, les plus urgentes en premier"),
          reasoning: z
            .string()
            .describe("Explication courte du choix de priorisation"),
        }),
        execute: async ({ promote_ids, reasoning }) => {
          const repriQuery = supabase.from("tasks").select("id, status").in("status", ["backlog", "todo"]);
          if (workspaceId) repriQuery.eq("workspace_id", workspaceId);
          const { data: candidates } = await repriQuery;

          if (!candidates) return { success: false, error: "No candidates found" };

          const promoteSet = new Set(promote_ids);
          const updates = candidates.map((t) => ({
            id: t.id,
            status: promoteSet.has(t.id) ? "todo" : "backlog" as PipelineStatus,
          }));

          await Promise.all(
            updates.map((u) =>
              supabase.from("tasks").update({ status: u.status }).eq("id", u.id)
            )
          );

          return {
            success: true,
            promoted: promote_ids.length,
            demoted: updates.length - promote_ids.length,
            reasoning,
          };
        },
      }),

      update_task_status: tool({
        description:
          "Déplace une tâche vers une autre section du pipeline. IMPORTANT : ne jamais utiliser 'done' — seul l'utilisateur peut archiver une tâche après validation manuelle.",
        parameters: z.object({
          id: z.string().describe("L'identifiant UUID de la tâche"),
          new_status: z
            .enum(["backlog", "todo", "in_progress", "done"])
            .describe("Nouvelle section du pipeline"),
        }),
        execute: async ({ id, new_status }) => {
          if (new_status === "done") {
            return {
              success: false,
              message: "Impossible de déplacer une tâche en Archives automatiquement. Seul l'utilisateur peut archiver.",
            };
          }

          const { data, error } = await supabase
            .from("tasks")
            .update({ status: new_status })
            .eq("id", id)
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, task: data };
        },
      }),

      delete_task: tool({
        description: "Supprime une tâche du pipeline.",
        parameters: z.object({
          id: z.string().describe("L'identifiant UUID de la tâche à supprimer"),
        }),
        execute: async ({ id }) => {
          const { error } = await supabase.from("tasks").delete().eq("id", id);
          if (error) return { success: false, error: error.message };
          return { success: true };
        },
      }),

      summarize_board: tool({
        description:
          "Lit l'état actuel du pipeline pour répondre aux questions, faire des statistiques ou des recommandations.",
        parameters: z.object({}),
        execute: async () => {
          const summQuery = supabase.from("tasks").select("id,title,status,due_date,assigned_agent_id").order("position", { ascending: true });
          if (workspaceId) summQuery.eq("workspace_id", workspaceId);
          const { data, error } = await summQuery;

          if (error) return { success: false, error: error.message };

          const slim = (list: typeof data) =>
            list?.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date }));

          return {
            success: true,
            backlog:      slim(data?.filter((t) => t.status === "backlog") ?? []),
            todo:         slim(data?.filter((t) => t.status === "todo") ?? []),
            in_progress:  slim(data?.filter((t) => t.status === "in_progress") ?? []),
            done:         slim(data?.filter((t) => t.status === "done") ?? []),
          };
        },
      }),

      save_project_context: tool({
        description: "Sauvegarde le contexte du projet après l'onboarding.",
        parameters: z.object({
          project_name: z.string().describe("Nom court du projet"),
          description:  z.string().describe("Description du projet en 2-3 phrases"),
          user_profile: z.string().describe("Rôle et profil de l'utilisateur"),
          objective:    z.string().describe("Objectif principal et échéance si mentionnée"),
          constraints:  z.string().optional().describe("Contraintes importantes si mentionnées"),
        }),
        execute: async (ctx) => {
          const { error } = await supabase.from("app_settings").upsert({
            key: "project_context",
            value: ctx,
            updated_at: new Date().toISOString(),
          });
          if (error) return { success: false, error: error.message };
          return { success: true };
        },
      }),
    },
    maxSteps: 4,
    onError: (err) => console.error("[api/chat] streamText error:", err),
    onFinish: ({ text, finishReason, usage }) =>
      console.log("[api/chat] done | reason:", finishReason, "| tokens:", usage, "| text len:", text.length),
  });

  return result.toDataStreamResponse({
    getErrorMessage: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[api/chat] stream error forwarded to client:", msg);
      return msg;
    },
  });
}
