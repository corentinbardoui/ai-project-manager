"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { useChat, type Message } from "@ai-sdk/react";
import { Send, Loader2, Zap, History, Plus, X, ArrowDown, Check } from "lucide-react";
import { VelaIcon } from "./VelaIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabase";
import type { Task, Conversation, CustomAgent } from "@/types/database";
import { SHADOW_PREFIX, ONBOARDING_TRIGGER, COLOR_MAP, FALLBACK_AGENT } from "@/lib/agents";
import type { ProjectContext } from "@/lib/projectContext";

interface ChatPanelProps {
  lastBoardEvent: string | null;
  tasks: Task[];
  agentId: string;
  onAgentChange: (id: string) => void;
  workspaceId: string;
}

type AgentDisplay = { id: string; name: string; handle: string; emoji: string; bgColor: string; textColor: string; ringColor: string };

function getAgentDisplay(id: string, customAgents: CustomAgent[]): AgentDisplay {
  const custom = customAgents.find((a) => a.id === id);
  if (custom) {
    const c = COLOR_MAP[custom.color] ?? COLOR_MAP.slate;
    return { id, name: custom.name, handle: custom.handle, emoji: custom.emoji, bgColor: c.bg, textColor: c.text, ringColor: c.ring };
  }
  return { ...FALLBACK_AGENT };
}

// ── Inner chat (remounts on conversation change) ───────────────────────────────
interface ChatInnerProps {
  conversationId: string | null;
  initialMessages: Message[];
  agentId: string;
  agentDisplay: AgentDisplay;
  tasks: Task[];
  onConversationCreate: (id: string) => void;
  pendingShadowEvent: string | null;
  onShadowEventConsumed: () => void;
  projectContext: ProjectContext | null;
  workspaceId: string;
  customAgents: CustomAgent[];
  onAgentChange: (id: string) => void;
}

