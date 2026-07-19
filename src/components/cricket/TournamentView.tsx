import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, CloudRain, Sun, Cloud, Moon, ArrowRight, RotateCcw, MapPin, Coins } from "lucide-react";
import type {
  GameMode, Player, Weather, MatchResult, LimitedScorecard, TestScorecard, Innings,
} from "@/lib/cricket/types";
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

const isLimited = (r: MatchResult): r is LimitedScorecard =>
  r.format === "T20" || r.format === "ODI";
const isTest = (r: MatchResult): r is TestScorecard => r.format === "TEST";

function formatOvers(o: number) {
  return o.toFixed(1);
}

export function TournamentView({ players, mode, leadership, onRestart }: Props) {
  const [t] = useState<Tournament>(() =>
    simulateTournament(players, mode, undefined, leadership?.captainId),
  );
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (revealed >= t.results.length) return;
    const timer = setTimeout(() => setRevealed(r => r + 1), 1500);
    return () => clearTimeout(timer);
  }, [revealed, t.results.length]);

  const done = revealed >= t.results.length;
  const won = done && t.championshipWon;
  const nextStageLabel = t.stages[revealed] ?? t.finalStageReached;

  return (
    <div className="relative min-h-screen px-6 py-10">
      {won && <Confetti />}
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">
              {MODE_LABELS[mode].title} · Live Tournament
            </div>
            <h2 className="mt-1 text-3xl font-bold md:text-4xl">Tournament</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Captain: <span className="text-foreground">{t.captain.name}</span>
              <span className="mx-2 opacity-40">·</span>
              Team Rating <span className="text-gold">{t.teamRatingSnapshot}</span>
            </p>
          </div>
          <button onClick={onRestart} className="btn-ghost-gold inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <RotateCcw className="h-4 w-4" /> New Draft
          </button>
        </div>

        <StageTimeline stages={t.stages} results={t.results} revealed={revealed} />

        <div className="mt-6 space-y-4">
          <AnimatePresence>
            {t.results.slice(0, revealed).map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                {isLimited(r) ? <LimitedCard r={r} /> : <TestCard r={r as TestScorecard} />}
              </motion.div>
            ))}
          </AnimatePresence>

          {!done && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
              <div className="mx-auto mb-2 h-2 w-24 overflow-hidden rounded-full bg-white/10">
                <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1.2, repeat: Infinity }}
                  className="h-full w-1/2 bg-gradient-to-r from-transparent via-[color:var(--gold)] to-transparent" />
              </div>
              Simulating {nextStageLabel}…
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
                {won
                  ? "Champions!"
                  : t.eliminated
                    ? `Knocked out at the ${t.eliminatedAt}`
                    : mode === "TEST"
                      ? "Series Complete"
                      : "Campaign Over"}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {won
                  ? "Your XI has lifted the trophy. Legendary."
                  : mode === "TEST"
                    ? t.seriesResult
                    : `Record: ${t.wins}W – ${t.losses}L. Rebuild your XI and take another shot.`}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-1.5 text-sm text-gold">
                <Coins className="h-3.5 w-3.5" /> Score {t.finalScore}
              </div>
              {t.playerOfSeries && (
                <div className="mt-3 text-sm text-muted-foreground">
                  Player of the Series: <span className="text-foreground">{t.playerOfSeries}</span>
                </div>
              )}
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

