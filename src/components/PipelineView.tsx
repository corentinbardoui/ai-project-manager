"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings2, User, FileText, Trash2,
  Play, CalendarClock, CheckCheck, Undo2, MoveRight, SlidersHorizontal, Loader2, ChevronLeft, ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Task, TaskStatus, CustomAgent } from "@/types/database";
import { createPortal } from "react-dom";

interface PipelineViewProps {
  tasks: Task[];
  runningTasks: Record<string, string>;
  onTaskClick: (task: Task) => void;
  onManageAgents: () => void;
  onDeleteTask: (id: string) => void;
  onRunAgent: (taskId: string, agentId: string) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
}

function formatDueDate(dateStr: string): { label: string; overdue: boolean } {
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  const overdue = diffDays < 0;
  if (diffDays === 0) return { label: "Aujourd'hui", overdue: false };
  if (diffDays === 1) return { label: "Demain", overdue: false };
  if (diffDays === -1) return { label: "Hier", overdue: true };
  if (overdue) return { label: `${Math.abs(diffDays)}j de retard`, overdue: true };
  if (diffDays <= 7) return { label: `Dans ${diffDays}j`, overdue: false };
  return { label: due.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), overdue: false };
}

type CardSection = "backlog" | "todo" | "active_running" | "active_validate" | "done";

// ── Column animation hook ──────────────────────────────────────────────────────
// Tracks enter/exit for each task list, enabling per-card entry stagger and
// height-collapsing exit animations without a motion library.

type AnimItem = { task: Task; entering: boolean; exiting: boolean; enterIdx: number };

function useColumnAnimation(tasks: Task[]): AnimItem[] {
  const [items, setItems] = useState<AnimItem[]>(() =>
    tasks.map(t => ({ task: t, entering: false, exiting: false, enterIdx: 0 }))
  );
  const isFirst = useRef(true);
  const prevMap = useRef(new Map(tasks.map(t => [t.id, t])));
  const prevOrder = useRef<Task[]>([...tasks]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tasksRef = useRef(tasks);
  // Sync without a dependency so we can read current items inside the effect
  // without adding `items` as a dependency (which would cause the loop).
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Keep ref fresh so the exit timer always sees latest tasks
  useEffect(() => { tasksRef.current = tasks; });

  useEffect(() => {
    const curr = new Map(tasks.map(t => [t.id, t]));
    const prev = prevMap.current;

    const entering = isFirst.current ? [] : tasks.filter(t => !prev.has(t.id));
    const hasExiting = !isFirst.current && [...prev.keys()].some(id => !curr.has(id));
    isFirst.current = false;
    prevMap.current = curr;

    if (!hasExiting && entering.length === 0) {
      // Data-only path: `.filter()` always returns a new array reference even when
      // nothing changed, so we must guard against calling setItems unnecessarily —
      // otherwise every render triggers setItems → re-render → infinite loop.
      const needsUpdate = itemsRef.current.some(
        item => curr.get(item.task.id) !== item.task
      );
      if (needsUpdate) {
        setItems(tasks.map(t => ({ task: t, entering: false, exiting: false, enterIdx: 0 })));
      }
      prevOrder.current = [...tasks];
      return;
    }

    const enterSet = new Set(entering.map(t => t.id));
    const prevOrderIds = new Set(prevOrder.current.map(t => t.id));
    let eIdx = 0;

    // Preserve prev order: still-present items stay in place, departed ones become exiting
    const merged: AnimItem[] = [
      ...prevOrder.current.map(t => {
        const live = curr.get(t.id);
        if (live) {
          const isEntering = enterSet.has(live.id);
          return { task: live, entering: isEntering, exiting: false, enterIdx: isEntering ? eIdx++ : 0 };
        }
        return { task: t, entering: false, exiting: true, enterIdx: 0 };
      }),
      // Newly added tasks that weren't in prev order at all
      ...entering
        .filter(t => !prevOrderIds.has(t.id))
        .map(t => ({ task: t, entering: true, exiting: false, enterIdx: eIdx++ })),
    ];

    setItems(merged);
    prevOrder.current = [...tasks];

    // Remove exiting items after their animation completes
    if (hasExiting) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setItems(tasksRef.current.map(t => ({ task: t, entering: false, exiting: false, enterIdx: 0 })));
      }, 280);
    }
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return items;
}

// ── Card animation wrapper ─────────────────────────────────────────────────────
// Entry: fade + slide up + spring scale, staggered by enterIdx.
// Exit: fade + slight shrink + height collapse (grid trick — no fixed heights needed).

