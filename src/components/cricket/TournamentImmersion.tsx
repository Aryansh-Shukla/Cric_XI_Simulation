import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, Globe2, Sparkles, Target, TrendingUp } from "lucide-react";
import type { TournamentState } from "@/lib/cricket/tournament";
import {
  aroundTheTournament,
  campaignSummary,
  formatNrr,
  qualificationStatus,
  stageLabel,
  tableContext,
  tournamentRecords,
  type QualTone,
} from "@/lib/cricket/campaign";
import { detectStorylines, type StoryMoment } from "@/lib/cricket/storylines";
import { momentumLabel, pressureLabel } from "@/lib/cricket/momentum";

const toneClass: Record<QualTone, string> = {
  good: "border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
  warn: "border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-gold",
  bad: "border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]",
  neutral: "border-[color:var(--border)] bg-white/[0.03] text-foreground",
};

/* ---------- Qualification / stage context ---------- */
export function QualificationBanner({ state }: { state: TournamentState }) {
  const q = qualificationStatus(state);
  if (!q) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-4 py-3 ${toneClass[q.tone]}`}
    >
      <Target className="h-4 w-4 shrink-0" />
      <span className="text-sm font-bold uppercase tracking-wider">{q.headline}</span>
      <span className="min-w-0 text-xs text-muted-foreground">{q.detail}</span>
    </div>
  );
}

/* ---------- Your campaign ---------- */
export function CampaignPanel({ state }: { state: TournamentState }) {
  const s = campaignSummary(state);
  const stage = state.complete
    ? "Complete"
    : stageLabel(state.fixtures[state.currentIndex]?.stage ?? state.finalStageReached);
  const cells: [string, string][] = [
    ["Played", String(s.played)],
    ["Record", `${s.wins}W-${s.losses}L${s.draws ? `-${s.draws}D` : ""}`],
    ["Streak", s.streak],
    ["Runs for / against", `${s.runsFor} / ${s.runsAgainst}`],
    ["Top batter", s.topBatter ? `${s.topBatter.name} (${s.topBatter.runs})` : "—"],
    ["Top bowler", s.topBowler ? `${s.topBowler.name} (${s.topBowler.wickets})` : "—"],
    ["Stage", stage],
    ["Momentum · Pressure", `${momentumLabel(state.momentum)} · ${pressureLabel(state.pressure)}`],
  ];
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
        <TrendingUp className="h-3.5 w-3.5" /> Your Campaign
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {cells.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="truncate text-sm font-semibold">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Storylines ---------- */
export function StorylinesPanel({ state, limit = 4 }: { state: TournamentState; limit?: number }) {
  const stories = detectStorylines(state).slice(0, limit);
  if (!stories.length) return null;
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
        <Sparkles className="h-3.5 w-3.5" /> Storylines
      </div>
      <ul className="space-y-2">
        {stories.map((s) => (
          <li key={s.id} className="min-w-0 border-l-2 border-[color:var(--gold)]/40 pl-3">
            <div className="text-sm font-semibold">{s.title}</div>
            <div className="text-xs text-muted-foreground">{s.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Around the tournament ---------- */
export function AroundTournament({ state }: { state: TournamentState }) {
  if (state.mode === "TEST") return null;
  const feed = aroundTheTournament(state, 6);
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
        <Globe2 className="h-3.5 w-3.5" /> Around the Tournament
      </div>
      {feed.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Other results appear here once matchdays are played.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {feed.map((f) => (
            <div
              key={f.key}
              className="min-w-0 rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-3 text-xs"
            >
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {stageLabel(f.stage)}
              </div>
              {[f.first, f.second].map((t) => (
                <div key={t.name} className="flex justify-between gap-2">
                  <span className="truncate">{t.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{t.score}</span>
                </div>
              ))}
              <div className="mt-1 text-[11px] text-gold">{f.resultLine}</div>
              {f.standout && <div className="text-[11px] text-muted-foreground">{f.standout}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Records ---------- */
export function RecordsPanel({ state }: { state: TournamentState }) {
  const recs = tournamentRecords(state);
  if (!recs.length) return null;
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 text-xs uppercase tracking-widest text-gold">Tournament Records</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {recs.map((r) => (
          <div
            key={r.label}
            className={`min-w-0 rounded-xl border p-3 ${r.isOurs ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10" : "border-[color:var(--border)] bg-white/[0.02]"}`}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {r.label}
            </div>
            <div className={`text-lg font-bold ${r.isOurs ? "text-gold" : ""}`}>{r.value}</div>
            <div className="truncate text-xs text-muted-foreground">{r.who}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Enhanced phase table ---------- */
export function PhaseTable({
  state,
  prev,
}: {
  state: TournamentState;
  prev: TournamentState | null;
}) {
  if (state.mode === "TEST" || !state.phaseStage) return null;
  const rows = tableContext(state, prev);
  if (!rows.length) return null;
  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
        <div className="text-xs uppercase tracking-widest text-gold">
          {stageLabel(state.phaseStage)} Table
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {rows[0].remaining
            ? `${rows[0].remaining} matchday${rows[0].remaining === 1 ? "" : "s"} left`
            : "Phase complete"}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-2 py-2 text-right">P</th>
              <th className="px-2 py-2 text-right">W</th>
              <th className="px-2 py-2 text-right">L</th>
              <th className="px-2 py-2 text-right">NRR</th>
              <th className="px-3 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.row.name}
                className={`border-t border-[color:var(--border)]/40 ${c.row.isOurs ? "bg-[color:var(--gold)]/10" : ""}`}
              >
                <td
                  className={`max-w-[11rem] truncate px-3 py-1.5 ${c.row.isOurs ? "font-semibold text-gold" : ""}`}
                >
                  <span className="mr-1.5 inline-block w-4 text-muted-foreground">{c.rank}</span>
                  {c.movement > 0 && (
                    <ArrowUp className="mr-1 inline h-3 w-3 text-[color:var(--accent)]" />
                  )}
                  {c.movement < 0 && (
                    <ArrowDown className="mr-1 inline h-3 w-3 text-[color:var(--destructive)]" />
                  )}
                  {c.row.name.replace(/ XI$/, "")}
                  {c.status && (
                    <span
                      className={`ml-1.5 rounded px-1 text-[9px] font-bold ${c.status === "Q" ? "bg-[color:var(--accent)]/20 text-[color:var(--accent)]" : "bg-[color:var(--destructive)]/20 text-[color:var(--destructive)]"}`}
                    >
                      {c.status}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">{c.row.played}</td>
                <td className="px-2 py-1.5 text-right">{c.row.wins}</td>
                <td className="px-2 py-1.5 text-right">{c.row.losses}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNrr(c.nrr)}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{c.row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[10px] text-muted-foreground">
        Q = qualified · E = eliminated (guaranteed on points)
      </div>
    </div>
  );
}

/* ---------- Story moment ---------- */
export function StoryMomentBanner({
  moment,
  onDone,
}: {
  moment: StoryMoment | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [moment, onDone]);
  return (
    <AnimatePresence>
      {moment && (
        <motion.button
          key={moment.id}
          type="button"
          onClick={onDone}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className={`fixed left-1/2 top-4 z-30 w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border px-5 py-3 text-center backdrop-blur ${
            moment.tone === "gold"
              ? "glow-gold border-[color:var(--gold)]/60 bg-[color:var(--card)]/90"
              : moment.tone === "accent"
                ? "border-[color:var(--accent)]/50 bg-[color:var(--card)]/90"
                : "border-[color:var(--border)] bg-[color:var(--card)]/90"
          }`}
        >
          <div
            className={`text-lg font-black tracking-[0.2em] ${moment.tone === "gold" ? "text-gold" : moment.tone === "accent" ? "text-[color:var(--accent)]" : ""}`}
          >
            {moment.title}
          </div>
          <div className="text-xs text-muted-foreground">{moment.subtitle}</div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