function ChatInner({
  conversationId,
  initialMessages,
  agentId,
  agentDisplay,
  tasks,
  onConversationCreate,
  pendingShadowEvent,
  onShadowEventConsumed,
  projectContext,
  workspaceId,
  customAgents,
  onAgentChange,
}: ChatInnerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAtBottom = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set());
  const convIdRef = useRef(conversationId);
  const savedMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => { convIdRef.current = conversationId; }, [conversationId]);

  const [chatError, setChatError] = useState<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, status, setInput, append } =
    useChat({
      api: "/api/chat",
      initialMessages,
      body: { tasks, agentId, isOnboarding: false, projectContext, workspaceId },
      experimental_throttle: 80,
      onFinish: () => { setChatError(null); inputRef.current?.focus(); },
      onError: (err) => {
        console.error("[chat] error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        const isRateLimit = msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("load failed");
        setChatError(isRateLimit
          ? "Limite de requêtes atteinte. Patiente quelques secondes et réessaie."
          : `Erreur : ${msg}`
        );
      },
    });

  const isLoading = status === "streaming" || status === "submitted";
  // Only show the "thinking" indicator before the first token arrives
  const isWaiting = status === "submitted";
  const agent = agentDisplay;

  // Persist messages to Supabase
  useEffect(() => {
    const cid = convIdRef.current;
    if (!cid) return;

    for (const msg of messages) {
      const text = msg.parts
        ? msg.parts.filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("\n\n")
        : msg.content;
      if (
        !savedMessageIds.current.has(msg.id) &&
        (msg.role === "user" || msg.role === "assistant") &&
        text
      ) {
        savedMessageIds.current.add(msg.id);
        supabase.from("conversation_messages").insert({
          conversation_id: cid,
          role: msg.role,
          content: text,
        });
      }
    }
  }, [messages]);

  // Shadow loop — auto-send board events to the AI
  useEffect(() => {
    if (!pendingShadowEvent) return;
    append({ role: "user", content: `${SHADOW_PREFIX}${pendingShadowEvent}` });
    onShadowEventConsumed();
  // append is stable — intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShadowEvent, onShadowEventConsumed]);

  // Create conversation on first user message
  // handleSubmit must be called synchronously in the event handler —
  // awaiting before it in React 18 breaks the optimistic UI update.
  const handleSubmitWithHistory = useCallback(
    (e: { preventDefault(): void }) => {
      e.preventDefault();
      if (!input.trim()) return;

      // Submit immediately so the user message appears right away
      isAtBottom.current = true;
      handleSubmit(e);

      // Create conversation record in the background (fire-and-forget)
      if (!convIdRef.current) {
        const title = input.slice(0, 60);
        supabase
          .from("conversations")
          .insert({ title, chat_agent_id: agentId || null })
          .select()
          .single()
          .then(({ data }) => { if (data) onConversationCreate(data.id); });
      }
    },
    [input, agentId, handleSubmit, onConversationCreate]
  );

  const handleAddProposedTask = useCallback(async (
    key: string,
    task: { title: string; description?: string; status: "backlog" | "todo" }
  ) => {
    setAddedTasks((prev) => new Set([...prev, key]));
    const { data: existing } = await supabase
      .from("tasks")
      .select("position")
      .eq("status", task.status)
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: false })
      .limit(1);
    const position = existing?.length ? existing[0].position + 1 : 0;
    await supabase.from("tasks").insert({
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      assignee_type: "human",
      position,
      workspace_id: workspaceId,
      created_by_agent_id: agentId || null,
    });
  }, [workspaceId, agentId]);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isAtBottom.current = true;
    setShowScrollButton(false);
  }, []);

  // Auto-scroll after every render — only when already at bottom
  useLayoutEffect(() => {
    if (isAtBottom.current) {
      const el = scrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  });

  // Track whether the user has scrolled away from the bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      isAtBottom.current = dist < 80;
      setShowScrollButton(!isAtBottom.current);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Agent selector */}
      {customAgents.length > 0 && (
        <div className="px-3 pt-2 pb-1.5 flex gap-1 flex-wrap flex-shrink-0">
          {customAgents.map((a) => {
            const c = COLOR_MAP[a.color] ?? COLOR_MAP.slate;
            return (
              <button
                key={a.id}
                onClick={() => onAgentChange(a.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  agentId === a.id
                    ? `${c.bg} text-white shadow-sm`
                    : "bg-white/[0.06] text-white/40 hover:bg-white/10 hover:text-white/70"
                }`}
              >
                <span>{a.emoji}</span>
                <span>{a.handle}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Messages + floating scroll button */}
      <div className="relative flex-1 min-h-0 flex flex-col">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${agent.bgColor} flex items-center justify-center text-2xl shadow-lg`}>
              {agent.emoji}
            </div>
            <div>
              <p className={`text-sm font-medium ${agent.textColor}`}>
                {agent.name} à votre service.
              </p>
              <div className="mt-3 flex flex-col gap-1.5 text-xs">
                {[
                  "Crée une tâche pour analyser le marché",
                  "Résume l'état du board",
                  "Propose un plan de sprint",
                ].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="px-3 py-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] text-white/40 hover:text-white/70 transition-all text-left"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => {
          const textContent =
            message.parts
              ? message.parts.filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("\n\n")
              : message.content;
          // Completely hide the onboarding trigger
          if (message.role === "user" && textContent === ONBOARDING_TRIGGER) return null;
          const isShadow =
            message.role === "user" && textContent.startsWith(SHADOW_PREFIX);
          if (isShadow) {
            return (
              <div key={message.id} className="flex items-center gap-2 text-xs text-white/20 py-0.5">
                <Zap className="w-3 h-3 text-accent-400/40 flex-shrink-0" />
                <span className="italic">{textContent.replace(SHADOW_PREFIX, "")}</span>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className={`w-6 h-6 rounded-full ${agent.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5 text-xs shadow-sm`}>
                  {agent.emoji}
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-brand-500/20 text-white/85 rounded-tr-sm border border-brand-400/20 backdrop-blur-sm"
                    : "bg-white/[0.05] text-white/80 rounded-tl-sm border border-white/[0.08] backdrop-blur-sm"
                }`}
              >
                {message.role === "user" ? (
                  textContent
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-1.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-1.5">{children}</ol>,
                      li: ({ children }) => <li className="text-white/70">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-white/95">{children}</strong>,
                      em: ({ children }) => <em className="text-white/60">{children}</em>,
                      code: ({ children }) => <code className="bg-black/30 text-brand-300 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                      pre: ({ children }) => <pre className="bg-black/30 rounded-xl p-2.5 text-xs font-mono overflow-x-auto my-1.5 border border-white/[0.06]">{children}</pre>,
                      h1: ({ children }) => <h1 className="font-bold text-white/90 text-base mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="font-semibold text-white/85 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="font-medium text-white/80 mb-0.5">{children}</h3>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-white/20 pl-3 text-white/50 italic my-1">{children}</blockquote>,
                      hr: () => <hr className="border-white/10 my-2" />,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-2 rounded-xl border border-white/[0.08]">
                          <table className="w-full text-xs">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
                      tbody: ({ children }) => <tbody className="divide-y divide-white/[0.05]">{children}</tbody>,
                      tr: ({ children }) => <tr className="hover:bg-white/[0.03] transition-colors">{children}</tr>,
                      th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-white/60 whitespace-nowrap">{children}</th>,
                      td: ({ children }) => <td className="px-3 py-2 text-white/60 align-top">{children}</td>,
                    }}
                  >
                    {textContent}
                  </ReactMarkdown>
                )}

                {/* Proposed task cards from propose_tasks tool */}
                {message.role === "assistant" && (() => {
                  const part = message.parts?.find(
                    (p) => p.type === "tool-invocation" &&
                      p.toolInvocation.toolName === "propose_tasks" &&
                      p.toolInvocation.state === "result"
                  );
                  if (!part || part.type !== "tool-invocation") return null;
                  const inv = part.toolInvocation;
                  if (inv.state !== "result") return null;
                  const proposed = (inv.result as { proposed: Array<{ title: string; description?: string; status: "backlog" | "todo" }> }).proposed;
                  if (!proposed?.length) return null;
                  return (
                    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
                      {proposed.map((task, i) => {
                        const key = `${message.id}-${i}`;
                        const added = addedTasks.has(key);
                        return (
                          <div key={key} className="flex items-start gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl p-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white/85 leading-snug">{task.title}</p>
                              {task.description && (
                                <p className="text-[10px] text-white/35 mt-0.5 line-clamp-2 leading-snug">{task.description}</p>
                              )}
                              <span className={`inline-flex items-center mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                                task.status === "todo"
                                  ? "bg-blue-500/15 text-blue-400/60"
                                  : "bg-white/[0.05] text-white/25"
                              }`}>
                                {task.status === "todo" ? "Prochaines Actions" : "Backlog"}
                              </span>
                            </div>
                            <button
                              onClick={() => handleAddProposedTask(key, task)}
                              disabled={added}
                              className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                                added
                                  ? "bg-emerald-500/15 text-emerald-400/70 border border-emerald-500/20 cursor-default"
                                  : "bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-400/20"
                              }`}
                            >
                              {added ? <><Check className="w-2.5 h-2.5" />Ajouté</> : "+ Ajouter"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}

        {isWaiting && (
          <div className="flex gap-2 justify-start">
            <div className={`w-6 h-6 rounded-full ${agent.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5 text-xs`}>
              {agent.emoji}
            </div>
            <div className="bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-2 text-xs text-white/40">
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              Réflexion en cours…
            </div>
          </div>
        )}

      </div>

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated/90 backdrop-blur-xl hover:bg-white/10 border border-white/10 text-white/60 text-xs rounded-full shadow-lg transition-all z-10"
        >
          <ArrowDown className="w-3 h-3" />
          Aller en bas
        </button>
      )}
      </div>

      {/* Error banner */}
      {chatError && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300/80 flex items-center justify-between gap-2">
          <span>{chatError}</span>
          <button onClick={() => setChatError(null)} className="text-red-400/50 hover:text-red-300 transition-colors flex-shrink-0">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <form onSubmit={handleSubmitWithHistory} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder={`Message à ${agent.name}…`}
            className="flex-1 bg-white/[0.06] border border-white/[0.08] text-white/85 placeholder-white/25 rounded-2xl px-3 py-2 text-sm outline-none focus:border-white/20 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`${agent.bgColor} hover:opacity-90 disabled:opacity-30 text-white rounded-2xl px-3 py-2 transition-all shadow-sm`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </>
  );
}

// ── History sidebar ────────────────────────────────────────────────────────────
function HistoryPanel({
  currentConvId,
  customAgents,
  onSelect,
  onNew,
  onClose,
}: {
  currentConvId: string | null;
  customAgents: CustomAgent[];
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setConversations(data as Conversation[]); });
  }, []);

  const agentLabel = (id: string) => customAgents.find((a) => a.id === id)?.emoji ?? "🤖";

  return (
    <div className="absolute inset-0 z-10 bg-surface-overlay/95 backdrop-blur-2xl flex flex-col">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="text-sm font-medium text-white/70">Historique</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="flex items-center gap-1 text-xs text-white/35 hover:text-white/70 px-2 py-1 hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau
          </button>
          <button onClick={onClose} className="text-white/25 hover:text-white/70 p-1 hover:bg-white/[0.06] rounded-lg transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 && (
          <p className="text-xs text-white/20 italic text-center p-4">Aucune conversation enregistrée.</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors ${
              currentConvId === conv.id
                ? "bg-brand-500/[0.08] border-l-2 border-brand-400/50"
                : "hover:bg-white/[0.04]"
            }`}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{agentLabel(conv.chat_agent_id)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 truncate">{conv.title}</p>
              <p className="text-xs text-white/25">
                {new Date(conv.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ChatPanel ─────────────────────────────────────────────────────────────
export default function ChatPanel({ lastBoardEvent, tasks, agentId, onAgentChange, workspaceId }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  // chatSessionKey controls ChatInner remounting — changes only on explicit load/new,
  // NOT when onConversationCreate assigns an ID to an in-progress new conversation.
  const [chatSessionKey, setChatSessionKey] = useState("new");
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);
  const prevBoardEvent = useRef<string | null>(null);

  useEffect(() => {
    supabase.from("custom_agents").select("*").order("created_at")
      .then(({ data }) => { if (data) setCustomAgents(data as CustomAgent[]); });
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from("workspaces").select("*").eq("id", workspaceId).single()
      .then(({ data }) => {
        if (data) setProjectContext({
          project_name: data.name,
          description: data.description ?? "",
          user_profile: data.user_profile ?? "",
          objective: data.objective ?? "",
          constraints: data.constraints ?? undefined,
        });
      });
  }, [workspaceId]);

  const currentAgent = getAgentDisplay(agentId, customAgents);

  // Shadow loop state lifted here so it survives ChatInner remounts
  const [pendingShadowEvent, setPendingShadowEvent] = useState<string | null>(null);

  useEffect(() => {
    if (lastBoardEvent && lastBoardEvent !== prevBoardEvent.current) {
      prevBoardEvent.current = lastBoardEvent;
      setPendingShadowEvent(lastBoardEvent);
    }
  }, [lastBoardEvent]);

  const loadConversation = useCallback(async (conv: Conversation) => {
    const { data } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at");

    if (data) {
      setInitialMessages(
        data.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
      setConversationId(conv.id);
      setChatSessionKey(conv.id);
      onAgentChange(conv.chat_agent_id ?? agentId);
    }
    setShowHistory(false);
  }, [agentId, onAgentChange]);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setInitialMessages([]);
    setChatSessionKey(`new-${Date.now()}`);
    setShowHistory(false);
  }, []);

  return (
    <div className="flex flex-col h-full relative border-r border-white/[0.06]">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <VelaIcon size={18} />
            <span className="text-xs font-semibold text-white/70">Vela</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startNewConversation}
              title="Nouvelle conversation"
              className="text-white/30 hover:text-white/70 p-1 hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowHistory((v) => !v)}
              title="Historique"
              className={`p-1 rounded-xl transition-colors ${
                showHistory ? "text-brand-400 bg-brand-500/15" : "text-white/30 hover:text-white/70 hover:bg-white/[0.06]"
              }`}
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Chat inner — remounts on conversation change */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <ChatInner
          key={chatSessionKey}
          conversationId={conversationId}
          initialMessages={initialMessages}
          agentId={agentId}
          agentDisplay={currentAgent}
          tasks={tasks}
          onConversationCreate={setConversationId}
          pendingShadowEvent={pendingShadowEvent}
          onShadowEventConsumed={() => setPendingShadowEvent(null)}
          projectContext={projectContext}
          workspaceId={workspaceId}
          customAgents={customAgents}
          onAgentChange={onAgentChange}
        />

        {/* History panel overlay */}
        {showHistory && (
          <HistoryPanel
            currentConvId={conversationId}
            customAgents={customAgents}
            onSelect={loadConversation}
            onNew={startNewConversation}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  );
}
