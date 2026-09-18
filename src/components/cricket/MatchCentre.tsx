import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, FileText, Pause, Play, SkipForward, X } from "lucide-react";
import type {
  LimitedScorecard,
  MatchResult,
  TestScorecard,
  TimelineInnings,
} from "@/lib/cricket/types";
import {
  ballCommentary,
  milestonesAt,
  oversText,
  snapshotAt,
  testProgress,
  type Milestone,
} from "@/lib/cricket/matchcentre";
import { momentumLabel, pressureLabel } from "@/lib/cricket/momentum";

interface Props {
  result: MatchResult;
  momentum: number;
  pressure: number;
  chemistry: number;
  balance: string;
  onScorecard: () => void;
  onContinue: () => void;
}

const isLimited = (r: MatchResult): r is LimitedScorecard =>
  r.format === "T20" || r.format === "ODI";

export function MatchCentre(props: Props) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[color:var(--background)]/95 p-3 backdrop-blur-sm sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-4xl"
      >
        {isLimited(props.result) ? (
          <LimitedCentre {...props} result={props.result} />
        ) : (
          <TestCentre {...props} result={props.result as TestScorecard} />
        )}
      </motion.div>
    </div>
  );
}

/* ---------- Shared chrome ---------- */

function Shell({
  title,
  subtitle,
  children,
  momentum,
  pressure,
  chemistry,
  balance,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  momentum: number;
  pressure: number;
  chemistry: number;
  balance: string;
}) {
  return (
    <div className="glass-card overflow-hidden rounded-2xl border border-[color:var(--gold)]/30">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3 sm:px-5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gold">Match Centre</div>
          <h3 className="mt-0.5 text-lg font-bold sm:text-xl">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <Chip label="Momentum" value={momentumLabel(momentum)} />
          <Chip label="Pressure" value={pressureLabel(pressure)} />
          <Chip label="Chemistry" value={String(chemistry)} />
          <Chip label="Balance" value={balance} />
        </div>
      </div>
      {children}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/40 px-2.5 py-1">
      {label} <span className="text-gold">{value}</span>
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-3 py-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${accent ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}

/* ---------- Limited-overs Match Centre ---------- */

function LimitedCentre({
  result: r,
  momentum,
  pressure,
  chemistry,
  balance,
  onScorecard,
  onContinue,
}: Props & { result: LimitedScorecard }) {
  const timeline = useMemo(() => r.timeline ?? [], [r]);
  const totalBalls = useMemo(
    () => timeline.reduce((s, inn) => s + inn.balls.length, 0),
    [timeline],
  );
  // One flat cursor across both innings keeps the reveal simple and monotonic.
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const mounted = useRef(false);

  const step = Math.max(1, Math.ceil(totalBalls / 110));

  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (!playing || totalBalls === 0 || cursor >= totalBalls) return;
    const t = setTimeout(() => setCursor((c) => Math.min(totalBalls, c + step)), 130);
    return () => clearTimeout(t);
  }, [playing, cursor, totalBalls, step]);

  // Resolve the flat cursor into an innings + ball index.
  const { inningsIndex, ballIdx, lastGlobal } = useMemo(() => {
    let remaining = cursor;
    for (let i = 0; i < timeline.length; i++) {
      const len = timeline[i].balls.length;
      if (remaining <= len && (remaining < len || i === timeline.length - 1)) {
        return { inningsIndex: i, ballIdx: remaining, lastGlobal: cursor };
      }
      remaining -= len;
    }
    const li = Math.max(0, timeline.length - 1);
    return { inningsIndex: li, ballIdx: timeline[li]?.balls.length ?? 0, lastGlobal: cursor };
  }, [cursor, timeline]);

  const snap = useMemo(
    () => snapshotAt(r, inningsIndex, ballIdx, momentum),
    [r, inningsIndex, ballIdx, momentum],
  );
  const inn: TimelineInnings | undefined = timeline[inningsIndex];
  const finished = totalBalls === 0 || cursor >= totalBalls;

  // Milestone banner: only from milestones actually reached in the revealed balls.
  useEffect(() => {
    if (!inn || ballIdx === 0) return;
    for (let i = Math.max(0, ballIdx - step); i < ballIdx; i++) {
      const ms = milestonesAt(inn, i);
      if (ms.length) {
        setMilestone(ms[0]);
        return;
      }
    }
  }, [inn, ballIdx, step]);

  useEffect(() => {
    if (!milestone) return;
    const t = setTimeout(() => setMilestone(null), 2600);
    return () => clearTimeout(t);
  }, [milestone]);

  const ourShown = shownScore(r, r.ourName, timeline, cursor);
  const oppShown = shownScore(r, r.oppName, timeline, cursor);

  return (
    <Shell
      title={`${r.ourName} vs ${r.oppName}`}
      subtitle={`${r.stage} · ${r.format} · ${r.venue} · ${r.pitch} pitch · ${r.weather}`}
      momentum={momentum}
      pressure={pressure}
      chemistry={chemistry}
      balance={balance}
    >
      {/* Scoreline */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-5">
        <ScoreSide name={r.ourName} line={ourShown} live={snap?.battingTeam === r.ourName} />
        <ScoreSide
          name={r.oppName}
          line={oppShown}
          live={snap?.battingTeam === r.oppName}
          align="right"
        />
      </div>

      <div className="px-4 pb-3 text-center sm:px-5">
        {finished ? (
          <div
            className={`text-xl font-black ${r.weWon ? "text-[color:var(--accent)]" : "text-[color:var(--destructive)]"}`}
          >
            {r.weWon ? "WON" : "LOST"}
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {r.marginText}
            </div>
          </div>
        ) : (
          <div className="text-xs uppercase tracking-widest text-gold">
            {snap?.label} · {snap?.phase}
          </div>
        )}
      </div>

      {/* Milestone */}
      <AnimatePresence>
        {milestone && !finished && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mb-3 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-center text-xs font-semibold text-gold sm:mx-5"
          >
            {milestone.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Situation */}
      {snap && (
        <div className="mx-4 mb-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/30 px-4 py-2 text-center text-xs sm:mx-5">
          {finished ? r.resultLine : snap.situation}
        </div>
      )}

      {/* Key numbers */}
      {snap && (
        <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4 sm:px-5">
          <Stat label="Current RR" value={snap.currentRunRate.toFixed(2)} />
          {snap.target !== undefined && <Stat label="Target" value={String(snap.target)} accent />}
          {snap.requiredRunRate !== undefined ? (
            <Stat label="Required RR" value={snap.requiredRunRate.toFixed(2)} accent />
          ) : (
            <Stat label="Overs" value={`${snap.overs} / ${inn?.maxOvers ?? 0}`} />
          )}
          {snap.runsRequired !== undefined ? (
            <Stat label="Need" value={`${snap.runsRequired} off ${snap.ballsRemaining}`} accent />
          ) : (
            <Stat label="Overs left" value={snap.oversRemaining} />
          )}
        </div>
      )}

      {/* Partnership + players */}
      {snap && !finished && (
        <div className="mt-2 grid grid-cols-1 gap-2 px-4 sm:grid-cols-3 sm:px-5">
          <Stat
            label={`${ordinalLabel(snap.partnership.wicket)} wicket stand`}
            value={`${snap.partnership.runs} runs · ${snap.partnership.balls} balls`}
          />
          <Stat
            label="On strike"
            value={
              snap.striker
                ? `${snap.striker.name} ${snap.striker.runs} (${snap.striker.balls})`
                : "—"
            }
          />
          <Stat
            label="Bowling"
            value={
              snap.bowler
                ? `${snap.bowler.name} ${snap.bowler.wickets}/${snap.bowler.runs} (${oversText(snap.bowler.balls)})`
                : "—"
            }
          />
        </div>
      )}

      {/* Win probability */}
      {snap && (
        <div className="mt-4 px-4 sm:px-5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Win probability (estimate)</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--muted)]">
            <motion.div
              className="h-full rounded-full bg-[color:var(--gold)]"
              animate={{ width: `${snap.winProbUs}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-gold">
              {r.ourName} {snap.winProbUs}%
            </span>
            <span className="text-muted-foreground">
              {r.oppName} {100 - snap.winProbUs}%
            </span>
          </div>
        </div>
      )}

      {/* Recent events */}
      {snap && inn && snap.recent.length > 0 && (
        <div className="mt-4 px-4 sm:px-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Recent events
          </div>
          <ul className="mt-2 space-y-1.5">
            {snap.recent.map((e, i) => (
              <li
                key={`${e.over}.${e.ball}-${i}`}
                className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-xs ${
                  i === 0
                    ? "border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10"
                    : "border-[color:var(--border)] bg-white/[0.02] text-muted-foreground"
                }`}
              >
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {e.over}.{e.ball}
                </span>
                <span
                  className={`shrink-0 font-semibold ${e.wicket ? "text-[color:var(--destructive)]" : ""}`}
                >
                  {e.wicket ? "W" : e.runs}
                </span>
                <span className="min-w-0 break-words">
                  {ballCommentary(e, inn, snap.runsRequired)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Final commentary */}
      {finished && (
        <ul className="mt-4 space-y-1 px-4 text-xs text-muted-foreground sm:px-5">
          {r.highlights.slice(-4).map((h, i) => (
            <li key={i}>• {h}</li>
          ))}
        </ul>
      )}

      <Controls
        finished={finished}
        playing={playing}
        onToggle={() => setPlaying((p) => !p)}
        onSkip={() => setCursor(totalBalls)}
        onScorecard={onScorecard}
        onContinue={onContinue}
        progress={totalBalls ? Math.round((lastGlobal / totalBalls) * 100) : 100}
      />
    </Shell>
  );
}

function ordinalLabel(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function shownScore(
  r: LimitedScorecard,
  team: string,
  timeline: TimelineInnings[],
  cursor: number,
): string {
  let consumed = 0;
  for (const inn of timeline) {
    const take = Math.max(0, Math.min(inn.balls.length, cursor - consumed));
    consumed += inn.balls.length;
    if (inn.teamName !== team) continue;
    if (take === 0) return "yet to bat";
    const last = inn.balls[take - 1];
    return `${last.score}/${last.wickets} (${oversText(take)})`;
  }
  // Fallback for a result without a timeline (never expected).
  const inn = team === r.ourName ? r.ourInnings : r.oppInnings;
  return `${inn.runs}/${inn.wickets} (${inn.overs.toFixed(1)})`;
}

function ScoreSide({
  name,
  line,
  live,
  align = "left",
}: {
  name: string;
  line: string;
  live?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground"
        style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}
      >
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--gold)]" />}
        <span className="truncate">{name}</span>
      </div>
      <div className="mt-1 text-2xl font-black sm:text-3xl">{line}</div>
    </div>
  );
}

function Controls({
  finished,
  playing,
  onToggle,
  onSkip,
  onScorecard,
  onContinue,
  progress,
}: {
  finished: boolean;
  playing: boolean;
  onToggle: () => void;
  onSkip: () => void;
  onScorecard: () => void;
  onContinue: () => void;
  progress: number;
}) {
  return (
    <>
      <div className="mt-4 h-1 w-full bg-[color:var(--muted)]">
        <div
          className="h-full bg-[color:var(--gold)]/60 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--border)] px-4 py-3 sm:px-5">
        {!finished && (
          <>
            <button
              onClick={onToggle}
              className="btn-ghost-gold inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? "Pause" : "Resume"}
            </button>
            <button
              onClick={onSkip}
              className="btn-ghost-gold inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs"
            >
              <SkipForward className="h-3.5 w-3.5" /> Skip to result
            </button>
          </>
        )}
        {finished && (
          <button
            onClick={onScorecard}
            className="btn-ghost-gold inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs"
          >
            <FileText className="h-3.5 w-3.5" /> Full Scorecard
          </button>
        )}
        <button
          onClick={onContinue}
          className="btn-gold inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold"
        >
          {finished ? "Continue" : "Close"}{" "}
          {finished ? <ArrowRight className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </button>
      </div>
    </>
  );
}

/* ---------- Test Match Centre ---------- */

function TestCentre({
  result: r,
  momentum,
  pressure,
  chemistry,
  balance,
  onScorecard,
  onContinue,
}: Props & { result: TestScorecard }) {
  const cards = useMemo(() => testProgress(r), [r]);
  const [shown, setShown] = useState(1);
  const [playing, setPlaying] = useState(true);
  const finished = shown >= cards.length;

  useEffect(() => {
    if (!playing || finished) return;
    const t = setTimeout(() => setShown((s) => Math.min(cards.length, s + 1)), 1400);
    return () => clearTimeout(t);
  }, [playing, shown, finished, cards.length]);

  const visible = cards.slice(0, shown);
  const current = visible[visible.length - 1];

  return (
    <Shell
      title={`${r.ourName} vs ${r.oppName}`}
      subtitle={`${r.stage} · Test · ${r.venue} · ${r.pitch} pitch · ${r.weather}`}
      momentum={momentum}
      pressure={pressure}
      chemistry={chemistry}
      balance={balance}
    >
      <div className="px-4 py-4 sm:px-5">
        <div className="space-y-2">
          {visible.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${
                c.isOurs
                  ? "border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5"
                  : "border-[color:var(--border)] bg-white/[0.02]"
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-xs uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </div>
                <div className="mt-0.5 text-lg font-bold">
                  {c.runs}
                  {c.declared ? "d" : ""}/{c.wickets}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({c.overs.toFixed(1)} ov)
                  </span>
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-muted-foreground">{c.note}</div>
                {c.target !== undefined && (
                  <div className="mt-0.5 text-gold">Chasing {c.target}</div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Match state"
            value={
              finished
                ? r.result === "DRAW"
                  ? "Match drawn"
                  : r.marginText
                : current
                  ? current.leadAfter >= 0
                    ? `${current.teamName} lead by ${current.leadAfter}`
                    : `${current.teamName} trail by ${Math.abs(current.leadAfter)}`
                  : "—"
            }
            accent
          />
          <Stat label="Innings" value={`${visible.length} of ${cards.length}`} />
          <Stat
            label="Wickets in hand"
            value={current ? String(Math.max(0, 10 - current.wickets)) : "—"}
          />
          <Stat label="Player of the Match" value={finished ? r.playerOfMatch : "—"} />
        </div>

        {finished && (
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            {r.highlights.slice(-5).map((h, i) => (
              <li key={i}>• {h}</li>
            ))}
          </ul>
        )}
      </div>

      <Controls
        finished={finished}
        playing={playing}
        onToggle={() => setPlaying((p) => !p)}
        onSkip={() => setShown(cards.length)}
        onScorecard={onScorecard}
        onContinue={onContinue}
        progress={cards.length ? Math.round((shown / cards.length) * 100) : 100}
      />
    </Shell>
  );
}
