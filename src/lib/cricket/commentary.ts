import type {
  LimitedScorecard, TestScorecard, Innings, Pitch, Weather, MatchFormat,
} from "./types";

// Deterministic-ish picker
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}
function maybe(rng: () => number, chance: number) {
  return rng() < chance;
}

function pitchFlavor(pitch: Pitch): string[] {
  switch (pitch) {
    case "Green":   return ["seam movement off the deck", "the ball nipping around", "green tinge doing plenty"];
    case "Flat":    return ["a road of a surface", "batters licking their lips at the flat deck", "nothing in it for the bowlers"];
    case "Dusty":   return ["dust flying off the crumbling surface", "grip and turn from ball one", "a dry, tired pitch"];
    case "Turning": return ["square turn for the spinners", "the ball ragging out of the rough", "a genuine bunsen"];
    case "Slow":    return ["the ball sticking in the surface", "a slow, low deck", "batters struggling for timing"];
  }
}
function weatherFlavor(w: Weather): string {
  switch (w) {
    case "Sunny":       return "under a blazing sun";
    case "Cloudy":      return "under grey, brooding skies";
    case "Humid":       return "in muggy, sticky air";
    case "Night Match": return "under the lights";
  }
}

function balls(overs: number) {
  return Math.floor(overs) * 6 + Math.round((overs % 1) * 10);
}

/* ---------- Limited-overs commentary ---------- */