function StageTimeline({ stages, results, revealed }: { stages: MatchResult["stage"][]; results: MatchResult[]; revealed: number }) {
  return (
    <div className="mt-6 flex flex-wrap gap-1.5">
      {stages.map((s, i) => {
        const r = results[i];
        const played = i < revealed && r;
        const outcome = played
          ? isTest(r!) ? r!.result : (r as LimitedScorecard).weWon ? "WON" : "LOST"
          : null;
        const color =
          outcome === "WON" ? "border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
          : outcome === "LOST" ? "border-[color:var(--destructive)]/50 bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]"
          : outcome === "DRAW" ? "border-white/20 bg-white/5"
          : i === revealed ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-gold animate-pulse"
          : "border-[color:var(--border)] bg-[color:var(--muted)]/40 text-muted-foreground";
        return (
          <span key={i} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${color}`}>
            {s}
          </span>
        );
      })}
    </div>
  );
}

function LimitedCard({ r }: { r: LimitedScorecard }) {
  const WIcon = weatherIcon(r.weather);
  const ringClass = r.weWon
    ? "ring-1 ring-[color:var(--accent)]/40"
    : "ring-1 ring-[color:var(--destructive)]/40";
  const tossText = `${r.toss.winner === "us" ? r.ourName : r.oppName} won toss · chose to ${r.toss.decision}`;

  return (
    <div className={`glass-card overflow-hidden rounded-2xl ${ringClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[color:var(--gold)]/10 px-2.5 py-0.5 text-xs font-semibold text-gold">{r.stage}</span>
          <span className="text-sm text-muted-foreground">{r.format} · vs {r.oppName}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {r.venue}</span>
          <span className="inline-flex items-center gap-1"><WIcon className="h-3.5 w-3.5" /> {r.weather}</span>
          <span>Pitch: {r.pitch}</span>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[1fr,auto,1fr]">
        <InningsBlock title={r.ourName} innings={r.ourInnings} highlight={r.weWon} />
        <div className="flex flex-col items-center justify-center gap-1">
          <div className={`text-2xl font-black ${r.weWon ? "text-[color:var(--accent)]" : "text-[color:var(--destructive)]"}`}>
            {r.weWon ? "WON" : "LOST"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center max-w-[9rem]">
            {r.marginText}
          </div>
        </div>
        <InningsBlock title={r.oppName} innings={r.oppInnings} highlight={!r.weWon} align="right" />
      </div>

      <div className="border-t border-[color:var(--border)] px-5 py-3 text-xs text-muted-foreground">
        {tossText}
      </div>

      <div className="grid gap-3 border-t border-[color:var(--border)] px-5 py-4 md:grid-cols-3">
        <Meta label={`${r.ourInnings.teamName} top`} value={`${r.ourInnings.topScorer.name} · ${r.ourInnings.topScorer.runs} (${r.ourInnings.topScorer.balls})`} />
        <Meta label="Best bowler" value={`${bestOverallBowler(r).name} · ${bestOverallBowler(r).wickets}/${bestOverallBowler(r).runs}`} />
        <Meta label="Player of the Match" value={r.playerOfMatch} accent />
      </div>

      <ul className="space-y-1 border-t border-[color:var(--border)] px-5 py-3 text-sm text-muted-foreground">
        {r.highlights.map((h, k) => <li key={k}>• {h}</li>)}
      </ul>
    </div>
  );
}

function bestOverallBowler(r: LimitedScorecard) {
  const a = r.ourInnings.bestBowler;
  const b = r.oppInnings.bestBowler;
  return a.wickets >= b.wickets ? a : b;
}

function InningsBlock({ title, innings, highlight, align = "left" }: { title: string; innings: Innings; highlight: boolean; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? "text-gold" : ""}`}>
        {innings.runs}/{innings.wickets}
        <span className="ml-1 text-sm font-normal text-muted-foreground">({formatOvers(innings.overs)})</span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">RR {innings.runRate}</div>
    </div>
  );
}

function TestCard({ r }: { r: TestScorecard }) {
  const WIcon = weatherIcon(r.weather);
  const ringClass =
    r.result === "WON" ? "ring-1 ring-[color:var(--accent)]/40"
    : r.result === "LOST" ? "ring-1 ring-[color:var(--destructive)]/40"
    : "ring-1 ring-white/10";
  const outcomeColor =
    r.result === "WON" ? "text-[color:var(--accent)]"
    : r.result === "LOST" ? "text-[color:var(--destructive)]"
    : "text-foreground";

  return (
    <div className={`glass-card overflow-hidden rounded-2xl ${ringClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[color:var(--gold)]/10 px-2.5 py-0.5 text-xs font-semibold text-gold">{r.stage}</span>
          <span className="text-sm text-muted-foreground">TEST · vs {r.oppName}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {r.venue}</span>
          <span className="inline-flex items-center gap-1"><WIcon className="h-3.5 w-3.5" /> {r.weather}</span>
          <span>Pitch: {r.pitch}</span>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[1fr,auto,1fr]">
        <TestSide title={r.ourName} innings={r.ourInnings} highlight={r.result === "WON"} />
        <div className="flex flex-col items-center justify-center gap-1">
          <div className={`text-2xl font-black ${outcomeColor}`}>{r.result}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center max-w-[10rem]">
            {r.marginText}
          </div>
        </div>
        <TestSide title={r.oppName} innings={r.oppInnings} highlight={r.result === "LOST"} align="right" />
      </div>

      <div className="grid gap-3 border-t border-[color:var(--border)] px-5 py-4 md:grid-cols-3">
        <Meta label="Top scorer" value={`${r.ourInnings[0].topScorer.name} · ${r.ourInnings[0].topScorer.runs}`} />
        <Meta label="Best bowler" value={`${r.oppInnings[0].bestBowler.name} · ${r.oppInnings[0].bestBowler.wickets}/${r.oppInnings[0].bestBowler.runs}`} />
        <Meta label="Player of the Match" value={r.playerOfMatch} accent />
      </div>

      <ul className="space-y-1 border-t border-[color:var(--border)] px-5 py-3 text-sm text-muted-foreground">
        {r.highlights.map((h, k) => <li key={k}>• {h}</li>)}
      </ul>
    </div>
  );
}

function TestSide({ title, innings, highlight, align = "left" }: { title: string; innings: Innings[]; highlight: boolean; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      {innings.map((inn, i) => (
        <div key={i} className={`mt-1 text-lg font-bold ${highlight && i === innings.length - 1 ? "text-gold" : ""}`}>
          {i === 0 ? "1st" : "2nd"}: {inn.runs}/{inn.wickets}
          {inn.declared && <span className="ml-1 text-[10px] font-normal text-gold">dec</span>}
          {inn.followOn && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(f/o)</span>}
          <span className="ml-1 text-xs font-normal text-muted-foreground">({formatOvers(inn.overs)})</span>
        </div>
      ))}
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