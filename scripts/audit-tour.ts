import { createTournament, advanceTournament } from "@/lib/cricket/tournament";
import { DraftPoolService } from "@/services/DraftPoolService";
import type { GameMode } from "@/lib/cricket/types";
import { overall } from "@/lib/cricket/rating";

const modes: GameMode[] = ["ODI_WC", "T20_WC", "CHAMPIONS", "FRANCHISE_T20", "TEST"];
for (const mode of modes) {
  let ok = 0, err = 0, fx = 0, done = 0, ai = 0, titles = 0;
  for (let run = 0; run < 20; run++) {
    try {
      const pool = DraftPoolService.getPool(mode);
      const xi = [...pool[run % pool.length].players].sort((a,b)=>overall(b)-overall(a)).slice(0,11);
      let st = createTournament(xi, mode, 1000 + run);
      fx += st.fixtures.length;
      let guard = 0;
      while (!st.complete && guard++ < 50) st = advanceTournament(st);
      done += st.results.length; ai += st.aiResults.length;
      if (st.championshipWon) titles++;
      if (!st.complete) throw new Error("did not complete");
      ok++;
    } catch (e) { err++; if (err < 3) console.log(mode, "ERR", (e as Error).message); }
  }
  console.log(`${mode}: runs ok=${ok} err=${err} | fixtures=${fx} userMatches=${done} aiMatches=${ai} titles=${titles}`);
}
