"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { label: "Contexte du projet sauvegardé", delay: 300 },
  { label: "Configuration de votre espace…", delay: 1000 },
  { label: "Initialisation du board…", delay: 1800 },
  { label: "Prêt à travailler", delay: 2600 },
];

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((s, i) =>
      setTimeout(() => setReached(i + 1), s.delay)
    );
    const done = setTimeout(onComplete, 3200);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-600/[0.07] rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Brand */}
      <div className="flex items-center gap-2.5 z-10">
        <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-400/20 flex items-center justify-center">
          <span className="text-base">⚡</span>
        </div>
        <span className="text-base font-semibold text-white/50">AI Project Manager</span>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-3 z-10 min-w-[260px]">
        {STEPS.map((s, i) => {
          const done = i < reached;
          const active = i === reached - 1 && reached <= STEPS.length;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-700 ${
                done ? "text-white/65" : "text-white/20"
              }`}
            >
              {/* Icon */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-all duration-700 ${
                done
                  ? "bg-emerald-500/15 border-emerald-400/30"
                  : active
                  ? "bg-brand-500/20 border-brand-400/30"
                  : "border-white/10"
              }`}>
                {done ? (
                  <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : active ? (
                  <span className="w-1.5 h-1.5 bg-brand-400 rounded-full block animate-pulse" />
                ) : null}
              </div>
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
