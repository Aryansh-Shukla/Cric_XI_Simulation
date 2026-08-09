import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  CloudRain,
  Sun,
  Cloud,
  Moon,
  ArrowRight,
  RotateCcw,
  MapPin,
  Coins,
  Play,
  FileText,
  BarChart3,
  ListOrdered,
  AlertTriangle,
} from "lucide-react";
import type {
  GameMode,
  Player,
  Weather,
  MatchResult,
  LimitedScorecard,
  TestScorecard,
  Innings,
  PlayerAgg,
} from "@/lib/cricket/types";
import {
  createTournament,
  advanceTournament,
  topRunScorers,
  topWicketTakers,
  standingsTable,
  netRunRate,
  campaignAwards,
  type TournamentState,
} from "@/lib/cricket/tournament";
import { MODE_LABELS } from "@/lib/cricket/data";
import { recordChampion } from "@/lib/cricket/champions";
import { ScorecardModal } from "./ScorecardModal";

interface Props {
  players: Player[];
  mode: GameMode;
  leadership?: { captainId: string; viceCaptainId: string; keeperId: string } | null;
  /** Optional custom team identity; falls back to the default squad naming. */
  teamName?: string;
  onRestart: () => void;
}

const weatherIcon = (w: Weather) => {
  switch (w) {
    case "Sunny":
      return Sun;
    case "Cloudy":
      return Cloud;
    case "Humid":
      return CloudRain;
    case "Night Match":
      return Moon;
  }
};

const isLimited = (r: MatchResult): r is LimitedScorecard =>
  r.format === "T20" || r.format === "ODI";
const isTest = (r: MatchResult): r is TestScorecard => r.format === "TEST";

function formatOvers(o: number) {
  return o.toFixed(1);
}

/* ---------- Error boundary ---------- */
class TournamentBoundary extends Component<
  { children: ReactNode; onRestart: () => void },
  { err: Error | null }
> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error) {
    console.error("[tournament]", err);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--destructive)]" />
          <h3 className="mt-4 text-2xl font-bold">Tournament crashed</h3>
          <p className="mt-2 text-sm text-muted-foreground">{this.state.err.message}</p>
          <button
            onClick={this.props.onRestart}
            className="btn-gold mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
          >
            Start Over <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- Main ---------- */
export function TournamentView(props: Props) {
  return (
    <TournamentBoundary onRestart={props.onRestart}>
      <TournamentInner {...props} />
    </TournamentBoundary>
  );
}

type Tab = "matches" | "leaders" | "standings";

