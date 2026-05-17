"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, FolderOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Workspace } from "@/types/database";
import WorkspaceSetup from "@/components/WorkspaceSetup";

export default function Dashboard() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setWorkspaces(data as Workspace[]);
          // Fetch task counts per workspace
          if (data.length > 0) {
            const ids = data.map((w) => w.id);
            supabase
              .from("tasks")
              .select("workspace_id")
              .in("workspace_id", ids)
              .then(({ data: tasks }) => {
                if (tasks) {
                  const counts: Record<string, number> = {};
                  for (const t of tasks) if (t.workspace_id) counts[t.workspace_id] = (counts[t.workspace_id] ?? 0) + 1;
                  setTaskCounts(counts);
                }
              });
          }
        }
        setLoading(false);
      });
  }, []);

  const handleSetupComplete = (id: string) => {
    router.push(`/workspace/${id}`);
  };

  if (showSetup) {
    return <WorkspaceSetup onComplete={handleSetupComplete} onCancel={() => setShowSetup(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[400px] bg-brand-600/[0.05] rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/[0.04] rounded-full blur-3xl translate-y-1/3" />
      </div>

      {/* Header */}
      <div className="px-8 py-6 flex-shrink-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-400/20 flex items-center justify-center text-base">⚡</div>
            <span className="text-sm font-semibold text-white/50 tracking-wide">AI Project Manager</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 pb-12 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-white/85 mb-2">Mes espaces de travail</h1>
            <p className="text-sm text-white/35">
              {loading ? "Chargement…" : workspaces.length === 0 ? "Créez votre premier espace pour commencer." : `${workspaces.length} espace${workspaces.length > 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* New workspace */}
            <button
              onClick={() => setShowSetup(true)}
              className="group h-48 rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-brand-400/35 hover:bg-brand-500/[0.03] transition-all flex flex-col items-center justify-center gap-3"
            >
              <div className="w-11 h-11 rounded-xl border-2 border-dashed border-white/[0.12] group-hover:border-brand-400/40 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5 text-white/25 group-hover:text-brand-400/70 transition-colors" />
              </div>
              <span className="text-sm font-medium text-white/25 group-hover:text-brand-400/70 transition-colors">
                Nouvel espace de travail
              </span>
            </button>

            {/* Workspace cards */}
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => router.push(`/workspace/${ws.id}`)}
                className="group h-48 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] transition-all text-left p-5 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl leading-none">{ws.emoji}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-brand-400/60" />
                  </div>
                </div>

                <h3 className="font-semibold text-white/85 text-sm mb-1.5 line-clamp-1">{ws.name}</h3>

                {ws.description && (
                  <p className="text-xs text-white/35 line-clamp-2 leading-relaxed flex-1">{ws.description}</p>
                )}
                {!ws.description && <div className="flex-1" />}

                <div className="mt-auto pt-3 border-t border-white/[0.05] flex items-center justify-between">
                  <span className="text-[10px] text-white/25">
                    {new Date(ws.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </span>
                  {taskCounts[ws.id] != null && (
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <FolderOpen className="w-3 h-3" />
                      {taskCounts[ws.id]} tâche{taskCounts[ws.id] > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
