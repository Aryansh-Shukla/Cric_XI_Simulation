import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MatchResult, FullInnings } from "@/lib/cricket/types";

interface Props {
  result: MatchResult | null;
  onClose: () => void;
}

export function ScorecardModal({ result, onClose }: Props) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="glass-card my-8 w-full max-w-4xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-gold">
                  {result.stage} · {result.format}
                </div>
                <div className="mt-1 text-lg font-bold">
                  {result.ourName} vs {result.oppName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {result.resultLine} · {result.venue}
                </div>
              </div>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 p-5">
              {"superOver" in result && result.superOver && (
                <div className="rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 p-4">
                  <div className="text-xs uppercase tracking-widest text-gold">Super Over</div>
                  <div className="mt-2 grid gap-1 text-sm">
                    <div className="flex justify-between">
                      <span>{result.superOver.ours.teamName}</span>
                      <span className="font-bold">
                        {result.superOver.ours.runs}/{result.superOver.ours.wickets}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{result.superOver.opp.teamName}</span>
                      <span className="font-bold">
                        {result.superOver.opp.runs}/{result.superOver.opp.wickets}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gold">
                      {result.superOver.winner} won the Super Over
                    </div>
                  </div>
                </div>
              )}
              {(result.full ?? []).map((inn, i) => (
                <InningsTable key={i} inn={inn} />
              ))}
              {!result.full?.length && (
                <div className="text-sm text-muted-foreground">
                  Detailed scorecard unavailable for this match.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InningsTable({ inn }: { inn: FullInnings }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-sm font-semibold text-gold">{inn.label ?? inn.teamName}</div>
        <div className="text-lg font-bold">
          {inn.runs}/{inn.wickets}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({inn.overs.toFixed(1)})
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[color:var(--border)]">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Batter</th>
              <th className="px-3 py-2 text-right">R</th>
              <th className="px-3 py-2 text-right">B</th>
              <th className="px-3 py-2 text-right">4s</th>
              <th className="px-3 py-2 text-right">6s</th>
              <th className="px-3 py-2 text-right">SR</th>
            </tr>
          </thead>
          <tbody>
            {inn.batters.map((b, i) => (
              <tr key={i} className="border-t border-[color:var(--border)]/40">
                <td className="px-3 py-1.5">
                  <span className={b.out ? "" : "text-foreground"}>{b.name}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {b.out ? (b.how ?? "out") : "not out"}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-semibold">{b.runs}</td>
                <td className="px-3 py-1.5 text-right">{b.balls}</td>
                <td className="px-3 py-1.5 text-right">{b.fours}</td>
                <td className="px-3 py-1.5 text-right">{b.sixes}</td>
                <td className="px-3 py-1.5 text-right">
                  {b.balls ? Math.round((b.runs * 100) / b.balls) : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-[color:var(--border)]">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Bowler</th>
              <th className="px-3 py-2 text-right">O</th>
              <th className="px-3 py-2 text-right">M</th>
              <th className="px-3 py-2 text-right">R</th>
              <th className="px-3 py-2 text-right">W</th>
              <th className="px-3 py-2 text-right">Econ</th>
            </tr>
          </thead>
          <tbody>
            {inn.bowlers.map((b, i) => (
              <tr key={i} className="border-t border-[color:var(--border)]/40">
                <td className="px-3 py-1.5">{b.name}</td>
                <td className="px-3 py-1.5 text-right">{b.overs.toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right">{b.maidens}</td>
                <td className="px-3 py-1.5 text-right">{b.runs}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{b.wickets}</td>
                <td className="px-3 py-1.5 text-right">{b.econ.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