function CardAnimWrapper({ entering, exiting, enterIdx, children }: {
  entering: boolean;
  exiting: boolean;
  enterIdx: number;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(!entering);

  useEffect(() => {
    if (!entering) return;
    // Small frame delay + stagger so cards entering in a batch ripple in
    const t = setTimeout(() => setVisible(true), 16 + enterIdx * 50);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const delay = `${enterIdx * 50}ms`;

  return (
    // Outer wrapper handles height collapse
    <div
      style={{
        display: "grid",
        gridTemplateRows: exiting ? "0fr" : "1fr",
        transition: exiting
          ? "grid-template-rows 0.22s ease 0.08s"
          : "none",
      }}
    >
      {/* min-h-0 required for grid collapse trick */}
      <div style={{ overflow: "hidden", minHeight: 0 }}>
        {/* Inner wrapper holds bottom spacing + opacity/scale animation */}
        <div
          style={{
            paddingBottom: "6px",
            opacity: exiting ? 0 : visible ? 1 : 0,
            transform: exiting
              ? "translateY(-3px) scale(0.96)"
              : visible
              ? "translateY(0px) scale(1)"
              : "translateY(10px) scale(0.96)",
            transition: exiting
              ? "opacity 0.14s ease, transform 0.14s ease"
              : visible
              ? `opacity 0.26s ease, transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}`
              : "none",
            pointerEvents: exiting ? "none" : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Compact pipeline card ──────────────────────────────────────────────────────
interface PipelineCardProps {
  task: Task;
  agents: Record<string, CustomAgent>;
  isRunning: boolean;
  section: CardSection;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onRunAgent: (taskId: string, agentId: string) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
}

function PipelineCard({
  task, agents, isRunning, section,
  onTaskClick, onDeleteTask, onRunAgent, onMoveTask,
}: PipelineCardProps) {
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);

  const assignedAgent = task.assigned_agent_id ? agents[task.assigned_agent_id] : null;
  const due = task.due_date ? formatDueDate(task.due_date) : null;
  const agentList = Object.values(agents);

  useEffect(() => {
    if (!showAgentPicker) return;
    const handler = () => setShowAgentPicker(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showAgentPicker]);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;
    if (assignedAgent) {
      onRunAgent(task.id, task.assigned_agent_id!);
    } else {
      setPickerRect(playBtnRef.current?.getBoundingClientRect() ?? null);
      setShowAgentPicker((v) => !v);
    }
  };

  const cardBase = `relative group rounded-xl border cursor-pointer transition-all overflow-hidden`;
  const cardVariant =
    isRunning
      ? "bg-brand-500/[0.07] border-brand-400/30 ring-1 ring-brand-500/20"
      : section === "active_validate"
      ? "bg-accent-500/[0.04] border-accent-400/20 hover:border-accent-400/35"
      : section === "done"
      ? "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.09]"
      : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.14]";

  return (
    <div onClick={() => { if (!showAgentPicker) onTaskClick(task); }} className={`${cardBase} ${cardVariant}`}>
      {/* Shimmer when running */}
      {isRunning && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          <div className="absolute inset-0 animate-progress-bar"
            style={{ background: "linear-gradient(105deg, transparent 30%, rgba(167,139,250,0.08) 50%, transparent 70%)" }} />
        </div>
      )}

      <div className="relative p-2.5">
        {/* Title row */}
        <div className="flex items-start gap-1.5 pr-6">
          {assignedAgent ? (
            <span className={`text-sm flex-shrink-0 leading-none mt-0.5 ${isRunning ? "animate-pulse" : ""}`}>
              {assignedAgent.emoji}
            </span>
          ) : (
            <User className="w-3 h-3 text-white/20 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-xs font-medium text-white/85 leading-snug line-clamp-2 flex-1">
            {task.title}
          </p>
        </div>

        {task.description && (
          <p className="text-[10px] text-white/30 mt-1 line-clamp-2 leading-snug pl-4">
            {task.description}
          </p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {isRunning && (
            <span className="flex items-center gap-0.5 text-[10px] text-brand-300/60 italic">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              En cours…
            </span>
          )}
          {task.result && !isRunning && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/70 bg-emerald-400/[0.08] rounded-full px-1.5 py-0.5">
              <FileText className="w-2.5 h-2.5" />
              Résultat
            </span>
          )}
          {due && !isRunning && (
            <span className={`flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 ${
              due.overdue ? "text-red-400/80 bg-red-400/[0.08]" : "text-white/30"
            }`}>
              <CalendarClock className="w-2.5 h-2.5" />
              {due.label}
            </span>
          )}
        </div>
      </div>

      {/* Hover actions overlay */}
      <div
        className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-0.5 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {section === "backlog" && (
          <MiniBtn title="→ Prochaines Actions" onClick={() => onMoveTask(task.id, "todo")}>
            <MoveRight className="w-3 h-3" />
          </MiniBtn>
        )}
        {section === "todo" && (
          <button
            ref={playBtnRef}
            onClick={handlePlayClick}
            disabled={isRunning}
            title={assignedAgent ? `Lancer ${assignedAgent.name}` : "Choisir un agent"}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
              assignedAgent
                ? "bg-brand-500/80 hover:bg-brand-500 text-white shadow-sm shadow-brand-500/20"
                : "bg-surface-elevated/90 backdrop-blur-sm hover:bg-surface-card/95 text-white/70 border border-white/[0.12] shadow-sm shadow-black/40"
            }`}
          >
            <Play className="w-2.5 h-2.5" />
            {assignedAgent ? assignedAgent.emoji : "Agent"}
          </button>
        )}
        {section === "active_validate" && (
          <MiniBtn
            title="Valider → Archives"
            onClick={() => onMoveTask(task.id, "done")}
            className="text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20"
          >
            <CheckCheck className="w-3 h-3" />
          </MiniBtn>
        )}
        {(section === "active_validate" || section === "active_running") && !isRunning && (
          <MiniBtn title="↩ Rerouter" onClick={() => onMoveTask(task.id, "todo")}>
            <Undo2 className="w-3 h-3" />
          </MiniBtn>
        )}
        {section === "done" && (
          <MiniBtn title="Restaurer" onClick={() => onMoveTask(task.id, "todo")}>
            <Undo2 className="w-3 h-3" />
          </MiniBtn>
        )}
        <MiniBtn
          title="Supprimer"
          onClick={() => onDeleteTask(task.id)}
          className="hover:bg-red-500/20 hover:text-red-400"
        >
          <Trash2 className="w-3 h-3" />
        </MiniBtn>
      </div>

      {/* Agent picker portal */}
      {showAgentPicker && agentList.length > 0 && pickerRect && createPortal(
        <div
          style={{ position: "fixed", top: pickerRect.bottom + 6, right: window.innerWidth - pickerRect.right }}
          className="w-44 bg-surface-elevated/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 z-[9999] py-1.5 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {agentList.map((agent) => (
            <button key={agent.id} onClick={(e) => { e.stopPropagation(); setShowAgentPicker(false); onRunAgent(task.id, agent.id); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.06] transition-colors text-xs">
              <span className="text-base leading-none">{agent.emoji}</span>
              <div className="min-w-0">
                <p className="text-white/80 font-medium truncate">{agent.name}</p>
                <p className="text-white/30 truncate">{agent.handle}</p>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function MiniBtn({ onClick, title, children, className = "" }: {
  onClick: () => void; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <button title={title} onClick={onClick}
      className={`p-1 rounded-lg text-white/50 border border-white/[0.12] bg-surface-elevated/90 backdrop-blur-sm hover:bg-surface-card/95 hover:text-white/80 transition-all shadow-sm shadow-black/40 ${className}`}>
      {children}
    </button>
  );
}

// ── Collapsible side column (Backlog / Archives) ──────────────────────────────
function SideColumn({ label, count, accent, dot, collapsed, onToggle, hasExiting, children }: {
  label: string; count: number; accent: string; dot: string;
  collapsed: boolean; onToggle: () => void; hasExiting?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`flex-shrink-0 flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] transition-all duration-300 overflow-hidden ${collapsed ? "w-12" : "w-56"}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between px-3 py-3 hover:bg-white/[0.03] transition-colors flex-shrink-0"
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${accent} [writing-mode:vertical-rl] rotate-180`}>
              {label}
            </span>
            <span className="text-[10px] text-white/30 tabular-nums mt-auto">{count}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
              <span className={`text-xs font-semibold uppercase tracking-widest ${accent}`}>{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/30 tabular-nums bg-white/[0.05] rounded-full px-1.5 py-0.5">{count}</span>
              <ChevronLeft className="w-3 h-3 text-white/25" />
            </div>
          </>
        )}
      </button>

      {/* Cards */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col">
          {count === 0 && !hasExiting
            ? <p className="text-[10px] text-white/15 italic px-1 py-2">Aucune tâche</p>
            : children}
        </div>
      )}
    </div>
  );
}

// ── Main column (Prochaines Actions / Zone Active) ────────────────────────────
function MainColumn({ label, sublabel, count, dot, accent, isFocus, children }: {
  label: string; sublabel?: string; count: number; dot: string; accent: string;
  isFocus?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col min-w-0 flex-1 rounded-2xl border transition-all ${
      isFocus ? "border-white/[0.10] bg-white/[0.025]" : "border-white/[0.07] bg-white/[0.02]"
    }`}>
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/[0.05] flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-widest ${accent}`}>{label}</span>
        {sublabel && <span className="text-xs text-white/20 normal-case tracking-normal font-normal">{sublabel}</span>}
        <span className="ml-auto text-xs text-white/30 tabular-nums bg-white/[0.05] rounded-full px-1.5 py-0.5">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {children}
      </div>
    </div>
  );
}

// ── Sub-section inside Zone Active ────────────────────────────────────────────
function SubSection({ label, count, dot, hasExiting, children }: {
  label: string; count: number; dot: string; hasExiting?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-1 mb-1.5">
        <span className={`w-1 h-1 rounded-full ${dot}`} />
        <span className="text-[10px] text-white/35 font-medium uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-white/20 tabular-nums">{count}</span>
      </div>
      {count === 0 && !hasExiting
        ? <p className="text-[10px] text-white/15 italic px-2 py-1">Aucune tâche</p>
        : <div className="flex flex-col">{children}</div>}
    </div>
  );
}

// ── Main PipelineView ──────────────────────────────────────────────────────────
export default function PipelineView({
  tasks, runningTasks, onTaskClick, onManageAgents, onDeleteTask, onRunAgent, onMoveTask,
}: PipelineViewProps) {
  const [agents, setAgents] = useState<Record<string, CustomAgent>>({});
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterBtnRect, setFilterBtnRect] = useState<DOMRect | null>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const [backlogCollapsed, setBacklogCollapsed] = useState(false);
  const [archivesCollapsed, setArchivesCollapsed] = useState(true);

  useEffect(() => {
    supabase.from("custom_agents").select("*").then(({ data }) => {
      if (data) {
        const map: Record<string, CustomAgent> = {};
        for (const a of data as CustomAgent[]) map[a.id] = a;
        setAgents(map);
      }
    });
  }, []);

  const agentList = Object.values(agents);
  const runningSet = new Set(Object.keys(runningTasks));

  useEffect(() => {
    if (!showFilterDropdown) return;
    const handler = () => setShowFilterDropdown(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showFilterDropdown]);

  const applyFilter = useCallback(
    (list: Task[]) =>
      filterAgentId
        ? list.filter((t) => t.assigned_agent_id === filterAgentId || t.created_by_agent_id === filterAgentId)
        : list,
    [filterAgentId]
  );

  const backlogTasks  = applyFilter(tasks.filter((t) => t.status === "backlog"));
  const validateTasks = applyFilter(tasks.filter((t) =>
    t.status !== "done" && t.status !== "backlog" && !!t.result && !runningSet.has(t.id)
  ));
  const runningActive = applyFilter(tasks.filter((t) => runningSet.has(t.id)));
  const nextTasks     = applyFilter(tasks.filter((t) =>
    t.status === "todo" && !t.result && !runningSet.has(t.id)
  ));
  const doneTasks     = applyFilter(tasks.filter((t) => t.status === "done"));
  const activeTotal   = runningActive.length + validateTasks.length;

  // Per-column animation state
  const backlogItems  = useColumnAnimation(backlogTasks);
  const nextItems     = useColumnAnimation(nextTasks);
  const runningItems  = useColumnAnimation(runningActive);
  const validateItems = useColumnAnimation(validateTasks);
  const doneItems     = useColumnAnimation(doneTasks);

  const sharedProps = { agents, onTaskClick, onDeleteTask, onRunAgent, onMoveTask };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl flex items-center gap-3 flex-shrink-0">
        <h1 className="text-sm font-semibold text-white/70 flex-shrink-0">Board</h1>

        <div className="flex items-center gap-2 ml-auto">
          {/* Agent filter dropdown */}
          {agentList.length > 0 && (
            <div className="relative">
              <button
                ref={filterBtnRef}
                onClick={() => {
                  setFilterBtnRect(filterBtnRef.current?.getBoundingClientRect() ?? null);
                  setShowFilterDropdown((v) => !v);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  filterAgentId
                    ? "bg-brand-500/20 text-brand-200 border-brand-400/30"
                    : "text-white/40 hover:text-white/70 border-white/[0.08] hover:bg-white/[0.05]"
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>
                  {filterAgentId ? (agents[filterAgentId]?.emoji + " " + agents[filterAgentId]?.name) : "Filtre"}
                </span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>

              {showFilterDropdown && filterBtnRect && createPortal(
                <div
                  style={{ position: "fixed", top: filterBtnRect.bottom + 6, right: window.innerWidth - filterBtnRect.right }}
                  className="w-44 bg-surface-elevated/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 z-[9999] py-1.5 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setFilterAgentId(null); setShowFilterDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      filterAgentId === null ? "text-white/90 bg-white/[0.07]" : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                    }`}
                  >
                    Tous les agents
                  </button>
                  {agentList.map((a) => (
                    <button key={a.id}
                      onClick={() => { setFilterAgentId(filterAgentId === a.id ? null : a.id); setShowFilterDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                        filterAgentId === a.id ? "text-brand-200 bg-brand-500/15" : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="text-base leading-none">{a.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.name}</p>
                        <p className="text-white/30 truncate">{a.handle}</p>
                      </div>
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>
          )}

          <button onClick={onManageAgents}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.05]">
            <Settings2 className="w-3.5 h-3.5" />Agents
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-hidden flex gap-2.5 p-3">

        {/* Backlog */}
        <SideColumn
          label="Backlog" count={backlogTasks.length}
          dot="bg-slate-500" accent="text-slate-400"
          collapsed={backlogCollapsed} onToggle={() => setBacklogCollapsed((v) => !v)}
          hasExiting={backlogItems.some(i => i.exiting)}
        >
          {backlogItems.map(({ task: t, entering, exiting, enterIdx }) => (
            <CardAnimWrapper key={t.id} entering={entering} exiting={exiting} enterIdx={enterIdx}>
              <PipelineCard task={t} isRunning={false} section="backlog" {...sharedProps} />
            </CardAnimWrapper>
          ))}
        </SideColumn>

        {/* Prochaines Actions */}
        <MainColumn label="Prochaines Actions" count={nextTasks.length} dot="bg-blue-400" accent="text-blue-400/80">
          {nextItems.length === 0
            ? <p className="text-xs text-white/15 italic px-1 py-2">Aucune tâche prête</p>
            : <div className="flex flex-col">
                {nextItems.map(({ task: t, entering, exiting, enterIdx }) => (
                  <CardAnimWrapper key={t.id} entering={entering} exiting={exiting} enterIdx={enterIdx}>
                    <PipelineCard task={t} isRunning={false} section="todo" {...sharedProps} />
                  </CardAnimWrapper>
                ))}
              </div>
          }
        </MainColumn>

        {/* Zone Active */}
        <MainColumn label="Zone Active" count={activeTotal} dot="bg-brand-400" accent="text-brand-400/80" isFocus>
          <SubSection
            label="L'IA travaille" count={runningActive.length} dot="bg-brand-400 animate-pulse"
            hasExiting={runningItems.some(i => i.exiting)}
          >
            {runningItems.map(({ task: t, entering, exiting, enterIdx }) => (
              <CardAnimWrapper key={t.id} entering={entering} exiting={exiting} enterIdx={enterIdx}>
                <PipelineCard task={t} isRunning={true} section="active_running" {...sharedProps} />
              </CardAnimWrapper>
            ))}
          </SubSection>

          <div className="border-t border-white/[0.05] my-2" />

          <SubSection
            label="À valider par vous" count={validateTasks.length} dot="bg-accent-400"
            hasExiting={validateItems.some(i => i.exiting)}
          >
            {validateItems.map(({ task: t, entering, exiting, enterIdx }) => (
              <CardAnimWrapper key={t.id} entering={entering} exiting={exiting} enterIdx={enterIdx}>
                <PipelineCard task={t} isRunning={false} section="active_validate" {...sharedProps} />
              </CardAnimWrapper>
            ))}
          </SubSection>
        </MainColumn>

        {/* Archives */}
        <SideColumn
          label="Archives" count={doneTasks.length}
          dot="bg-emerald-500" accent="text-emerald-400"
          collapsed={archivesCollapsed} onToggle={() => setArchivesCollapsed((v) => !v)}
          hasExiting={doneItems.some(i => i.exiting)}
        >
          {doneItems.map(({ task: t, entering, exiting, enterIdx }) => (
            <CardAnimWrapper key={t.id} entering={entering} exiting={exiting} enterIdx={enterIdx}>
              <PipelineCard task={t} isRunning={false} section="done" {...sharedProps} />
            </CardAnimWrapper>
          ))}
        </SideColumn>

      </div>
    </div>
  );
}
