"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Loader2, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ONBOARDING_TRIGGER } from "@/lib/agents";
import { fetchProjectContext } from "@/lib/projectContext";

interface OnboardingPageProps {
  onComplete: () => void;
}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const triggered = useRef(false);
  const [readyToEnter, setReadyToEnter] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, status, append } = useChat({
    api: "/api/chat",
    body: { tasks: [], agentId: "", isOnboarding: true, projectContext: null },
    experimental_throttle: 60,
    onFinish: async () => {
      const ctx = await fetchProjectContext();
      if (ctx) {
        // Context saved — auto-transition
        onComplete();
      } else {
        // Tool may have failed — show manual entry button after enough exchanges
        inputRef.current?.focus();
        const assistantCount = messages.filter((m) => m.role === "assistant").length;
        if (assistantCount >= 3) setReadyToEnter(true);
      }
    },
  });

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    setTimeout(() => append({ role: "user", content: ONBOARDING_TRIGGER }), 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isLoading = status === "streaming" || status === "submitted";
  const isWaiting = status === "submitted";

  const visibleMessages = messages.filter(
    (m) => !(m.role === "user" && (m.content === ONBOARDING_TRIGGER))
  );

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-600/[0.06] rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/[0.05] rounded-full blur-3xl translate-y-1/3" />
      </div>

      {/* Top bar */}
      <div className="flex items-center gap-2.5 px-8 py-5 flex-shrink-0 z-10">
        <div className="w-7 h-7 rounded-xl bg-brand-500/15 border border-brand-400/20 flex items-center justify-center">
          <span className="text-sm">⚡</span>
        </div>
        <span className="text-sm font-semibold text-white/40 tracking-wide">AI Project Manager</span>
      </div>

      {/* Chat zone */}
      <div className="flex-1 flex flex-col items-center justify-end px-6 pb-6 z-10 overflow-y-auto">
        <div className="w-full max-w-xl flex flex-col gap-3">

          {/* Empty state before AI talks */}
          {visibleMessages.length === 0 && !isWaiting && (
            <div className="text-center py-20 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-400/15 flex items-center justify-center mx-auto text-2xl mb-4">
                ⚡
              </div>
              <h1 className="text-2xl font-bold text-white/85">Bienvenue</h1>
              <p className="text-sm text-white/35">Votre espace de projet piloté par l'IA se prépare…</p>
            </div>
          )}

          {visibleMessages.map((msg) => {
            const text = msg.parts
              ? msg.parts.filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("\n\n")
              : msg.content;
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-brand-500/15 border border-brand-400/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                    ⚡
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-brand-500/20 text-white/85 rounded-tr-sm border border-brand-400/20"
                    : "bg-white/[0.05] text-white/80 rounded-tl-sm border border-white/[0.08]"
                }`}>
                  {isUser ? text : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-white/95">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-1.5 text-white/70">{children}</ul>,
                        li: ({ children }) => <li>{children}</li>,
                      }}
                    >
                      {text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            );
          })}

          {isWaiting && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-7 h-7 rounded-full bg-brand-500/15 border border-brand-400/20 flex items-center justify-center text-sm flex-shrink-0">
                ⚡
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-xs text-white/35">
                <Loader2 className="w-3 h-3 animate-spin" />
                En train de réfléchir…
              </div>
            </div>
          )}

          {/* Manual entry button — fallback if auto-detection fails */}
          {readyToEnter && !isLoading && (
            <div className="flex justify-center pt-2">
              <button
                onClick={onComplete}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-400/30 rounded-2xl text-sm text-brand-300 font-medium transition-all"
              >
                Accéder à mon espace
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input — only appears after AI speaks */}
      <div className={`flex-shrink-0 px-6 pb-8 z-10 flex justify-center transition-all duration-500 ${
        visibleMessages.length > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}>
        <form onSubmit={handleSubmit} className="w-full max-w-xl">
          <div className="flex gap-2 bg-white/[0.04] border border-white/[0.10] rounded-2xl px-4 py-3 focus-within:border-brand-400/30 transition-all shadow-lg shadow-black/20">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="Répondez ici…"
              autoFocus
              className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="text-brand-400/60 hover:text-brand-400 disabled:opacity-30 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
