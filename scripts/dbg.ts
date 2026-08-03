import { createTournament, advanceTournament, standingsTable, netRunRate } from "@/lib/cricket/tournament";
import { DraftPoolService } from "@/services/DraftPoolService";
import { overall } from "@/lib/cricket/rating";
import type { GameMode } from "@/lib/cricket/types";
for (const mode of ["ODI_WC","T20_WC","CHAMPIONS","FRANCHISE_T20"] as GameMode[]) {
  const pool = DraftPoolService.getPool(mode);
  const xi = [...pool[0].players].sort((a,b)=>overall(b)-overall(a)).slice(0,11);
  let st = createTournament(xi, mode, 7); let g=0;
  while(!st.complete && g++<40) st = advanceTournament(st);
  console.log(`\n== ${mode} stages=${st.stages.join(",")} user=${st.results.length} ai=${st.aiResults.length} elim=${st.eliminated} champ=${st.championshipWon}`);
  console.log(standingsTable(st).map(r=>`${r.name.padEnd(38)} P${r.played} W${r.wins} L${r.losses} NRR${netRunRate(r).toFixed(2)} ${r.points}pts${r.isOurs?" *":""}`).join("\n"));
}
