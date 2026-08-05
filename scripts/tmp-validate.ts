import { DraftPoolService } from "@/services/DraftPoolService";
import { RerollService } from "@/services/RerollService";
import { createTournament, advanceTournament, standingsTable, netRunRate, campaignAwards } from "@/lib/cricket/tournament";
import type { GameMode } from "@/lib/cricket/types";

const modes: GameMode[] = ["ODI_WC","T20_WC","CHAMPIONS","FRANCHISE_T20","TEST"];
let bad1=0,bad2=0,checked=0;
for (const m of modes) {
  const pool = DraftPoolService.getPool(m);
  for (const s of pool) {
    for (const a of RerollService.sameTeamDifferentYear(s, m)) {
      checked++;
      if (s.teamId ? a.teamId !== s.teamId : a.country !== s.country) bad1++;
      if (a.editionId && a.editionId === s.editionId) bad1++;
    }
    for (const a of RerollService.sameYearDifferentTeam(s, m)) {
      checked++;
      if (s.editionId ? a.editionId !== s.editionId : a.year !== s.year) bad2++;
    }
  }
}
console.log({checked, badSameTeam: bad1, badSameYear: bad2});

// NRR + tournament integrity
let nrrSignErrors=0, runs=0, completed=0;
for (const m of modes.filter(x=>x!=="TEST")) {
  for (let seed=1; seed<=8; seed++) {
    const pool = DraftPoolService.getPool(m);
    const players = pool[seed % pool.length].players.slice(0,11);
    let st = createTournament(players, m, seed*7919);
    let guard=0;
    while(!st.complete && guard++<40) st = advanceTournament(st);
    runs++; if (st.complete) completed++;
    const rows = standingsTable(st);
    for (const r of rows) {
      const nrr = netRunRate(r);
      if (r.played>0 && r.wins===r.played && nrr<0) nrrSignErrors++;
      if (r.played>0 && r.losses===r.played && nrr>0) nrrSignErrors++;
    }
    const aw = campaignAwards(st);
    if (aw.batter && (aw.batter.rank<1)) console.log("bad rank");
  }
}
console.log({runs, completed, nrrSignErrors});
// sample
const pool = DraftPoolService.getPool("ODI_WC");
let st = createTournament(pool[0].players.slice(0,11), "ODI_WC", 42);
for (let i=0;i<3 && !st.complete;i++) st = advanceTournament(st);
console.log(standingsTable(st).slice(0,4).map(r=>`${r.name} P${r.played} W${r.wins} NRR ${netRunRate(r)}`));
