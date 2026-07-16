import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MODE_LABELS } from "@/lib/cricket/data";
import type { Difficulty, GameMode } from "@/lib/cricket/types";

const MODES: GameMode[] = ["ODI_WC", "T20_WC", "CHAMPIONS", "FRANCHISE_T20", "TEST"];
const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard", "Legend"];

interface Props {
  onBack: () => void;
  onStart: (mode: GameMode, difficulty: Difficulty) => void;
}

export function ModeSelect({ onBack, onStart }: Props) {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [diff, setDiff] = useState<Difficulty>("Medium");

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <button onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h2 className="text-4xl font-bold md:text-5xl">Choose Your Format</h2>
        <p className="mt-2 text-muted-foreground">Pick a tournament. Every format changes the meta.</p>

        <div className="mt-8 grid gap-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MODES.map((m, i) => {
              const info = MODE_LABELS[m];
              const active = mode === m;
              return (
                <motion.button
                  key={m}
                  onClick={() => setMode(m)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                  className={`glass-card rounded-2xl p-6 text-left transition-all ${
                    active ? "ring-2 ring-[color:var(--gold)] glow-gold" : "hover:ring-1 hover:ring-[color:var(--gold)]/40"
                  }`}
                >
                  <div className="text-xs uppercase tracking-widest text-gold">{info.format}</div>
                  <div className="mt-2 text-2xl font-bold">{info.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{info.subtitle}</div>
                </motion.button>
              );
            })}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Difficulty</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DIFFS.map(d => (
                <button
                  key={d}
                  onClick={() => setDiff(d)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    diff === d
                      ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-gold"
                      : "border-[color:var(--border)] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {diff === "Easy" && "Player roles and countries visible."}
              {diff === "Medium" && "Roles hidden. Country still visible."}
              {diff === "Hard" && "Only name shown."}
              {diff === "Legend" && "No squad preview. Trust your instincts."}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled={!mode}
              onClick={() => mode && onStart(mode, diff)}
              className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Draft <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}