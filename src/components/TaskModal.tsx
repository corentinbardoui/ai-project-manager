"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trash2, Play, Bot, User, Loader2, ChevronDown, MessageSquarePlus, Save, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Task, TaskStatus, CustomAgent } from "@/types/database";
import RichTextEditor from "./RichTextEditor";

interface TaskModalProps {
  task: Task;
  isRunning: boolean;
  streamingResult: string | undefined;
  onRunAgent: (agentId: string) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updated: Task) => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; dot: string }[] = [
  { value: "backlog",     label: "Backlog",            dot: "bg-slate-500"   },
  { value: "todo",        label: "Prochaines Actions", dot: "bg-blue-400"    },
  { value: "in_progress", label: "Zone Active",        dot: "bg-brand-400"  },
  { value: "done",        label: "Archives",           dot: "bg-emerald-500" },
];

export default function TaskModal({
  task, isRunning, streamingResult, onRunAgent, onClose, onDelete, onUpdate,
}: TaskModalProps) {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [userNotes, setUserNotes] = useState(task.user_notes ?? "");
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(task.assigned_agent_id ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Rich editor state
  const [editorHtml, setEditorHtml] = useState<string>("");
  const [resultSaved, setResultSaved] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);

  // Slide-in trigger
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase
      .from("custom_agents")
      .select("*")
      .order("created_at")
      .then(({ data }) => { if (data) setAgents(data as CustomAgent[]); });
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const save = useCallback(
    async (patch: Partial<Task>) => {
      setIsSaving(true);
      const { data } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", task.id)
        .select()
        .single();
      if (data) onUpdate(data as Task);
      setIsSaving(false);
    },
    [task.id, onUpdate]
  );

  const handleSaveResult = async () => {
    setIsSavingResult(true);
    await save({ result: editorHtml });
    setIsSavingResult(false);
    setResultSaved(true);
    setTimeout(() => setResultSaved(false), 2000);
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);
    save({ status: newStatus });
  };

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    save({ assigned_agent_id: agentId || null });
  };

  const assignedAgent = agents.find((a) => a.id === selectedAgentId);
  const creatorAgent = agents.find((a) => a.id === task.created_by_agent_id);
  const displayResult = streamingResult ?? task.result ?? "";
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status);

  return (
    <>
      {/* Backdrop — covers the pipeline area, not the chat panel */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ease-in-out ${
          visible ? "bg-black/40 backdrop-blur-[1px]" : "bg-transparent"
        }`}
        style={{ left: "max(25%, 280px)", pointerEvents: visible ? "auto" : "none" }}
        onClick={handleClose}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[40%] z-50 flex flex-col
          bg-surface-overlay/98 backdrop-blur-2xl border-l border-white/[0.08]
          shadow-2xl shadow-black/60
          transition-transform duration-300 ease-in-out
          ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex-1 pr-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { if (title !== task.title) save({ title }); }}
              className="w-full text-lg font-semibold text-white/90 bg-transparent outline-none focus:bg-white/[0.04] rounded-xl px-2 py-1 -ml-2 transition-colors placeholder-white/20"
              placeholder="Titre de la tâche"
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isSaving && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />}
            <button
              onClick={() => onDelete(task.id)}
              className="text-white/30 hover:text-red-400 transition-colors p-1.5 hover:bg-white/[0.06] rounded-xl"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="text-white/30 hover:text-white/80 transition-colors p-1.5 hover:bg-white/[0.06] rounded-xl"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata strip — Status / Due / Agent */}
        <div className="px-5 py-3 border-b border-white/[0.05] bg-white/[0.02] flex-shrink-0 flex items-center gap-4 flex-wrap">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentStatus?.dot ?? "bg-slate-400"}`} />
            <div className="relative">
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className="appearance-none bg-white/[0.06] border border-white/[0.08] rounded-xl pl-2.5 pr-6 py-1.5 text-xs text-white/80 outline-none focus:border-white/20 transition-colors cursor-pointer"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
            </div>
          </div>

          {/* Due date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">Échéance</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => save({ due_date: dueDate || null })}
              className="bg-white/[0.06] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-white/80 outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Agent */}
          <div className="flex items-center gap-2 ml-auto">
            <Bot className="w-3.5 h-3.5 text-brand-400/70 flex-shrink-0" />
            <div className="relative">
              <select
                value={selectedAgentId}
                onChange={(e) => handleAgentChange(e.target.value)}
                className="appearance-none bg-white/[0.05] border border-white/[0.08] rounded-xl pl-2.5 pr-6 py-1.5 text-xs text-white/70 outline-none focus:border-white/20 transition-colors max-w-[140px]"
              >
                <option value="">Aucun agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
            </div>
            {selectedAgentId && (
              <button
                onClick={() => onRunAgent(selectedAgentId)}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/80 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-all shadow-sm shadow-brand-500/20"
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {isRunning ? "En cours…" : "Lancer"}
              </button>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Creator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 w-16 flex-shrink-0">Créé par</span>
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              {creatorAgent ? (
                <><span>{creatorAgent.emoji}</span><span>{creatorAgent.name}</span></>
              ) : (
                <><User className="w-3.5 h-3.5" /><span>Vous</span></>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <span className="text-xs text-white/30 block mb-2">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { if (description !== (task.description ?? "")) save({ description }); }}
              rows={3}
              placeholder="Ajoutez une description…"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20 transition-colors resize-none"
            />
          </div>

          {/* Rich text result editor */}
          {(displayResult || isRunning) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-brand-400" />
                  <span className="text-xs text-white/50">
                    Résultat — {assignedAgent?.name ?? "Agent"}
                  </span>
                  {isRunning && (
                    <span className="flex items-center gap-1 text-xs text-brand-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      En cours…
                    </span>
                  )}
                </div>

                {!isRunning && displayResult && (
                  <button
                    onClick={handleSaveResult}
                    disabled={isSavingResult}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      resultSaved
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/[0.06] hover:bg-white/[0.10] text-white/50 hover:text-white/80 border border-white/[0.08]"
                    }`}
                  >
                    {resultSaved ? (
                      <><Check className="w-3 h-3" />Sauvegardé</>
                    ) : isSavingResult ? (
                      <><Loader2 className="w-3 h-3 animate-spin" />Sauvegarde…</>
                    ) : (
                      <><Save className="w-3 h-3" />Sauvegarder</>
                    )}
                  </button>
                )}
              </div>

              <RichTextEditor
                initialMarkdown={task.result ?? ""}
                streamingMarkdown={streamingResult}
                isStreaming={isRunning}
                onChange={setEditorHtml}
              />
            </div>
          )}

          {/* User annotations */}
          {displayResult && !isRunning && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquarePlus className="w-3.5 h-3.5 text-white/25" />
                <span className="text-xs text-white/30">Vos annotations</span>
              </div>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                onBlur={() => save({ user_notes: userNotes || null })}
                rows={3}
                placeholder="Commentaires, corrections, suite à donner…"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20 transition-colors resize-none"
              />
            </div>
          )}

          <div className="text-xs text-white/15 pt-1">
            Créé le {new Date(task.created_at).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </div>
        </div>
      </div>
    </>
  );
}
