import { createTournament, advanceTournament, standingsTable, ourRank, netRunRate } from "@/lib/cricket/tournament";
import { DraftPoolService } from "@/services/DraftPoolService";
import { RerollService } from "@/services/RerollService";
import type { GameMode, LimitedScorecard } from "@/lib/cricket/types";
import { overall } from "@/lib/cricket/rating";

const modes: GameMode[] = ["ODI_WC", "T20_WC", "CHAMPIONS", "FRANCHISE_T20", "TEST"];
let badVenue = 0, superOvers = 0, badSO = 0;
const IPL_BAD = ["Trent Bridge", "Lord's", "MCG", "SCG", "Adelaide", "Basin", "Kensington", "Premadasa", "Gaddafi"];

for (const mode of modes) {
  let ok=0, err=0, illegalPlayoff=0, q2AfterQ1Win=0, elimAfterGroup=0, titles=0;
  for (let run = 0; run < 40; run++) {
    try {
      const pool = DraftPoolService.getPool(mode);
      const xi = [...pool[run % pool.length].players].sort((a,b)=>overall(b)-overall(a)).slice(0,11);
      let st = createTournament(xi, mode, 5000 + run);
      let g = 0;
      while (!st.complete && g++ < 60) {
        const prevStages = st.fixtures.map(f=>f.stage);
        st = advanceTournament(st);
        void prevStages;
      }
      if (!st.complete) throw new Error("incomplete");
      const played = st.results as LimitedScorecard[];
      for (const r of played) {
        if (mode === "FRANCHISE_T20" && IPL_BAD.some(v => r.venue?.includes(v))) badVenue++;
        if (r.superOver) {
          superOvers++;
          if (r.superOver.ours.runs === r.superOver.opp.runs) badSO++;
          if ((r.superOver.ours.runs > r.superOver.opp.runs) !== r.weWon) badSO++;
        }
      }
      const koPlayed = played.filter(r => ["Qualifier 1","Qualifier 2","Eliminator","Semi Final","Final"].includes(r.stage as string));
      if (mode === "FRANCHISE_T20") {
        if (koPlayed.length && (st.qualifiedRank ?? 99) > 4) illegalPlayoff++;
        const q1 = played.find(r => r.stage === "Qualifier 1");
        if (q1?.weWon) {
          if (played.some(r => r.stage === "Qualifier 2")) q2AfterQ1Win++;
          if (st.fixtures.some(f => f.stage === "Qualifier 2")) q2AfterQ1Win++;
        }
        if (koPlayed.length && (st.qualifiedRank === 1 || st.qualifiedRank === 2) && koPlayed[0].stage !== "Qualifier 1") illegalPlayoff++;
        if (koPlayed.length && (st.qualifiedRank === 3 || st.qualifiedRank === 4) && koPlayed[0].stage !== "Eliminator") illegalPlayoff++;
      }
      if (mode !== "TEST" && mode !== "FRANCHISE_T20") {
        if (koPlayed.length && (st.qualifiedRank ?? 99) > 4) illegalPlayoff++;
      }
      if (st.eliminated && !["Qualifier 1","Qualifier 2","Eliminator","Semi Final","Final"].includes(st.eliminatedAt as string)) elimAfterGroup++;
      if (st.championshipWon) titles++;
      for (const r of standingsTable(st)) if (!Number.isFinite(netRunRate(r))) throw new Error("bad nrr");
      void ourRank(st);
      ok++;
    } catch (e) { err++; if (err < 3) console.log(mode, "ERR", (e as Error).message); }
  }
  console.log(`${mode}: ok=${ok} err=${err} illegalPlayoff=${illegalPlayoff} q2AfterQ1Win=${q2AfterQ1Win} groupElim=${elimAfterGroup} titles=${titles}`);
}
console.log(`venueViolations(IPL)=${badVenue} superOvers=${superOvers} badSuperOvers=${badSO}`);

// Test reroll fallback
const tpool = DraftPoolService.getPool("TEST");
const t0 = tpool[0];
console.log("TEST reroll sameTeamDifferentYear:", RerollService.sameTeamDifferentYear(t0, "TEST").length,
  "sameYearDifferentTeam:", RerollService.sameYearDifferentTeam(t0, "TEST").length, "poolSize:", tpool.length);
