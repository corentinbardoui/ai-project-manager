"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Bot, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CustomAgent } from "@/types/database";

const EMOJI_OPTIONS = ["🤖", "🧠", "⚡", "🔬", "✍️", "📊", "🎨", "💡", "🛠️", "🔭"];
const COLOR_OPTIONS = [
  { label: "Violet", value: "violet", cls: "bg-brand-600" },
  { label: "Bleu", value: "blue", cls: "bg-blue-600" },
  { label: "Vert", value: "emerald", cls: "bg-emerald-600" },
  { label: "Ambre", value: "amber", cls: "bg-amber-600" },
  { label: "Rose", value: "rose", cls: "bg-rose-600" },
];

interface AgentManagerProps {
  onClose: () => void;
}

const EMPTY_FORM = { name: "", handle: "", emoji: "🤖", color: "violet", system_prompt: "" };

export default function AgentManager({ onClose }: AgentManagerProps) {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("custom_agents")
      .select("*")
      .order("created_at")
      .then(({ data }) => { if (data) setAgents(data as CustomAgent[]); });
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (agent: CustomAgent) => {
    setEditingId(agent.id);
    setForm({ name: agent.name, handle: agent.handle, emoji: agent.emoji, color: agent.color, system_prompt: agent.system_prompt });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.system_prompt.trim()) return;
    setIsSaving(true);

    const handle = form.handle.trim() || `@${form.name.replace(/\s+/g, "")}`;

    if (editingId) {
      const { data, error } = await supabase
        .from("custom_agents")
        .update({ ...form, handle })
        .eq("id", editingId)
        .select()
        .single();
      if (!error && data) {
        setAgents((prev) => prev.map((a) => (a.id === editingId ? (data as CustomAgent) : a)));
        closeForm();
      }
    } else {
      const { data, error } = await supabase
        .from("custom_agents")
        .insert({ ...form, handle })
        .select()
        .single();
      if (!error && data) {
        setAgents((prev) => [...prev, data as CustomAgent]);
        closeForm();
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("custom_agents").delete().eq("id", id);
    setAgents((prev) => prev.filter((a) => a.id !== id));
    if (editingId === id) closeForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div
        className="relative bg-surface-overlay/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-brand-400" />
            <h2 className="font-semibold text-white/85">Agents personnalisés</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/80 p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Agent list */}
          {agents.length === 0 && !showForm && (
            <p className="text-sm text-slate-500 italic text-center py-4">
              Aucun agent créé. Créez votre premier agent ci-dessous.
            </p>
          )}

          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors backdrop-blur-sm ${
                editingId === agent.id
                  ? "bg-brand-500/[0.07] border-brand-400/25"
                  : "bg-white/[0.04] border-white/[0.07] hover:border-white/[0.12]"
              }`}
            >
              <div className={`w-8 h-8 rounded-full bg-${agent.color}-600 flex items-center justify-center text-sm flex-shrink-0`}>
                {agent.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/85">{agent.name}</span>
                  <span className="text-xs text-white/30">{agent.handle}</span>
                </div>
                <p className="text-xs text-white/40 mt-1 line-clamp-2">{agent.system_prompt}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => editingId === agent.id ? closeForm() : openEdit(agent)}
                  className={`transition-colors p-1 rounded-lg ${
                    editingId === agent.id
                      ? "text-brand-400 hover:text-brand-300"
                      : "text-white/25 hover:text-white/60"
                  }`}
                  title="Modifier"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(agent.id)}
                  className="text-white/25 hover:text-red-400 transition-colors p-1 rounded-lg"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Create / Edit form */}
          {showForm ? (
            <div className="border border-white/[0.08] rounded-2xl p-4 space-y-3 bg-white/[0.03]">
              <h3 className="text-sm font-medium text-white/80">
                {editingId ? "Modifier l'agent" : "Nouvel agent"}
              </h3>

              {/* Emoji + Color */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1.5">Emoji</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                        className={`w-8 h-8 rounded-xl text-base transition-all ${
                          form.emoji === e
                            ? "bg-white/15 ring-2 ring-brand-400/60"
                            : "bg-white/[0.05] hover:bg-white/10"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">Couleur</label>
                  <div className="flex gap-1.5">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                        className={`w-6 h-6 rounded-full ${c.cls} transition-all ${
                          form.color === c.value ? "ring-2 ring-offset-1 ring-offset-slate-800 ring-white" : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs text-white/35 block mb-1">Nom</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Analyste SEO"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {/* Handle */}
              <div>
                <label className="text-xs text-white/35 block mb-1">Handle (optionnel)</label>
                <input
                  value={form.handle}
                  onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                  placeholder="@SEO (auto-généré si vide)"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {/* System prompt */}
              <div>
                <label className="text-xs text-white/35 block mb-1">System prompt</label>
                <textarea
                  value={form.system_prompt}
                  onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
                  rows={5}
                  placeholder="Décrivez le rôle et les instructions de cet agent..."
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !form.name.trim() || !form.system_prompt.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500/80 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-brand-500/20"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingId ? "Enregistrer" : "Créer l'agent"}
                </button>
                <button
                  onClick={closeForm}
                  className="px-4 py-2 text-white/35 hover:text-white/70 text-sm rounded-xl hover:bg-white/[0.05] transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={openCreate}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-white/[0.08] hover:border-white/20 rounded-2xl text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Créer un agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