function TournamentInner({ players, mode, leadership, teamName, onRestart }: Props) {
  const ourName = teamName?.trim() || undefined;
  const [state, setState] = useState<TournamentState>(() =>
    createTournament(players, mode, undefined, leadership?.captainId, ourName),
  );
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("matches");
  const [scorecard, setScorecard] = useState<MatchResult | null>(null);
  const recorded = useRef(false);

  // Persist a real champions-feed record once the campaign is won.
  useEffect(() => {
    if (!state.complete || !state.championshipWon || recorded.current) return;
    recorded.current = true;
    const tournament = MODE_LABELS[mode].title;
    recordChampion({
      teamName: state.ourName,
      tournament,
      achievement: `Won ${tournament}`,
      score: state.finalScore,
    });
  }, [state.complete, state.championshipWon, state.ourName, state.finalScore, mode]);

  const nextFixture = state.fixtures[state.currentIndex];
  const done = state.complete;
  const won = state.championshipWon;

  const runScorers = useMemo(() => topRunScorers(state), [state]);
  const wicketTakers = useMemo(() => topWicketTakers(state), [state]);

  const play = () => {
    if (busy || done) return;
    setBusy(true);
    // Yield to allow spinner paint before heavy sim
    setTimeout(() => {
      setState((prev) => advanceTournament(prev));
      setBusy(false);
    }, 60);
  };

  return (
    <div className="relative min-h-screen px-6 py-10">
      {won && <Confetti />}
      <div className="mx-auto max-w-5xl">
        <Header state={state} mode={mode} onRestart={onRestart} />
        <StageTimeline state={state} />

        <div className="mt-6 flex flex-wrap gap-2">
          <TabButton
            active={tab === "matches"}
            onClick={() => setTab("matches")}
            icon={<Play className="h-3.5 w-3.5" />}
          >
            Matches
          </TabButton>
          <TabButton
            active={tab === "leaders"}
            onClick={() => setTab("leaders")}
            icon={<BarChart3 className="h-3.5 w-3.5" />}
          >
            Leaders
          </TabButton>
          <TabButton
            active={tab === "standings"}
            onClick={() => setTab("standings")}
            icon={<ListOrdered className="h-3.5 w-3.5" />}
          >
            Standings
          </TabButton>
        </div>

        <div className="mt-4 space-y-4">
          {tab === "matches" && (
            <>
              <AnimatePresence>
                {state.results.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    {isLimited(r) ? (
                      <LimitedCard r={r} onView={() => setScorecard(r)} />
                    ) : (
                      <TestCard r={r as TestScorecard} onView={() => setScorecard(r)} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {!done && nextFixture && <NextMatchCard state={state} onPlay={play} busy={busy} />}

              {done && <FinaleCard state={state} mode={mode} onRestart={onRestart} />}
            </>
          )}

          {tab === "leaders" && (
            <LeadersPanel runScorers={runScorers} wicketTakers={wicketTakers} />
          )}
          {tab === "standings" && <StandingsPanel state={state} />}
        </div>
      </div>

      <ScorecardModal result={scorecard} onClose={() => setScorecard(null)} />
    </div>
  );
}

/* ---------- Header ---------- */
function Header({
  state,
  mode,
  onRestart,
}: {
  state: TournamentState;
  mode: GameMode;
  onRestart: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-gold">
          {MODE_LABELS[mode].title} · Live Tournament
        </div>
        <h2 className="mt-1 text-3xl font-bold md:text-4xl">{state.ourName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Captain: <span className="text-foreground">{state.captain.name}</span>
          <span className="mx-2 opacity-40">·</span>
          Team Rating <span className="text-gold">{state.teamRatingSnapshot}</span>
          <span className="mx-2 opacity-40">·</span>
          Record{" "}
          <span className="text-foreground">
            {state.wins}W – {state.losses}L{state.draws ? ` – ${state.draws}D` : ""}
          </span>
        </p>
      </div>
      <button
        onClick={onRestart}
        className="btn-ghost-gold inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
      >
        <RotateCcw className="h-4 w-4" /> New Draft
      </button>
    </div>
  );
}

/* ---------- Tabs ---------- */
function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
        active
          ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-gold"
          : "border-[color:var(--border)] bg-[color:var(--muted)]/30 text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {children}
    </button>
  );
}

/* ---------- Next Match ---------- */
function NextMatchCard({
  state,
  onPlay,
  busy,
}: {
  state: TournamentState;
  onPlay: () => void;
  busy: boolean;
}) {
  const fx = state.fixtures[state.currentIndex];
  if (!fx) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl border border-[color:var(--gold)]/30 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Up Next · {fx.stage}</div>
          <h3 className="mt-1 text-2xl font-bold">
            {state.ourName} <span className="text-muted-foreground">vs</span> {fx.opponent.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Opponent rating <span className="text-foreground">{fx.opponent.rating}</span>
            <span className="mx-2 opacity-40">·</span>
            Match {state.currentIndex + 1} of {state.fixtures.length}
          </p>
        </div>
        <button
          onClick={onPlay}
          disabled={busy}
          className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Simulating…
            </>
          ) : (
            <>
              Simulate Match <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/* ---------- Finale ---------- */
function FinaleCard({
  state,
  mode,
  onRestart,
}: {
  state: TournamentState;
  mode: GameMode;
  onRestart: () => void;
}) {
  const won = state.championshipWon;
  return (
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
          : state.eliminated
            ? `Knocked out at the ${state.eliminatedAt}`
            : mode === "TEST"
              ? "Series Complete"
              : "Campaign Over"}
      </h3>
      <p className="mt-2 text-muted-foreground">
        {won
          ? `${state.ourName} has lifted the trophy. Legendary.`
          : mode === "TEST"
            ? state.seriesResult
            : `Record: ${state.wins}W – ${state.losses}L. Rebuild your XI and take another shot.`}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-1.5 text-sm text-gold">
        <Coins className="h-3.5 w-3.5" /> Score {state.finalScore}
      </div>
      {state.playerOfSeries && (
        <div className="mt-3 text-sm text-muted-foreground">
          Player of the Series: <span className="text-foreground">{state.playerOfSeries}</span>
        </div>
      )}
      <CampaignAwards state={state} />
      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={onRestart}
          className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
        >
          Play Again <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

/* ---------- Leaders / Standings ---------- */
function CampaignAwards({ state }: { state: TournamentState }) {
  const { batter, bowler } = useMemo(() => campaignAwards(state), [state]);
  if (!batter && !bowler) return null;
  const rankLabel = (rank: number) => (rank === 1 ? `Rank #1 🏆` : `Rank #${rank}`);
  return (
    <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
      <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Best Batter
        </div>
        {batter ? (
          <>
            <div className="mt-1 text-base font-semibold text-gold">{batter.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {batter.runs} runs · Avg {batter.average} · SR {batter.strikeRate}
            </div>
            <div className="mt-1 text-xs font-medium">
              {rankLabel(batter.rank)} <span className="text-muted-foreground">in Most Runs</span>
            </div>
          </>
        ) : (
          <div className="mt-1 text-xs text-muted-foreground">No runs recorded.</div>
        )}
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Best Bowler
        </div>
        {bowler ? (
          <>
            <div className="mt-1 text-base font-semibold text-gold">{bowler.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {bowler.wickets} wickets · Econ {bowler.economy}
            </div>
            <div className="mt-1 text-xs font-medium">
              {rankLabel(bowler.rank)}{" "}
              <span className="text-muted-foreground">in Most Wickets</span>
            </div>
          </>
        ) : (
          <div className="mt-1 text-xs text-muted-foreground">No wickets recorded.</div>
        )}
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4 sm:col-span-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Team Rating</span>
          <span className="font-semibold text-foreground">{state.teamRatingSnapshot}</span>
        </div>
      </div>
    </div>
  );
}

function LeadersPanel({
  runScorers,
  wicketTakers,
}: {
  runScorers: PlayerAgg[];
  wicketTakers: PlayerAgg[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LeaderTable title="Most Runs" rows={runScorers} kind="bat" />
      <LeaderTable title="Most Wickets" rows={wicketTakers} kind="bowl" />
    </div>
  );
}

function LeaderTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: PlayerAgg[];
  kind: "bat" | "bowl";
}) {
  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="border-b border-[color:var(--border)] px-4 py-3">
        <div className="text-xs uppercase tracking-widest text-gold">{title}</div>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          No data yet — play a match.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-right">M</th>
              {kind === "bat" ? (
                <>
                  <th className="px-3 py-2 text-right">R</th>
                  <th className="px-3 py-2 text-right">SR</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 text-right">W</th>
                  <th className="px-3 py-2 text-right">Econ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const sr = p.balls ? Math.round((p.runs * 100) / p.balls) : 0;
              const econ = p.ballsBowled
                ? Math.round(((p.runsConceded * 6) / p.ballsBowled) * 100) / 100
                : 0;
              return (
                <tr
                  key={i}
                  className={`border-t border-[color:var(--border)]/40 ${p.isOurs ? "bg-[color:var(--gold)]/10" : ""}`}
                >
                  <td className="px-3 py-1.5">
                    <span className={p.isOurs ? "font-semibold text-gold" : ""}>{p.name}</span>
                  </td>
                  <td
                    className={`px-3 py-1.5 ${p.isOurs ? "text-gold/80" : "text-muted-foreground"}`}
                  >
                    {p.team}
                  </td>
                  <td className="px-3 py-1.5 text-right">{p.matches}</td>
                  {kind === "bat" ? (
                    <>
                      <td className="px-3 py-1.5 text-right font-semibold">{p.runs}</td>
                      <td className="px-3 py-1.5 text-right">{sr}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-1.5 text-right font-semibold">{p.wickets}</td>
                      <td className="px-3 py-1.5 text-right">{econ.toFixed(2)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StandingsPanel({ state }: { state: TournamentState }) {
  // Whole-tournament table: user matches plus every background AI matchday.
  const rows = standingsTable(state);

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="border-b border-[color:var(--border)] px-4 py-3">
        <div className="text-xs uppercase tracking-widest text-gold">Standings</div>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          Play a match to populate the table.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-right">P</th>
              <th className="px-3 py-2 text-right">W</th>
              <th className="px-3 py-2 text-right">L</th>
              <th className="px-3 py-2 text-right">NRR</th>
              <th className="px-3 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const nrr = netRunRate(r);
              return (
                <tr
                  key={r.name}
                  className={`border-t border-[color:var(--border)]/40 ${r.isOurs ? "bg-[color:var(--gold)]/10" : ""}`}
                >
                  <td className={`px-3 py-1.5 ${r.isOurs ? "font-semibold text-gold" : ""}`}>
                    <span className="mr-2 text-muted-foreground">{i + 1}</span>
                    {r.name}
                  </td>
                  <td className="px-3 py-1.5 text-right">{r.played}</td>
                  <td className="px-3 py-1.5 text-right">{r.wins}</td>
                  <td className="px-3 py-1.5 text-right">{r.losses}</td>
                  <td className="px-3 py-1.5 text-right">
                    {nrr > 0 ? `+${nrr.toFixed(2)}` : nrr.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------- Match cards ---------- */
function StageTimeline({ state }: { state: TournamentState }) {
  // Drive the timeline from the live bracket, not the provisional stage list —
  // e.g. winning Qualifier 1 removes Qualifier 2 and shows the Final next.
  const stages = state.fixtures.map((f) => f.stage);
  return (
    <div className="mt-6 flex flex-wrap gap-1.5">
      {stages.map((s, i) => {
        const r = state.results[i];
        const played = i < state.results.length && r;
        const outcome = played
          ? isTest(r!)
            ? r!.result
            : (r as LimitedScorecard).weWon
              ? "WON"
              : "LOST"
          : null;
        const color =
          outcome === "WON"
            ? "border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
            : outcome === "LOST"
              ? "border-[color:var(--destructive)]/50 bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]"
              : outcome === "DRAW"
                ? "border-white/20 bg-white/5"
                : i === state.currentIndex && !state.complete
                  ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-gold animate-pulse"
                  : "border-[color:var(--border)] bg-[color:var(--muted)]/40 text-muted-foreground";
        return (
          <span
            key={i}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${color}`}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

function LimitedCard({ r, onView }: { r: LimitedScorecard; onView: () => void }) {
  return <LimitedCardInner r={r} onView={onView} />;
}

/** Super Over breakdown — shown wherever a tied match is reported. */
function SuperOverStrip({ r }: { r: LimitedScorecard }) {
  const so = r.superOver!;
  return (
    <div className="border-t border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 px-5 py-3">
      <div className="text-[10px] uppercase tracking-widest text-gold">Match tied · Super Over</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span>
          {so.ours.teamName}{" "}
          <span className="font-bold">
            {so.ours.runs}/{so.ours.wickets}
          </span>
        </span>
        <span>
          {so.opp.teamName}{" "}
          <span className="font-bold">
            {so.opp.runs}/{so.opp.wickets}
          </span>
        </span>
        <span className="text-gold">{so.winner} won the Super Over</span>
      </div>
    </div>
  );
}

function LimitedCardInner({ r, onView }: { r: LimitedScorecard; onView: () => void }) {
  const WIcon = weatherIcon(r.weather);
  const ringClass = r.weWon
    ? "ring-1 ring-[color:var(--accent)]/40"
    : "ring-1 ring-[color:var(--destructive)]/40";
  const tossText = `${r.toss.winner === "us" ? r.ourName : r.oppName} won toss · chose to ${r.toss.decision}`;

  return (
    <div className={`glass-card overflow-hidden rounded-2xl ${ringClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[color:var(--gold)]/10 px-2.5 py-0.5 text-xs font-semibold text-gold">
            {r.stage}
          </span>
          <span className="text-sm text-muted-foreground">
            {r.format} · vs {r.oppName}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {r.venue}
          </span>
          <span className="inline-flex items-center gap-1">
            <WIcon className="h-3.5 w-3.5" /> {r.weather}
          </span>
          <span>Pitch: {r.pitch}</span>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[1fr,auto,1fr]">
        <InningsBlock title={r.ourName} innings={r.ourInnings} highlight={r.weWon} />
        <div className="flex flex-col items-center justify-center gap-1">
          <div
            className={`text-2xl font-black ${r.weWon ? "text-[color:var(--accent)]" : "text-[color:var(--destructive)]"}`}
          >
            {r.weWon ? "WON" : "LOST"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center max-w-[9rem]">
            {r.marginText}
          </div>
        </div>
        <InningsBlock title={r.oppName} innings={r.oppInnings} highlight={!r.weWon} align="right" />
      </div>

      {r.superOver && <SuperOverStrip r={r} />}

      <div className="border-t border-[color:var(--border)] px-5 py-3 text-xs text-muted-foreground">
        {tossText}
      </div>

      <div className="grid gap-3 border-t border-[color:var(--border)] px-5 py-4 md:grid-cols-3">
        <Meta
          label={`${r.ourInnings.teamName} top`}
          value={`${r.ourInnings.topScorer.name} · ${r.ourInnings.topScorer.runs} (${r.ourInnings.topScorer.balls})`}
        />
        <Meta
          label="Best bowler"
          value={`${bestOverallBowler(r).name} · ${bestOverallBowler(r).wickets}/${bestOverallBowler(r).runs}`}
        />
        <Meta label="Player of the Match" value={r.playerOfMatch} accent />
      </div>

      <ul className="space-y-1 border-t border-[color:var(--border)] px-5 py-3 text-sm text-muted-foreground">
        {r.highlights.map((h, k) => (
          <li key={k}>• {h}</li>
        ))}
      </ul>

      <div className="flex justify-end border-t border-[color:var(--border)] px-5 py-3">
        <button
          onClick={onView}
          className="btn-ghost-gold inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs"
        >
          <FileText className="h-3.5 w-3.5" /> View Scorecard
        </button>
      </div>
    </div>
  );
}

function bestOverallBowler(r: LimitedScorecard) {
  const a = r.ourInnings.bestBowler;
  const b = r.oppInnings.bestBowler;
  return a.wickets >= b.wickets ? a : b;
}

function InningsBlock({
  title,
  innings,
  highlight,
  align = "left",
}: {
  title: string;
  innings: Innings;
  highlight: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? "text-gold" : ""}`}>
        {innings.runs}/{innings.wickets}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          ({formatOvers(innings.overs)})
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">RR {innings.runRate}</div>
    </div>
  );
}

function TestCard({ r, onView }: { r: TestScorecard; onView: () => void }) {
  const WIcon = weatherIcon(r.weather);
  const ringClass =
    r.result === "WON"
      ? "ring-1 ring-[color:var(--accent)]/40"
      : r.result === "LOST"
        ? "ring-1 ring-[color:var(--destructive)]/40"
        : "ring-1 ring-white/10";
  const outcomeColor =
    r.result === "WON"
      ? "text-[color:var(--accent)]"
      : r.result === "LOST"
        ? "text-[color:var(--destructive)]"
        : "text-foreground";

  return (
    <div className={`glass-card overflow-hidden rounded-2xl ${ringClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[color:var(--gold)]/10 px-2.5 py-0.5 text-xs font-semibold text-gold">
            {r.stage}
          </span>
          <span className="text-sm text-muted-foreground">TEST · vs {r.oppName}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {r.venue}
          </span>
          <span className="inline-flex items-center gap-1">
            <WIcon className="h-3.5 w-3.5" /> {r.weather}
          </span>
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
        <TestSide
          title={r.oppName}
          innings={r.oppInnings}
          highlight={r.result === "LOST"}
          align="right"
        />
      </div>

      <div className="grid gap-3 border-t border-[color:var(--border)] px-5 py-4 md:grid-cols-3">
        <Meta
          label="Top scorer"
          value={`${r.ourInnings[0].topScorer.name} · ${r.ourInnings[0].topScorer.runs}`}
        />
        <Meta
          label="Best bowler"
          value={`${r.oppInnings[0].bestBowler.name} · ${r.oppInnings[0].bestBowler.wickets}/${r.oppInnings[0].bestBowler.runs}`}
        />
        <Meta label="Player of the Match" value={r.playerOfMatch} accent />
      </div>

      <ul className="space-y-1 border-t border-[color:var(--border)] px-5 py-3 text-sm text-muted-foreground">
        {r.highlights.map((h, k) => (
          <li key={k}>• {h}</li>
        ))}
      </ul>

      <div className="flex justify-end border-t border-[color:var(--border)] px-5 py-3">
        <button
          onClick={onView}
          className="btn-ghost-gold inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs"
        >
          <FileText className="h-3.5 w-3.5" /> View Scorecard
        </button>
      </div>
    </div>
  );
}

function TestSide({
  title,
  innings,
  highlight,
  align = "left",
}: {
  title: string;
  innings: Innings[];
  highlight: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      {innings.map((inn, i) => (
        <div
          key={i}
          className={`mt-1 text-lg font-bold ${highlight && i === innings.length - 1 ? "text-gold" : ""}`}
        >
          {i === 0 ? "1st" : "2nd"}: {inn.runs}/{inn.wickets}
          {inn.declared && <span className="ml-1 text-[10px] font-normal text-gold">dec</span>}
          {inn.followOn && (
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">(f/o)</span>
          )}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({formatOvers(inn.overs)})
          </span>
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
