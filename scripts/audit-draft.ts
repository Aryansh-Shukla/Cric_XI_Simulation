import { DraftPoolService } from "@/services/DraftPoolService";
import { PlayerEligibilityService } from "@/services/PlayerEligibilityService";
import { canPickPlayer, computeStatus } from "@/lib/cricket/requirements";
import type { GameMode, Player } from "@/lib/cricket/types";

const modes: GameMode[] = ["ODI_WC","T20_WC","CHAMPIONS","FRANCHISE_T20","TEST"];
for (const mode of modes) {
  const pool = DraftPoolService.getPool(mode);
  let deadEnds=0, invalidXI=0, dupes=0, overseasBreach=0, runs=3000;
  for (let r=0;r<runs;r++){
    const picked: Player[] = [];
    for (let round=0; round<11; round++){
      const slots = 11-picked.length;
      // adversarial: pick the WORST-balanced legal option from a random squad
      const squad = pool[Math.floor(Math.random()*pool.length)];
      let cands = PlayerEligibilityService.filterEligible(squad.players, picked)
        .filter(p=>canPickPlayer(p,{picked,mode,remainingSlots:slots}).canPick);
      if (!cands.length) {
        cands = PlayerEligibilityService.filterEligible(pool.flatMap(s=>s.players), picked)
          .filter(p=>canPickPlayer(p,{picked,mode,remainingSlots:slots}).canPick);
      }
      if (!cands.length) { deadEnds++; break; }
      // bias toward batsmen to stress the balance guard
      const bats = cands.filter(p=>p.role==="Batsman");
      const pickFrom = bats.length && Math.random()<0.8 ? bats : cands;
      picked.push(pickFrom[Math.floor(Math.random()*pickFrom.length)]);
    }
    if (picked.length===11){
      if (computeStatus(picked, mode).some(s=>!s.satisfied)) invalidXI++;
      const ids = new Set(picked.map(p=>PlayerEligibilityService.canonicalIdOf(p)));
      if (ids.size!==11) dupes++;
      if (mode==="FRANCHISE_T20" && picked.filter(p=>p.isOverseas).length>4) overseasBreach++;
    }
  }
  console.log(`${mode}: runs=${runs} deadEnds=${deadEnds} invalidXI=${invalidXI} duplicatePlayers=${dupes} overseasBreaches=${overseasBreach}`);
}
