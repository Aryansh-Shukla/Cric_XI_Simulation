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

// playoff path check
import { createTournament as ct2, advanceTournament as adv2, standingsTable as stb2 } from "@/lib/cricket/tournament";
{
  const pool = DraftPoolService.getPool("FRANCHISE_T20");
  const xi = [...pool[3].players].sort((a,b)=>overall(b)-overall(a)).slice(0,11);
  let st = ct2(xi, "FRANCHISE_T20", 99); let g=0;
  const path: string[] = [];
  while(!st.complete && g++<40) { const fx = st.fixtures[st.currentIndex]; st = adv2(st); const r:any = st.results[st.results.length-1]; if (r) path.push(`${r.stage} vs ${r.oppName} -> ${r.weWon?"W":"L"}`); }
  console.log("\nIPL playoff path:\n" + path.join("\n"));
  console.log("Top4 at end:", stb2(st).slice(0,4).map(r=>r.name).join(" | "));
}
