import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, CloudRain, Sun, Cloud, Moon, ArrowRight, RotateCcw } from "lucide-react";
import type { GameMode, Player, Weather } from "@/lib/cricket/types";
import { simulateTournament, type Tournament } from "@/lib/cricket/simulation";
import { MODE_LABELS } from "@/lib/cricket/data";

interface Props {
  players: Player[];
  mode: GameMode;
  leadership?: { captainId: string; viceCaptainId: string; keeperId: string } | null;
  onRestart: () => void;
}

const weatherIcon = (w: Weather) => {
  switch (w) {
    case "Sunny": return Sun;
    case "Cloudy": return Cloud;
    case "Humid": return CloudRain;
    case "Night Match": return Moon;
  }
};

export function TournamentView({ players, mode, leadership, onRestart }: Props) {
  const [t] = useState<Tournament>(() => simulateTournament(players, mode, undefined, leadership?.captainId));
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (revealed >= t.results.length) return;
    const timer = setTimeout(() => setRevealed(r => r + 1), 1400);
    return () => clearTimeout(timer);
  }, [revealed, t.results.length]);

  const done = revealed >= t.results.length;
  const won = done && t.championshipWon;

  return (
    <div className="relative min-h-screen px-6 py-10">
      {won && <Confetti />}
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">{MODE_LABELS[mode].title} · Knockouts</div>
            <h2 className="mt-1 text-3xl font-bold md:text-4xl">Tournament</h2>
            <p className="mt-1 text-sm text-muted-foreground">Captain: <span className="text-foreground">{t.captain.name}</span></p>
          </div>
          <button onClick={onRestart} className="btn-ghost-gold inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <RotateCcw className="h-4 w-4" /> New Draft
          </button>
        </div>

        <div className="mt-8 space-y-4">
          <AnimatePresence>
            {t.results.slice(0, revealed).map((r, i) => {
              const WIcon = weatherIcon(r.weather);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className={`glass-card overflow-hidden rounded-2xl ${
                    r.won ? "ring-1 ring-[color:var(--accent)]/40" : "ring-1 ring-[color:var(--destructive)]/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[color:var(--gold)]/10 px-2.5 py-0.5 text-xs font-semibold text-gold">{r.stage}</span>
                      <span className="text-sm text-muted-foreground">vs {r.opponentName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><WIcon className="h-3.5 w-3.5" /> {r.weather}</span>
                      <span>·</span>
                      <span>Pitch: {r.pitch}</span>
                      <span>·</span>
                      <span>Toss: {r.toss}</span>
                    </div>
                  </div>
                  <div className="grid gap-6 p-5 md:grid-cols-[1fr,auto,1fr]">
                    <ScoreBlock title="Your XI" score={r.ourScore} highlight={r.won} />
                    <div className="flex flex-col items-center justify-center gap-1">
                      <div className={`text-2xl font-black ${r.won ? "text-[color:var(--accent)]" : "text-[color:var(--destructive)]"}`}>
                        {r.won ? "WON" : "LOST"}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Win prob {r.winProbability}%
                      </div>
                    </div>
                    <ScoreBlock title={r.opponentName} score={r.oppScore} highlight={!r.won} align="right" />
                  </div>
                  <div className="grid gap-3 border-t border-[color:var(--border)] px-5 py-4 md:grid-cols-3">
                    <Meta label="Top scorer" value={`${r.topScorer.name} · ${r.topScorer.line}`} />
                    <Meta label="Best bowler" value={`${r.bestBowler.name} · ${r.bestBowler.line}`} />
                    <Meta label="Player of the match" value={r.playerOfMatch} accent />
                  </div>
                  <ul className="space-y-1 border-t border-[color:var(--border)] px-5 py-3 text-sm text-muted-foreground">
                    {r.highlights.map((h, k) => <li key={k}>• {h}</li>)}
                  </ul>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {!done && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
              <div className="mx-auto mb-2 h-2 w-24 overflow-hidden rounded-full bg-white/10">
                <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1.2, repeat: Infinity }}
                  className="h-full w-1/2 bg-gradient-to-r from-transparent via-[color:var(--gold)] to-transparent" />
              </div>
              Simulating {["Quarter Final", "Semi Final", "Final"][revealed]}…
            </motion.div>
          )}

          {done && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className={`glass-card rounded-3xl p-8 text-center ${won ? "glow-gold ring-2 ring-[color:var(--gold)]" : ""}`}
            >
              <Trophy className={`mx-auto h-14 w-14 ${won ? "text-gold" : "text-muted-foreground"}`} />
              <h3 className="mt-4 text-3xl font-black">
                {won ? "Champions!" : "Better luck next draft."}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {won ? "Your XI has lifted the trophy. Legendary." : "Rebuild your XI and take another shot at glory."}
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <button onClick={onRestart} className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold">
                  Play Again <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBlock({ title, score, highlight, align = "left" }: { title: string; score: string; highlight: boolean; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? "text-gold" : ""}`}>{score}</div>
    </div>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-medium ${accent ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 60 });
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 2 + Math.random() * 1.5;
        const colors = ["var(--gold)", "var(--accent)", "#fff"];
        const bg = colors[i % colors.length];
        return (
          <motion.span
            key={i}
            initial={{ y: -20, x: `${left}vw`, rotate: 0, opacity: 1 }}
            animate={{ y: "110vh", rotate: 720, opacity: [1, 1, 0] }}
            transition={{ duration, delay, ease: "easeIn" }}
            className="absolute block h-2 w-2 rounded-sm"
            style={{ background: bg }}
          />
        );
      })}
    </div>
  );
}