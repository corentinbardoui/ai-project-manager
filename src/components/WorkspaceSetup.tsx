"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface WorkspaceSetupProps {
  onComplete: (workspaceId: string) => void;
  onCancel: () => void;
}

const EMOJIS = ["🚀", "💡", "🎯", "⚡", "🔥", "🌟", "🛠️", "📊", "🎨", "🤖", "🌱", "💎"];
const ROLES = ["Fondateur / CEO", "Développeur", "Product Manager", "Freelance", "Designer", "Chef de projet", "Responsable Marketing", "Autre"];

const STEPS = [
  { number: 1, label: "Projet" },
  { number: 2, label: "Profil" },
  { number: 3, label: "Objectifs" },
];

export default function WorkspaceSetup({ onComplete, onCancel }: WorkspaceSetupProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [emoji, setEmoji] = useState("🚀");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2
  const [selectedRole, setSelectedRole] = useState("");
  const [profileDetail, setProfileDetail] = useState("");

  // Step 3
  const [objective, setObjective] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [constraints, setConstraints] = useState("");

  const canNext = step === 1 ? name.trim().length > 0 : step === 2 ? (selectedRole.length > 0 || profileDetail.trim().length > 0) : objective.trim().length > 0;

  const handleCreate = async () => {
    setSaving(true);
    const userProfile = [selectedRole, profileDetail].filter(Boolean).join(" — ");
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: name.trim(), description: description.trim() || null, user_profile: userProfile || null, objective: objective.trim(), constraints: constraints.trim() || null, emoji })
      .select()
      .single();
    setSaving(false);
    if (!error && data) onComplete(data.id);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-brand-600/[0.05] rounded-full blur-3xl -translate-y-1/3" />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 flex-shrink-0 z-10">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour
        </button>
        <div className="flex items-center gap-1.5 text-white/30">
          <div className="w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-400/20 flex items-center justify-center text-sm">⚡</div>
          <span className="text-sm font-medium text-white/40">Nouvel espace</span>
        </div>
        <div className="w-16" /> {/* spacer */}
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 py-4 z-10">
        {STEPS.map((s, i) => {
          const done = s.number < step;
          const active = s.number === step;
          return (
            <div key={s.number} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  done ? "bg-emerald-500/20 border border-emerald-400/30 text-emerald-400"
                  : active ? "bg-brand-500/25 border border-brand-400/40 text-brand-300"
                  : "border border-white/10 text-white/20"
                }`}>
                  {done ? <Check className="w-3 h-3" /> : s.number}
                </div>
                <span className={`text-xs font-medium transition-colors ${active ? "text-white/60" : done ? "text-white/40" : "text-white/20"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px transition-colors ${done ? "bg-emerald-400/20" : "bg-white/[0.06]"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Form body */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 z-10">
        <div className="w-full max-w-lg">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-white/85 mb-1.5">Décrivez votre projet</h2>
                <p className="text-sm text-white/35">Donnez un nom et un contexte à votre espace de travail</p>
              </div>

              {/* Emoji picker */}
              <div>
                <label className="text-xs text-white/40 block mb-2.5">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                        emoji === e
                          ? "bg-brand-500/25 border-2 border-brand-400/50 scale-110"
                          : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project name */}
              <div>
                <label className="text-xs text-white/40 block mb-2">Nom du projet <span className="text-brand-400">*</span></label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(2)}
                  placeholder="Ex: Lancement produit Q1, Refonte site web…"
                  className="w-full bg-white/[0.04] border border-white/[0.10] focus:border-brand-400/40 rounded-2xl px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-white/40 block mb-2">Description <span className="text-white/20">(optionnel)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="En quelques mots, de quoi s'agit-il ?"
                  className="w-full bg-white/[0.04] border border-white/[0.10] focus:border-brand-400/40 rounded-2xl px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-white/85 mb-1.5">Qui êtes-vous ?</h2>
                <p className="text-sm text-white/35">L'IA adaptera ses suggestions à votre profil</p>
              </div>

              {/* Role chips */}
              <div>
                <label className="text-xs text-white/40 block mb-2.5">Votre rôle</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(selectedRole === r ? "" : r)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        selectedRole === r
                          ? "bg-brand-500/20 border-brand-400/40 text-brand-300"
                          : "bg-white/[0.04] border-white/[0.08] text-white/45 hover:text-white/70 hover:bg-white/[0.07]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail */}
              <div>
                <label className="text-xs text-white/40 block mb-2">Quelques mots sur vous <span className="text-white/20">(optionnel)</span></label>
                <textarea
                  autoFocus
                  value={profileDetail}
                  onChange={(e) => setProfileDetail(e.target.value)}
                  rows={3}
                  placeholder="Ex: 3 ans d'expérience en B2B SaaS, équipe de 2…"
                  className="w-full bg-white/[0.04] border border-white/[0.10] focus:border-brand-400/40 rounded-2xl px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-white/85 mb-1.5">Vos objectifs</h2>
                <p className="text-sm text-white/35">Définissez ce que vous voulez accomplir</p>
              </div>

              {/* Objective */}
              <div>
                <label className="text-xs text-white/40 block mb-2">Objectif principal <span className="text-brand-400">*</span></label>
                <textarea
                  autoFocus
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={3}
                  placeholder="Ex: Lancer la v1 de mon produit avant le 30 juin avec 50 premiers utilisateurs…"
                  className="w-full bg-white/[0.04] border border-white/[0.10] focus:border-brand-400/40 rounded-2xl px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none transition-colors resize-none"
                />
              </div>

              {/* Due date */}
              <div>
                <label className="text-xs text-white/40 block mb-2">Échéance <span className="text-white/20">(optionnel)</span></label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.10] focus:border-brand-400/40 rounded-2xl px-4 py-3 text-sm text-white/60 outline-none transition-colors [color-scheme:dark]"
                />
              </div>

              {/* Constraints */}
              <div>
                <label className="text-xs text-white/40 block mb-2">Contraintes <span className="text-white/20">(optionnel)</span></label>
                <textarea
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  rows={2}
                  placeholder="Budget, équipe réduite, deadline imposée…"
                  className="w-full bg-white/[0.04] border border-white/[0.10] focus:border-brand-400/40 rounded-2xl px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none transition-colors resize-none"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Navigation */}
      <div className="flex-shrink-0 px-8 pb-8 z-10 flex items-center justify-between max-w-lg mx-auto w-full">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : onCancel()}
          className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors px-4 py-2.5 rounded-xl hover:bg-white/[0.05]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {step > 1 ? "Précédent" : "Annuler"}
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500/80 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-brand-500/20"
          >
            Continuer
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={!canNext || saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500/80 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-brand-500/20"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Création…" : "Créer mon espace"}
          </button>
        )}
      </div>
    </div>
  );
}
