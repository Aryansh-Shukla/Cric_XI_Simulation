import { motion } from "framer-motion";
import { Crown, Shield, AlertTriangle, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import type { GameMode, Player } from "@/lib/cricket/types";
import { validateTeam, pickCaptain, pickViceCaptain } from "@/lib/cricket/rules";
import { activatedChemistry } from "@/lib/cricket/simulation";

interface Props {
  players: Player[];
  mode: GameMode;
  leadership?: { captainId: string; viceCaptainId: string; keeperId: string } | null;
  onSimulate: () => void;
  onRestart: () => void;
}

const POSITIONS: [number, number][] = [
  [50, 55],
  [30, 30], [70, 30],
  [15, 55], [85, 55],
  [30, 80], [70, 80],
  [50, 15],
  [20, 15], [80, 15],
  [50, 90],
];

export function TeamView({ players, mode, leadership, onSimulate, onRestart }: Props) {
  const v = validateTeam(players, mode);
  const captain = (leadership && players.find(p => p.id === leadership.captainId)) || pickCaptain(players);
  const vice = (leadership && players.find(p => p.id === leadership.viceCaptainId)) || pickViceCaptain(players, captain);
  const keeper = (leadership && players.find(p => p.id === leadership.keeperId)) || players.find(p => p.role === "Wicketkeeper");
  const chem = activatedChemistry(players);

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">Team Review</div>
            <h2 className="mt-1 text-3xl font-bold md:text-4xl">Your Starting XI</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onRestart} className="btn-ghost-gold rounded-full px-4 py-2 text-sm">Restart</button>
            <button
              onClick={onSimulate}
              disabled={!v.valid}
              className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Simulate Tournament <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr,1fr]">
          <div className="glass-card relative aspect-[4/3] overflow-hidden rounded-3xl p-4">
            <div className="absolute inset-4 rounded-[2rem] bg-gradient-to-b from-[oklch(0.42_0.14_150)] to-[oklch(0.28_0.1_150)]">
              <div className="absolute left-1/2 top-1/2 h-2/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
              <div className="absolute left-1/2 top-1/2 h-16 w-6 -translate-x-1/2 -translate-y-1/2 rounded bg-[oklch(0.85_0.05_85)]/70" />
            </div>

            {players.map((p, i) => {
              const [x, y] = POSITIONS[i] ?? [50, 50];
              const isCap = p.id === captain.id;
              const isVc = p.id === vice.id;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="relative flex flex-col items-center">
                    <div className={`grid h-10 w-10 place-items-center rounded-full border-2 text-[10px] font-bold shadow-md ${
                      isCap ? "border-[color:var(--gold)] bg-[color:var(--gold)]/90 text-[color:var(--primary-foreground)]"
                        : p.role === "Wicketkeeper"
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/90 text-[color:var(--primary-foreground)]"
                          : "border-white/60 bg-white/90 text-[color:var(--primary-foreground)]"
                    }`}>
                      {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="mt-1 whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium backdrop-blur">
                      {p.name.split(" ").slice(-1)[0]}
                      {isCap && " (C)"}
                      {isVc && !isCap && " (VC)"}
                      {p.role === "Wicketkeeper" && !isCap && " †"}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-5">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Team Balance</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Stat label="Wicketkeepers" value={v.summary.wicketkeepers} />
                <Stat label="Bowling options" value={v.summary.bowlers} />
                <Stat label="Pace" value={v.summary.pace} />
                <Stat label="Spin" value={v.summary.spin} />
                <Stat label="Batsmen" value={v.summary.specialistBatsmen} />
                {mode === "FRANCHISE_T20" && <Stat label="Overseas" value={v.summary.overseas} />}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-3 text-xs">
                {v.valid ? (
                  <>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--accent)]" />
                    <span>Valid XI. Ready to simulate.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-[color:var(--destructive)]" />
                    <ul className="space-y-1">
                      {v.errors.map(e => <li key={e}>{e}</li>)}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Crown className="h-3.5 w-3.5 text-gold" /> Leadership
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between"><span>Captain</span><span className="font-semibold text-gold">{captain.name}</span></div>
                <div className="flex items-center justify-between"><span>Vice Captain</span><span className="font-semibold">{vice.name}</span></div>
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" />Keeper</span>
                  <span className="font-semibold">{keeper?.name ?? "—"}</span></div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Chemistry
              </div>
              {chem.length === 0 ? (
                <div className="mt-3 text-sm text-muted-foreground">No legendary combinations activated.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {chem.map(c => (
                    <motion.div
                      key={c.pair}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between rounded-xl border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-3 py-2 text-sm"
                    >
                      <span>{c.pair}</span>
                      <span className="text-[color:var(--accent)]">+ {c.label}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gold">{value}</div>
    </div>
  );
}