export function limitedCommentary(r: LimitedScorecard, rng: () => number): string[] {
  const lines: string[] = [];
  const format: MatchFormat = r.format;
  const maxOvers = format === "T20" ? 20 : 50;
  const firstBatting = (r.toss.winner === "us" && r.toss.decision === "bat")
                    || (r.toss.winner === "opp" && r.toss.decision === "bowl")
                    ? r.ourInnings : r.oppInnings;
  const secondBatting = firstBatting === r.ourInnings ? r.oppInnings : r.ourInnings;
  const target = firstBatting.runs + 1;

  // Toss + conditions
  const tossName = r.toss.winner === "us" ? r.ourName : r.oppName;
  lines.push(
    `${tossName} called correctly at the toss and chose to ${r.toss.decision} ${weatherFlavor(r.weather)}, with ${pick(pitchFlavor(r.pitch), rng)}.`
  );

  // Powerplay flavour for first innings
  const ppLength = format === "T20" ? 6 : 10;
  const ppRate = firstBatting.runRate * (0.9 + rng() * 0.5); // approximation
  if (ppRate > (format === "T20" ? 9 : 6.5)) {
    lines.push(`${firstBatting.teamName} tore into the powerplay — ${Math.round(ppRate * ppLength)} off the first ${ppLength} looked ominous.`);
  } else if (ppRate < (format === "T20" ? 6 : 4)) {
    lines.push(`A watchful powerplay from ${firstBatting.teamName} — the new ball did enough to keep the scoring in check.`);
  } else {
    lines.push(`${firstBatting.teamName} settled in through the powerplay without giving too much away.`);
  }

  // Top scorer narrative
  const top1 = firstBatting.topScorer;
  const sr1 = top1.balls ? (top1.runs / top1.balls) * 100 : 0;
  if (top1.runs >= 100) {
    lines.push(`${top1.name} raised a stunning hundred — ${top1.runs} off ${top1.balls}, the innings built around him.`);
  } else if (top1.runs >= 75 && sr1 > 140) {
    lines.push(`${top1.name} took the attack apart with a ${top1.runs}-ball blitz (${top1.runs} off ${top1.balls}, SR ${Math.round(sr1)}).`);
  } else if (top1.runs >= 60) {
    lines.push(`${top1.name} anchored the innings with a composed ${top1.runs} off ${top1.balls}.`);
  } else {
    lines.push(`${top1.name} top-scored with ${top1.runs} off ${top1.balls} but never fully broke the shackles.`);
  }

  // Partnership
  if (firstBatting.partnership.runs >= 100) {
    lines.push(`A ${firstBatting.partnership.runs}-run stand between ${firstBatting.partnership.names[0]} and ${firstBatting.partnership.names[1]} formed the spine of the total.`);
  } else if (firstBatting.partnership.runs >= 60) {
    lines.push(`${firstBatting.partnership.names[0]} and ${firstBatting.partnership.names[1]} added a valuable ${firstBatting.partnership.runs} to steady things.`);
  }

  // Collapse / death overs
  if (firstBatting.wickets >= 8) {
    lines.push(`The innings folded late — ${firstBatting.wickets} down for ${firstBatting.runs}, the tail giving in under pressure.`);
  } else if (firstBatting.wickets <= 3 && firstBatting.overs >= maxOvers - 1) {
    lines.push(`${firstBatting.teamName} finished strongly — just ${firstBatting.wickets} down at the close, a platform they will fancy defending.`);
  }

  // First-innings bowler
  const b1 = firstBatting.bestBowler;
  if (b1.wickets >= 5) {
    lines.push(`${b1.name} ripped through with a five-for — ${b1.wickets}/${b1.runs} off ${b1.overs}, the spell of the match so far.`);
  } else if (b1.wickets >= 3) {
    lines.push(`${b1.name} kept probing and picked up ${b1.wickets}/${b1.runs} — a genuine pressure spell.`);
  } else if (maybe(rng, 0.4)) {
    lines.push(`${b1.name} was the pick of the attack, going for ${b1.runs} in ${b1.overs} overs.`);
  }

  // Break: target
  lines.push(`Innings break — ${firstBatting.teamName} ${firstBatting.runs}/${firstBatting.wickets}. ${secondBatting.teamName} need ${target} to win ${format === "T20" ? "at over eight an over" : ""}.`);

  // Chase narrative
  const chaseWon = secondBatting.runs >= target;
  const wktsDown = secondBatting.wickets;
  if (chaseWon) {
    const wktsInHand = 10 - wktsDown;
    const ballsRemaining = maxOvers * 6 - balls(secondBatting.overs);
    if (secondBatting.topScorer.runs >= 80 && secondBatting.topScorer === secondBatting.topScorer) {
      lines.push(`${secondBatting.topScorer.name} led the chase with ${secondBatting.topScorer.runs} off ${secondBatting.topScorer.balls}, unflappable under lights.`);
    }
    if (ballsRemaining <= 3 && wktsInHand <= 2) {
      lines.push(`Down to the final over, nerves shredded — ${secondBatting.teamName} scraped home with ${ballsRemaining} to spare.`);
    } else if (ballsRemaining <= 12) {
      lines.push(`A nervy finish, but ${secondBatting.teamName} got there with an over to burn.`);
    } else if (wktsInHand >= 6) {
      lines.push(`${secondBatting.teamName} cruised over the line — ${wktsInHand} wickets in hand and plenty of overs left.`);
    } else {
      lines.push(`${secondBatting.teamName} rebuilt smartly after early wobbles and completed the chase.`);
    }
  } else {
    const shortBy = target - 1 - secondBatting.runs;
    if (wktsDown === 10) {
      lines.push(`${secondBatting.teamName} were bundled out ${shortBy} short — the collapse started with ${secondBatting.bestBowler.name === secondBatting.topScorer.name ? "the top order" : `${firstBatting.bestBowler.name}'s second spell`}.`);
    } else if (shortBy <= 10) {
      lines.push(`Heartbreak — ${secondBatting.teamName} came agonisingly close, falling ${shortBy} runs short off the final over.`);
    } else {
      lines.push(`${secondBatting.teamName} never quite kept up with the required rate and finished ${shortBy} adrift.`);
    }
  }

  // Player of the match
  lines.push(`${r.playerOfMatch} took Player of the Match honours in a ${r.weWon ? "famous win for" : "tough day for"} ${r.ourName}.`);

  // Occasional flavour extras
  if (maybe(rng, 0.25)) lines.push(`A brief rain interruption threatened to derail the innings, but the covers came off in time.`);
  if (maybe(rng, 0.15)) lines.push(`A brilliant piece of fielding in the deep swung momentum at a critical moment.`);

  return lines;
}

/* ---------- Test commentary by session ---------- */

const SESSIONS = ["Morning", "Afternoon", "Evening"] as const;

function sessionLine(day: number, session: string, body: string) {
  return `Day ${day} ${session}: ${body}`;
}

export function testCommentary(r: TestScorecard, rng: () => number): string[] {
  const lines: string[] = [];
  const battingFirst = (r.toss.winner === "us" && r.toss.decision === "bat")
                    || (r.toss.winner === "opp" && r.toss.decision === "bowl")
                    ? r.ourInnings[0] : r.oppInnings[0];
  const bowlingFirst = battingFirst === r.ourInnings[0] ? r.oppInnings[0] : r.ourInnings[0];

  // Day 1 morning
  lines.push(sessionLine(1, "Morning",
    `${r.toss.winner === "us" ? r.ourName : r.oppName} won the toss and chose to ${r.toss.decision} ${weatherFlavor(r.weather)} on ${pick(pitchFlavor(r.pitch), rng)}.`
  ));
  // Day 1 afternoon — first partnership
  lines.push(sessionLine(1, "Afternoon",
    battingFirst.partnership.runs >= 80
      ? `${battingFirst.partnership.names[0]} and ${battingFirst.partnership.names[1]} put on ${battingFirst.partnership.runs} in a session of quiet accumulation.`
      : `Bowlers on top — ${bowlingFirst.bestBowler.name} used the new ball beautifully to keep runs to a trickle.`
  ));
  // Day 1 evening
  lines.push(sessionLine(1, "Evening",
    battingFirst.topScorer.runs >= 100
      ? `${battingFirst.topScorer.name} raised a hundred just before stumps, walking off to a standing ovation.`
      : `Late wickets tilted the day — ${bowlingFirst.bestBowler.name} struck twice in the last hour.`
  ));

  // Day 2
  lines.push(sessionLine(2, "Morning",
    battingFirst.wickets >= 8
      ? `The innings folded quickly on the second morning — ${battingFirst.teamName} all out for ${battingFirst.runs}.`
      : `${battingFirst.teamName} pushed the total along, cashing in against the older ball.`
  ));
  lines.push(sessionLine(2, "Afternoon",
    `${bowlingFirst.teamName} openers began the reply — ${battingFirst.bestBowler.name} probing away with ${battingFirst.bestBowler.wickets} early scalps.`
  ));
  lines.push(sessionLine(2, "Evening",
    bowlingFirst.partnership.runs >= 60
      ? `A grinding stand of ${bowlingFirst.partnership.runs} between ${bowlingFirst.partnership.names[0]} and ${bowlingFirst.partnership.names[1]} steadied the reply before stumps.`
      : `Wickets kept tumbling — bowlers on top as the light faded.`
  ));

  // Day 3 — second innings
  const our2 = r.ourInnings[1];
  const opp2 = r.oppInnings[1];
  lines.push(sessionLine(3, "Morning",
    our2 || opp2
      ? `The game opened up — leads exchanged and second innings underway.`
      : `The first innings dragged into a third day, batters refusing to give in.`
  ));
  if (opp2) {
    lines.push(sessionLine(3, "Afternoon",
      opp2.followOn
        ? `Following on! ${opp2.teamName} were asked to bat again after a huge deficit — ${opp2.bestBowler.name} continued to torment them.`
        : `${opp2.teamName} set about wearing the ball down, second innings runs coming in a hurry.`
    ));
  }
  if (our2) {
    lines.push(sessionLine(3, "Evening",
      our2.topScorer.runs >= 80
        ? `${our2.topScorer.name} dug in for ${our2.topScorer.runs} — a knock of pure grit.`
        : `Nerves in the ${r.ourName} dressing room as wickets tumbled in the chase to shape the game.`
    ));
  }

  // Day 4 & 5 depending on result
  if (r.result === "DRAW") {
    lines.push(sessionLine(4, "Afternoon", `A batting side happy to survive, a bowling side losing patience — the draw looked inevitable.`));
    lines.push(sessionLine(5, "Final Session", `Handshakes all round. A ${pick(["stubborn", "attritional", "weather-hit"], rng)} draw ends the Test.`));
  } else if (r.result === "WON") {
    lines.push(sessionLine(4, "Evening", `${r.ourName} smelled blood — the field crept in and every ball felt like a moment.`));
    lines.push(sessionLine(5, "Final Session", `${r.ourName} sealed it — ${r.marginText}. ${r.playerOfMatch} the deserved Player of the Match.`));
  } else {
    lines.push(sessionLine(4, "Evening", `${r.oppName} kept squeezing — ${r.ourName} batters running out of ideas.`));
    lines.push(sessionLine(5, "Final Session", `${r.oppName} closed it out — ${r.marginText}. A tough lesson for ${r.ourName}.`));
  }

  return lines;
}
