import { createTournament, advanceTournament } from "@/lib/cricket/tournament";
import { DraftPoolService } from "@/services/DraftPoolService";
import { overall } from "@/lib/cricket/rating";
import { snapshotAt, milestonesAt, ballCommentary, testProgress } from "@/lib/cricket/matchcentre";
import type { GameMode, LimitedScorecard, TestScorecard } from "@/lib/cricket/types";

const modes: GameMode[] = ["ODI_WC","T20_WC","CHAMPIONS","FRANCHISE_T20","TEST"];
for (const mode of modes) {
  let bad = 0, checked = 0, snaps = 0, ms = 0;
  for (let run = 0; run < 25; run++) {
    const pool = DraftPoolService.getPool(mode);
    const xi = [...pool[run % pool.length].players].sort((a,b)=>overall(b)-overall(a)).slice(0,11);
    let st = createTournament(xi, mode, 500 + run);
    let g = 0;
    while (!st.complete && g++ < 60) st = advanceTournament(st);
    for (const r of st.results) {
      checked++;
      if (r.format === "TEST") {
        const cards = testProgress(r as TestScorecard);
        if (!cards.length) { bad++; console.log("no test cards"); }
        for (const c of cards) if (!Number.isFinite(c.leadAfter) || c.runs < 0 || (c.target !== undefined && c.target <= 0)) { bad++; console.log("bad test card", c); }
        continue;
      }
      const lim = r as LimitedScorecard;
      if (!lim.timeline || lim.timeline.length !== 2) { bad++; console.log("missing timeline"); continue; }
      for (const [idx, inn] of lim.timeline.entries()) {
        const last = inn.balls[inn.balls.length - 1];
        const fullInn = inn.teamName === lim.ourName ? lim.ourInnings : lim.oppInnings;
        if (last && (last.score !== fullInn.runs || last.wickets !== fullInn.wickets)) { bad++; console.log("timeline mismatch", inn.teamName, last.score, fullInn.runs, last.wickets, fullInn.wickets); }
        if (inn.balls.length > inn.maxOvers * 6) { bad++; console.log("too many balls"); }
        for (let i = 0; i < inn.balls.length; i += Math.max(1, Math.floor(inn.balls.length/12))) {
          const s = snapshotAt(lim, idx, i + 1, 0.4);
          snaps++;
          if (!s) { bad++; continue; }
          if (!Number.isFinite(s.currentRunRate) || s.currentRunRate < 0) { bad++; console.log("bad CRR", s.currentRunRate); }
          if (s.runsRequired !== undefined && s.runsRequired <= 0) { bad++; console.log("bad need", s.runsRequired); }
          if (s.requiredRunRate !== undefined && (!Number.isFinite(s.requiredRunRate) || s.requiredRunRate < 0)) { bad++; console.log("bad RRR", s.requiredRunRate); }
          if (s.winProbUs < 0 || s.winProbUs > 100 || Number.isNaN(s.winProbUs)) { bad++; console.log("bad WP", s.winProbUs); }
          if (s.ballsRemaining < 0 || s.partnership.runs < 0) { bad++; console.log("bad remain"); }
          if (!s.situation) { bad++; }
          ms += milestonesAt(inn, i).length;
          const txt = ballCommentary(inn.balls[i], inn, s.runsRequired);
          if (!txt || txt.includes("undefined") || txt.includes("NaN")) { bad++; console.log("bad comm", txt); }
        }
        const endSnap = snapshotAt(lim, idx, inn.balls.length, 0);
        if (endSnap?.requiredRunRate !== undefined && idx === 1 && lim.timeline[1].target !== undefined && endSnap.runs >= lim.timeline[1].target!) { bad++; console.log("RRR after chase done"); }
      }
    }
  }
  console.log(`${mode}: matches=${checked} snapshots=${snaps} milestones=${ms} problems=${bad}`);
}
