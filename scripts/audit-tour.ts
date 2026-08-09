import {
  createTournament,
  advanceTournament,
  standingsTable,
  netRunRate,
  topRunScorers,
  topWicketTakers,
} from "@/lib/cricket/tournament";
import { DraftPoolService } from "@/services/DraftPoolService";
import type { GameMode } from "@/lib/cricket/types";
import { overall } from "@/lib/cricket/rating";

const modes: GameMode[] = ["ODI_WC", "T20_WC", "CHAMPIONS", "FRANCHISE_T20", "TEST"];
for (const mode of modes) {
  let ok = 0,
    err = 0,
    fx = 0,
    done = 0,
    ai = 0,
    titles = 0,
    elim = 0,
    goldBat = 0,
    goldBowl = 0,
    badNrr = 0,
    badPts = 0;
  for (let run = 0; run < 25; run++) {
    try {
      const pool = DraftPoolService.getPool(mode);
      const xi = [...pool[run % pool.length].players]
        .sort((a, b) => overall(b) - overall(a))
        .slice(0, 11);
      let st = createTournament(xi, mode, 1000 + run);
      fx += st.fixtures.length;
      let g = 0;
      while (!st.complete && g++ < 60) st = advanceTournament(st);
      if (!st.complete) throw new Error("incomplete");
      done += st.results.length;
      ai += st.aiResults.length;
      if (st.championshipWon) titles++;
      if (st.eliminated) elim++;
      if (topRunScorers(st).some((p) => p.isOurs)) goldBat++;
      if (topWicketTakers(st).some((p) => p.isOurs)) goldBowl++;
      for (const r of standingsTable(st)) {
        if (r.points !== r.wins * 2) badPts++;
        if (r.played !== r.wins + r.losses) badPts++;
        if (!Number.isFinite(netRunRate(r))) badNrr++;
      }
      ok++;
    } catch (e) {
      err++;
      if (err < 3) console.log(mode, "ERR", (e as Error).message);
    }
  }
  console.log(
    `${mode}: ok=${ok} err=${err} fixtures=${fx} userMatches=${done} aiMatches=${ai} titles=${titles} eliminated=${elim} ourBatterInTop=${goldBat} ourBowlerInTop=${goldBowl} badPts=${badPts} badNRR=${badNrr}`,
  );
}
