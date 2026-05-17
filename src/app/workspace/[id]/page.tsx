"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Task, TaskStatus, Workspace } from "@/types/database";

import ChatPanel from "@/components/ChatPanel";
import PipelineView from "@/components/PipelineView";
import TaskModal from "@/components/TaskModal";
import AgentManager from "@/components/AgentManager";

export default function WorkspacePage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lastBoardEvent, setLastBoardEvent] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAgentManager, setShowAgentManager] = useState(false);
  const [runningTasks, setRunningTasks] = useState<Record<string, string>>({});

  // Load workspace metadata
  useEffect(() => {
    supabase.from("workspaces").select("*").eq("id", workspaceId).single()
      .then(({ data }) => { if (data) setWorkspace(data as Workspace); });
  }, [workspaceId]);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true });
    if (!error && data) setTasks(data as Task[]);
  }, [workspaceId]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel(`tasks-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const t = payload.new as Task;
          if (t.workspace_id === workspaceId) setTasks((prev) => [...prev, t]);
        } else if (payload.eventType === "UPDATE") {
          const incoming = payload.new as Task;
          setTasks((prev) => prev.map((t) => {
            if (t.id !== incoming.id) return t;
            // Merge instead of replace: Supabase Realtime may omit large fields
            // (e.g. `result`) when the payload exceeds the message size limit.
            return { ...t, ...incoming, result: incoming.result ?? t.result };
          }));
        } else if (payload.eventType === "DELETE") {
          setTasks((prev) => prev.filter((t) => t.id !== (payload.old as Task).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks, workspaceId]);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTask((prev) => (prev?.id === id ? null : prev));
  }, []);

  const startTaskRun = useCallback(async (taskId: string, runAgentId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task?.status === "todo" || task?.status === "backlog") {
      await supabase.from("tasks").update({ status: "in_progress", assigned_agent_id: runAgentId }).eq("id", taskId);
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "in_progress", assigned_agent_id: runAgentId } : t));
    }

    setRunningTasks((prev) => ({ ...prev, [taskId]: "" }));
    try {
      const response = await fetch("/api/task/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId: runAgentId }),
      });
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split("\n")) {
          if (line.startsWith("0:")) {
            try { accumulated += JSON.parse(line.slice(2)); } catch { /* skip */ }
          }
        }
        setRunningTasks((prev) => ({ ...prev, [taskId]: accumulated }));
      }

      await supabase.from("tasks").update({ result: accumulated }).eq("id", taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, result: accumulated } : t)));
      setSelectedTask((prev) => prev?.id === taskId ? { ...prev, result: accumulated } : prev);
      setLastBoardEvent(`Agent a terminé la tâche "${task?.title ?? taskId}".`);
    } finally {
      setRunningTasks((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const handleMoveTask = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    setSelectedTask((prev) => prev?.id === taskId ? { ...prev, status: newStatus } : prev);

    const task = tasks.find((t) => t.id === taskId);
    const labels: Record<string, string> = {
      backlog: "Backlog", todo: "Prochaines Actions", in_progress: "Zone Active", done: "Archives",
    };
    if (task) {
      const msg = `Tâche "${task.title}" déplacée vers "${labels[newStatus] ?? newStatus}".`;
      if (newStatus === "done") {
        setLastBoardEvent(msg + " Réévalue maintenant les priorités : quelles tâches du backlog doivent passer en Prochaines Actions ?");
      } else {
        setLastBoardEvent(msg);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const handleTaskUpdate = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Workspace top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.05] bg-black/10 flex-shrink-0">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Espaces
        </button>
        {workspace && (
          <>
            <span className="text-white/10">·</span>
            <span className="text-xs text-white/40 font-medium">{workspace.emoji} {workspace.name}</span>
          </>
        )}
      </div>

      {/* App */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[25%] min-w-[280px] flex flex-col">
          <ChatPanel
            lastBoardEvent={lastBoardEvent}
            tasks={tasks}
            agentId={agentId}
            onAgentChange={setAgentId}
            workspaceId={workspaceId}
          />
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <PipelineView
            tasks={tasks}
            runningTasks={runningTasks}
            onTaskClick={setSelectedTask}
            onManageAgents={() => setShowAgentManager(true)}
            onDeleteTask={deleteTask}
            onRunAgent={startTaskRun}
            onMoveTask={handleMoveTask}
          />
        </div>
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isRunning={!!runningTasks[selectedTask.id]}
          streamingResult={runningTasks[selectedTask.id]}
          onRunAgent={(runAgentId) => startTaskRun(selectedTask.id, runAgentId)}
          onClose={() => setSelectedTask(null)}
          onDelete={deleteTask}
          onUpdate={handleTaskUpdate}
        />
      )}

      {showAgentManager && (
        <AgentManager onClose={() => setShowAgentManager(false)} />
      )}
    </div>
  );
}
