import type { Player, Squad, Role, Trait, GameMode } from "./types";

let uid = 0;
const p = (
  name: string,
  country: string,
  role: Role,
  stats: Partial<Player["stats"]>,
  traits: Trait[] = [],
  extras: Partial<Player> = {},
): Player => ({
  id: `pl_${++uid}`,
  name,
  country,
  role,
  traits,
  isOverseas: extras.isOverseas,
  isCaptain: extras.isCaptain,
  stats: {
    batting: 60, bowling: 60, fielding: 70, leadership: 55,
    pressure: 65, consistency: 70, fitness: 75, form: 70,
    ...stats,
  },
});

// Squad factory
let sid = 0;
const makeSquad = (
  label: string, country: string, year: number, mode: GameMode, players: Player[],
): Squad => ({ id: `sq_${++sid}`, label, country, year, mode, players });

/* ---------- ODI World Cup Squads ---------- */

const india2011: Squad = makeSquad("India 2011", "India", 2011, "ODI_WC", [
  p("MS Dhoni", "India", "Wicketkeeper", { batting: 92, leadership: 98, pressure: 97, consistency: 90 },
    ["Captain Fantastic", "Finisher", "Ice Veins"], { isCaptain: true }),
  p("Sachin Tendulkar", "India", "Batsman", { batting: 98, consistency: 96, pressure: 92 }, ["Run Machine", "Big Match Player"]),
  p("Virat Kohli", "India", "Batsman", { batting: 90, consistency: 88, pressure: 88 }, ["Run Machine"]),
  p("Yuvraj Singh", "India", "AllRounder", { batting: 88, bowling: 74, pressure: 94 }, ["Big Match Player", "Clutch Performer"]),
  p("Gautam Gambhir", "India", "Batsman", { batting: 86, pressure: 90 }, ["Wall"]),
  p("Zaheer Khan", "India", "PaceBowler", { bowling: 90, pressure: 88 }, ["Strike Bowler", "Big Match Player"]),
  p("Harbhajan Singh", "India", "SpinBowler", { bowling: 84 }, ["Spin Wizard"]),
  p("Virender Sehwag", "India", "Batsman", { batting: 92, pressure: 78 }, ["Powerplay Destroyer"]),
  p("Suresh Raina", "India", "AllRounder", { batting: 80, bowling: 66, fielding: 90 }, ["Finisher"]),
  p("Munaf Patel", "India", "PaceBowler", { bowling: 78 }),
  p("Ashish Nehra", "India", "PaceBowler", { bowling: 80 }, ["Death Overs Specialist"]),
]);

const australia2003: Squad = makeSquad("Australia 2003", "Australia", 2003, "ODI_WC", [
  p("Ricky Ponting", "Australia", "Batsman", { batting: 96, leadership: 94, consistency: 92 }, ["Captain Fantastic", "Big Match Player"], { isCaptain: true }),
  p("Adam Gilchrist", "Australia", "Wicketkeeper", { batting: 94, pressure: 88 }, ["Powerplay Destroyer"]),
  p("Matthew Hayden", "Australia", "Batsman", { batting: 92 }, ["Powerplay Destroyer"]),
  p("Damien Martyn", "Australia", "Batsman", { batting: 86 }),
  p("Michael Bevan", "Australia", "Batsman", { batting: 88, pressure: 94 }, ["Finisher", "Ice Veins"]),
  p("Andrew Symonds", "Australia", "AllRounder", { batting: 84, bowling: 72, fielding: 92 }),
  p("Glenn McGrath", "Australia", "PaceBowler", { bowling: 96, consistency: 96 }, ["Strike Bowler", "Wall"]),
  p("Brett Lee", "Australia", "PaceBowler", { bowling: 92 }, ["Strike Bowler"]),
  p("Jason Gillespie", "Australia", "PaceBowler", { bowling: 84 }),
  p("Brad Hogg", "Australia", "SpinBowler", { bowling: 80 }, ["Spin Wizard"]),
  p("Darren Lehmann", "Australia", "AllRounder", { batting: 78, bowling: 70 }),
]);

const australia1999: Squad = makeSquad("Australia 1999", "Australia", 1999, "ODI_WC", [
  p("Steve Waugh", "Australia", "Batsman", { batting: 88, leadership: 96, pressure: 96 }, ["Captain Fantastic", "Ice Veins"], { isCaptain: true }),
  p("Mark Waugh", "Australia", "Batsman", { batting: 88, fielding: 90 }),
  p("Shane Warne", "Australia", "SpinBowler", { bowling: 96, pressure: 94 }, ["Spin Wizard", "Big Match Player", "Strike Bowler"]),
  p("Glenn McGrath", "Australia", "PaceBowler", { bowling: 94 }, ["Strike Bowler"]),
  p("Adam Gilchrist", "Australia", "Wicketkeeper", { batting: 88 }, ["Powerplay Destroyer"]),
  p("Michael Bevan", "Australia", "Batsman", { batting: 86, pressure: 94 }, ["Finisher"]),
  p("Ricky Ponting", "Australia", "Batsman", { batting: 88 }),
  p("Damien Fleming", "Australia", "PaceBowler", { bowling: 82 }, ["Death Overs Specialist"]),
  p("Tom Moody", "Australia", "AllRounder", { batting: 74, bowling: 74 }),
  p("Paul Reiffel", "Australia", "PaceBowler", { bowling: 80 }),
  p("Mark Waugh", "Australia", "Batsman", { batting: 82 }),
]);

const england2019: Squad = makeSquad("England 2019", "England", 2019, "ODI_WC", [
  p("Eoin Morgan", "England", "Batsman", { batting: 84, leadership: 92 }, ["Captain Fantastic"], { isCaptain: true }),
  p("Ben Stokes", "England", "AllRounder", { batting: 90, bowling: 82, pressure: 96 }, ["Clutch Performer", "Ice Veins", "Big Match Player"]),
  p("Jos Buttler", "England", "Wicketkeeper", { batting: 92 }, ["Finisher", "Powerplay Destroyer"]),
  p("Jason Roy", "England", "Batsman", { batting: 88 }, ["Powerplay Destroyer"]),
  p("Joe Root", "England", "Batsman", { batting: 90, consistency: 92 }, ["Run Machine", "Wall"]),
  p("Jonny Bairstow", "England", "Batsman", { batting: 88 }, ["Powerplay Destroyer"]),
  p("Jofra Archer", "England", "PaceBowler", { bowling: 90, pressure: 90 }, ["Strike Bowler", "Death Overs Specialist"]),
  p("Mark Wood", "England", "PaceBowler", { bowling: 84 }),
  p("Chris Woakes", "England", "AllRounder", { batting: 72, bowling: 84 }),
  p("Adil Rashid", "England", "SpinBowler", { bowling: 82 }, ["Spin Wizard"]),
  p("Liam Plunkett", "England", "PaceBowler", { bowling: 80 }),
]);

const pakistan1992: Squad = makeSquad("Pakistan 1992", "Pakistan", 1992, "ODI_WC", [
  p("Imran Khan", "Pakistan", "AllRounder", { batting: 82, bowling: 90, leadership: 98, pressure: 94 },
    ["Captain Fantastic", "Big Match Player"], { isCaptain: true }),
  p("Wasim Akram", "Pakistan", "PaceBowler", { bowling: 96, batting: 66 }, ["Strike Bowler", "Death Overs Specialist"]),
  p("Javed Miandad", "Pakistan", "Batsman", { batting: 90, pressure: 94 }, ["Ice Veins", "Wall"]),
  p("Inzamam-ul-Haq", "Pakistan", "Batsman", { batting: 84 }, ["Big Match Player"]),
  p("Aamer Sohail", "Pakistan", "Batsman", { batting: 78 }),
  p("Moin Khan", "Pakistan", "Wicketkeeper", { batting: 72 }),
  p("Mushtaq Ahmed", "Pakistan", "SpinBowler", { bowling: 84 }, ["Spin Wizard"]),
  p("Aaqib Javed", "Pakistan", "PaceBowler", { bowling: 82 }),
  p("Ijaz Ahmed", "Pakistan", "Batsman", { batting: 76 }),
  p("Salim Malik", "Pakistan", "Batsman", { batting: 80 }),
  p("Rameez Raja", "Pakistan", "Batsman", { batting: 76 }),
]);

const westindies1979: Squad = makeSquad("West Indies 1979", "West Indies", 1979, "ODI_WC", [
  p("Clive Lloyd", "West Indies", "Batsman", { batting: 86, leadership: 94 }, ["Captain Fantastic"], { isCaptain: true }),
  p("Viv Richards", "West Indies", "Batsman", { batting: 96, pressure: 94 }, ["Run Machine", "Big Match Player"]),
  p("Gordon Greenidge", "West Indies", "Batsman", { batting: 88 }, ["Powerplay Destroyer"]),
  p("Desmond Haynes", "West Indies", "Batsman", { batting: 84 }),
  p("Michael Holding", "West Indies", "PaceBowler", { bowling: 94 }, ["Strike Bowler"]),
  p("Andy Roberts", "West Indies", "PaceBowler", { bowling: 90 }, ["Strike Bowler"]),
  p("Joel Garner", "West Indies", "PaceBowler", { bowling: 92 }, ["Death Overs Specialist"]),
  p("Colin Croft", "West Indies", "PaceBowler", { bowling: 88 }),
  p("Deryck Murray", "West Indies", "Wicketkeeper", { batting: 68 }),
  p("Larry Gomes", "West Indies", "AllRounder", { batting: 74, bowling: 66 }),
  p("Collis King", "West Indies", "AllRounder", { batting: 76, bowling: 68 }, ["Clutch Performer"]),
]);

/* ---------- T20 World Cup Squads ---------- */

const india2007T20: Squad = makeSquad("India 2007", "India", 2007, "T20_WC", [
  p("MS Dhoni", "India", "Wicketkeeper", { batting: 88, leadership: 94, pressure: 94 }, ["Captain Fantastic", "Finisher"], { isCaptain: true }),
  p("Yuvraj Singh", "India", "AllRounder", { batting: 92, bowling: 72, pressure: 92 }, ["Powerplay Destroyer", "Clutch Performer"]),
  p("Gautam Gambhir", "India", "Batsman", { batting: 86 }, ["Wall"]),
  p("Rohit Sharma", "India", "Batsman", { batting: 82 }),
  p("Virender Sehwag", "India", "Batsman", { batting: 90 }, ["Powerplay Destroyer"]),
  p("Irfan Pathan", "India", "AllRounder", { batting: 72, bowling: 82 }, ["Strike Bowler"]),
  p("RP Singh", "India", "PaceBowler", { bowling: 82 }, ["Strike Bowler"]),
  p("S Sreesanth", "India", "PaceBowler", { bowling: 80 }),
  p("Harbhajan Singh", "India", "SpinBowler", { bowling: 82 }, ["Spin Wizard"]),
  p("Yusuf Pathan", "India", "AllRounder", { batting: 78, bowling: 68 }, ["Finisher"]),
  p("Joginder Sharma", "India", "PaceBowler", { bowling: 68, pressure: 88 }, ["Ice Veins"]),
]);

const westindies2016: Squad = makeSquad("West Indies 2016", "West Indies", 2016, "T20_WC", [
  p("Darren Sammy", "West Indies", "AllRounder", { batting: 70, bowling: 72, leadership: 92 }, ["Captain Fantastic"], { isCaptain: true }),
  p("Chris Gayle", "West Indies", "Batsman", { batting: 96 }, ["Powerplay Destroyer", "Run Machine"]),
  p("Marlon Samuels", "West Indies", "Batsman", { batting: 84, pressure: 90 }, ["Big Match Player"]),
  p("Andre Russell", "West Indies", "AllRounder", { batting: 90, bowling: 84 }, ["Finisher", "Death Overs Specialist"]),
  p("Dwayne Bravo", "West Indies", "AllRounder", { batting: 78, bowling: 82 }, ["Death Overs Specialist"]),
  p("Carlos Brathwaite", "West Indies", "AllRounder", { batting: 78, bowling: 78, pressure: 92 }, ["Clutch Performer", "Finisher"]),
  p("Sunil Narine", "West Indies", "SpinBowler", { bowling: 92 }, ["Spin Wizard", "Strike Bowler"]),
  p("Samuel Badree", "West Indies", "SpinBowler", { bowling: 84 }, ["Spin Wizard"]),
  p("Denesh Ramdin", "West Indies", "Wicketkeeper", { batting: 74 }),
  p("Johnson Charles", "West Indies", "Batsman", { batting: 76 }),
  p("Andre Fletcher", "West Indies", "Batsman", { batting: 74 }),
]);

const australia2021T20: Squad = makeSquad("Australia 2021", "Australia", 2021, "T20_WC", [
  p("Aaron Finch", "Australia", "Batsman", { batting: 84, leadership: 86 }, { isCaptain: true } as any),
  p("David Warner", "Australia", "Batsman", { batting: 92 }, ["Powerplay Destroyer"]),
  p("Mitchell Marsh", "Australia", "AllRounder", { batting: 82, bowling: 70, pressure: 88 }, ["Big Match Player"]),
  p("Glenn Maxwell", "Australia", "AllRounder", { batting: 86, bowling: 74 }, ["Finisher"]),
  p("Marcus Stoinis", "Australia", "AllRounder", { batting: 76, bowling: 74 }),
  p("Matthew Wade", "Australia", "Wicketkeeper", { batting: 78, pressure: 90 }, ["Clutch Performer"]),
  p("Pat Cummins", "Australia", "PaceBowler", { bowling: 90 }, ["Strike Bowler"]),
  p("Mitchell Starc", "Australia", "PaceBowler", { bowling: 92 }, ["Strike Bowler", "Death Overs Specialist"]),
  p("Josh Hazlewood", "Australia", "PaceBowler", { bowling: 88, consistency: 92 }, ["Wall"]),
  p("Adam Zampa", "Australia", "SpinBowler", { bowling: 84 }, ["Spin Wizard"]),
  p("Steve Smith", "Australia", "Batsman", { batting: 88, consistency: 92 }, ["Run Machine"]),
]);

/* ---------- Champions Trophy ---------- */

const pakistan2017: Squad = makeSquad("Pakistan 2017", "Pakistan", 2017, "CHAMPIONS", [
  p("Sarfaraz Ahmed", "Pakistan", "Wicketkeeper", { batting: 78, leadership: 84 }, ["Captain Fantastic"], { isCaptain: true }),
  p("Fakhar Zaman", "Pakistan", "Batsman", { batting: 86, pressure: 88 }, ["Powerplay Destroyer", "Big Match Player"]),
  p("Babar Azam", "Pakistan", "Batsman", { batting: 90, consistency: 92 }, ["Run Machine", "Wall"]),
  p("Mohammad Amir", "Pakistan", "PaceBowler", { bowling: 90, pressure: 90 }, ["Strike Bowler", "Big Match Player"]),
  p("Hasan Ali", "Pakistan", "PaceBowler", { bowling: 86 }, ["Strike Bowler"]),
  p("Junaid Khan", "Pakistan", "PaceBowler", { bowling: 80 }),
  p("Shadab Khan", "Pakistan", "SpinBowler", { bowling: 82 }, ["Spin Wizard"]),
  p("Imad Wasim", "Pakistan", "AllRounder", { batting: 70, bowling: 76 }),
  p("Mohammad Hafeez", "Pakistan", "AllRounder", { batting: 78, bowling: 72 }),
  p("Azhar Ali", "Pakistan", "Batsman", { batting: 82 }, ["Wall"]),
  p("Shoaib Malik", "Pakistan", "AllRounder", { batting: 78, bowling: 72 }),
]);

const india2013: Squad = makeSquad("India 2013", "India", 2013, "CHAMPIONS", [
  p("MS Dhoni", "India", "Wicketkeeper", { batting: 90, leadership: 96 }, ["Captain Fantastic", "Finisher"], { isCaptain: true }),
  p("Shikhar Dhawan", "India", "Batsman", { batting: 88, pressure: 88 }, ["Powerplay Destroyer", "Big Match Player"]),
  p("Rohit Sharma", "India", "Batsman", { batting: 86 }, ["Powerplay Destroyer"]),
  p("Virat Kohli", "India", "Batsman", { batting: 92, consistency: 92 }, ["Run Machine"]),
  p("Suresh Raina", "India", "AllRounder", { batting: 80, bowling: 66 }, ["Finisher"]),
  p("Ravindra Jadeja", "India", "AllRounder", { batting: 76, bowling: 86, fielding: 96 }, ["Spin Wizard"]),
  p("R Ashwin", "India", "SpinBowler", { bowling: 88 }, ["Spin Wizard"]),
  p("Bhuvneshwar Kumar", "India", "PaceBowler", { bowling: 84 }, ["Strike Bowler"]),
  p("Ishant Sharma", "India", "PaceBowler", { bowling: 80 }),
  p("Umesh Yadav", "India", "PaceBowler", { bowling: 82 }),
  p("Dinesh Karthik", "India", "Wicketkeeper", { batting: 76 }),
]);

/* ---------- Franchise T20 (generic, no real league names) ---------- */

const chennaiKings: Squad = makeSquad("Chennai Kings 2023", "Franchise", 2023, "FRANCHISE_T20", [
  p("MS Dhoni", "India", "Wicketkeeper", { batting: 86, leadership: 96, pressure: 94 }, ["Captain Fantastic", "Finisher"], { isCaptain: true }),
  p("Ruturaj Gaikwad", "India", "Batsman", { batting: 84 }, ["Run Machine"]),
  p("Devon Conway", "New Zealand", "Batsman", { batting: 86, consistency: 90 }, ["Wall"], { isOverseas: true }),
  p("Ravindra Jadeja", "India", "AllRounder", { batting: 78, bowling: 84, fielding: 96 }, ["Spin Wizard"]),
  p("Shivam Dube", "India", "AllRounder", { batting: 80, bowling: 68 }, ["Finisher"]),
  p("Ambati Rayudu", "India", "Batsman", { batting: 78, pressure: 86 }, ["Big Match Player"]),
  p("Deepak Chahar", "India", "PaceBowler", { bowling: 82 }, ["Strike Bowler"]),
  p("Matheesha Pathirana", "Sri Lanka", "PaceBowler", { bowling: 84 }, ["Death Overs Specialist"], { isOverseas: true }),
  p("Tushar Deshpande", "India", "PaceBowler", { bowling: 76 }),
  p("Maheesh Theekshana", "Sri Lanka", "SpinBowler", { bowling: 84 }, ["Spin Wizard"], { isOverseas: true }),
  p("Moeen Ali", "England", "AllRounder", { batting: 78, bowling: 78 }, [], { isOverseas: true }),
]);

const mumbaiTitans: Squad = makeSquad("Mumbai Titans 2020", "Franchise", 2020, "FRANCHISE_T20", [
  p("Rohit Sharma", "India", "Batsman", { batting: 90, leadership: 92 }, ["Captain Fantastic", "Run Machine"], { isCaptain: true }),
  p("Quinton de Kock", "South Africa", "Wicketkeeper", { batting: 88 }, ["Powerplay Destroyer"], { isOverseas: true }),
  p("Suryakumar Yadav", "India", "Batsman", { batting: 92 }, ["Run Machine"]),
  p("Ishan Kishan", "India", "Wicketkeeper", { batting: 82 }),
  p("Hardik Pandya", "India", "AllRounder", { batting: 84, bowling: 78 }, ["Finisher"]),
  p("Kieron Pollard", "West Indies", "AllRounder", { batting: 84, bowling: 72, pressure: 90 }, ["Finisher", "Clutch Performer"], { isOverseas: true }),
  p("Krunal Pandya", "India", "AllRounder", { batting: 72, bowling: 78 }),
  p("Jasprit Bumrah", "India", "PaceBowler", { bowling: 96, pressure: 94 }, ["Strike Bowler", "Death Overs Specialist", "Ice Veins"]),
  p("Trent Boult", "New Zealand", "PaceBowler", { bowling: 90 }, ["Strike Bowler"], { isOverseas: true }),
  p("Rahul Chahar", "India", "SpinBowler", { bowling: 78 }, ["Spin Wizard"]),
  p("Nathan Coulter-Nile", "Australia", "PaceBowler", { bowling: 80 }, [], { isOverseas: true }),
]);

/* ---------- Test Cricket ---------- */

const australia2005Test: Squad = makeSquad("Australia 2005", "Australia", 2005, "TEST", [
  p("Ricky Ponting", "Australia", "Batsman", { batting: 94, leadership: 92 }, ["Captain Fantastic", "Run Machine"], { isCaptain: true }),
  p("Matthew Hayden", "Australia", "Batsman", { batting: 92 }),
  p("Justin Langer", "Australia", "Batsman", { batting: 86 }, ["Wall"]),
  p("Damien Martyn", "Australia", "Batsman", { batting: 86 }),
  p("Michael Clarke", "Australia", "Batsman", { batting: 84 }),
  p("Adam Gilchrist", "Australia", "Wicketkeeper", { batting: 92 }, ["Powerplay Destroyer"]),
  p("Shane Warne", "Australia", "SpinBowler", { bowling: 98 }, ["Spin Wizard", "Big Match Player"]),
  p("Glenn McGrath", "Australia", "PaceBowler", { bowling: 96 }, ["Strike Bowler", "Wall"]),
  p("Brett Lee", "Australia", "PaceBowler", { bowling: 90 }, ["Strike Bowler"]),
  p("Jason Gillespie", "Australia", "PaceBowler", { bowling: 82 }),
  p("Simon Katich", "Australia", "Batsman", { batting: 78 }),
]);

const india2018Test: Squad = makeSquad("India 2018", "India", 2018, "TEST", [
  p("Virat Kohli", "India", "Batsman", { batting: 96, leadership: 90 }, ["Captain Fantastic", "Run Machine"], { isCaptain: true }),
  p("Cheteshwar Pujara", "India", "Batsman", { batting: 88, pressure: 92 }, ["Wall"]),
  p("Ajinkya Rahane", "India", "Batsman", { batting: 82 }),
  p("Rishabh Pant", "India", "Wicketkeeper", { batting: 86 }, ["Clutch Performer"]),
  p("KL Rahul", "India", "Batsman", { batting: 82 }),
  p("Ravindra Jadeja", "India", "AllRounder", { batting: 78, bowling: 86 }, ["Spin Wizard"]),
  p("R Ashwin", "India", "SpinBowler", { bowling: 90 }, ["Spin Wizard", "Strike Bowler"]),
  p("Jasprit Bumrah", "India", "PaceBowler", { bowling: 94 }, ["Strike Bowler"]),
  p("Ishant Sharma", "India", "PaceBowler", { bowling: 84 }),
  p("Mohammed Shami", "India", "PaceBowler", { bowling: 88 }, ["Strike Bowler"]),
  p("Hanuma Vihari", "India", "Batsman", { batting: 74 }),
]);

/* ---------- Generated wide catalog (algorithmically approximated ratings) ---------- */

type PoolEntry = [string, Role, Partial<Player["stats"]>, Trait[]?];
function bump(base: number, seed: number, spread = 6) {
  return Math.max(40, Math.min(99, Math.round(base + ((seed % (spread * 2)) - spread))));
}
function seedFrom(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function gen(
  label: string, country: string, year: number, mode: GameMode,
  captainName: string, pool: PoolEntry[], overseasNames: string[] = [],
): Squad {
  const s = seedFrom(label);
  const players = pool.map(([name, role, stats, traits], i): Player => {
    const seed = seedFrom(label + name) + i;
    const jittered: Partial<Player["stats"]> = {};
    (Object.keys(stats) as (keyof Player["stats"])[]).forEach(k => {
      const v = stats[k];
      if (typeof v === "number") jittered[k] = bump(v, seed + (k.length * 7));
    });
    return p(name, country, role, jittered, traits ?? [], {
      isCaptain: name === captainName,
      isOverseas: overseasNames.includes(name),
    });
  });
  void s;
  return makeSquad(label, country, year, mode, players);
}

/* ---------- ODI extras ---------- */
const india2023: Squad = gen("India 2023", "India", 2023, "ODI_WC", "Rohit Sharma", [
  ["Rohit Sharma", "Batsman",     { batting: 92, leadership: 90 }, ["Captain Fantastic", "Powerplay Destroyer"]],
  ["Shubman Gill", "Batsman",     { batting: 88 }, ["Run Machine"]],
  ["Virat Kohli",  "Batsman",     { batting: 96, consistency: 94 }, ["Run Machine", "Wall"]],
  ["Shreyas Iyer", "Batsman",     { batting: 84 }],
  ["KL Rahul",     "Wicketkeeper",{ batting: 84 }],
  ["Suryakumar Yadav", "Batsman", { batting: 86 }, ["Finisher"]],
  ["Ravindra Jadeja", "AllRounder", { batting: 78, bowling: 86 }, ["Spin Wizard"]],
  ["Kuldeep Yadav", "SpinBowler", { bowling: 86 }, ["Spin Wizard"]],
  ["Jasprit Bumrah","PaceBowler", { bowling: 96 }, ["Strike Bowler", "Ice Veins"]],
  ["Mohammed Shami","PaceBowler", { bowling: 92 }, ["Strike Bowler"]],
  ["Mohammed Siraj","PaceBowler", { bowling: 86 }],
]);

const nz2019: Squad = gen("New Zealand 2019", "New Zealand", 2019, "ODI_WC", "Kane Williamson", [
  ["Kane Williamson", "Batsman", { batting: 92, leadership: 92 }, ["Captain Fantastic", "Wall"]],
  ["Martin Guptill", "Batsman", { batting: 84 }, ["Powerplay Destroyer"]],
  ["Ross Taylor", "Batsman", { batting: 86 }],
  ["Tom Latham", "Wicketkeeper", { batting: 80 }],
  ["Jimmy Neesham", "AllRounder", { batting: 76, bowling: 78 }],
  ["Colin de Grandhomme", "AllRounder", { batting: 74, bowling: 74 }],
  ["Mitchell Santner", "SpinBowler", { bowling: 80 }],
  ["Trent Boult", "PaceBowler", { bowling: 92 }, ["Strike Bowler"]],
  ["Matt Henry", "PaceBowler", { bowling: 84 }],
  ["Lockie Ferguson", "PaceBowler", { bowling: 86 }, ["Strike Bowler"]],
  ["Henry Nicholls", "Batsman", { batting: 78 }],
]);

const sa1999: Squad = gen("South Africa 1999", "South Africa", 1999, "ODI_WC", "Hansie Cronje", [
  ["Hansie Cronje", "AllRounder", { batting: 78, bowling: 72, leadership: 90 }, ["Captain Fantastic"]],
  ["Jacques Kallis", "AllRounder", { batting: 90, bowling: 82 }, ["Wall"]],
  ["Lance Klusener", "AllRounder", { batting: 88, bowling: 84, pressure: 94 }, ["Finisher", "Ice Veins"]],
  ["Herschelle Gibbs", "Batsman", { batting: 86 }, ["Powerplay Destroyer"]],
  ["Gary Kirsten", "Batsman", { batting: 84 }],
  ["Shaun Pollock", "AllRounder", { batting: 74, bowling: 90 }, ["Strike Bowler"]],
  ["Allan Donald", "PaceBowler", { bowling: 94 }, ["Strike Bowler"]],
  ["Mark Boucher", "Wicketkeeper", { batting: 78 }],
  ["Nicky Boje", "SpinBowler", { bowling: 76 }],
  ["Steve Elworthy", "PaceBowler", { bowling: 78 }],
  ["Daryll Cullinan", "Batsman", { batting: 80 }],
]);

const sl1996: Squad = gen("Sri Lanka 1996", "Sri Lanka", 1996, "ODI_WC", "Arjuna Ranatunga", [
  ["Arjuna Ranatunga", "Batsman", { batting: 82, leadership: 94 }, ["Captain Fantastic"]],
  ["Sanath Jayasuriya", "AllRounder", { batting: 90, bowling: 76 }, ["Powerplay Destroyer"]],
  ["Aravinda de Silva", "Batsman", { batting: 92, pressure: 92 }, ["Big Match Player"]],
  ["Romesh Kaluwitharana", "Wicketkeeper", { batting: 80 }, ["Powerplay Destroyer"]],
  ["Roshan Mahanama", "Batsman", { batting: 78 }],
  ["Hashan Tillakaratne", "Batsman", { batting: 78 }],
  ["Muttiah Muralitharan", "SpinBowler", { bowling: 96 }, ["Spin Wizard"]],
  ["Chaminda Vaas", "PaceBowler", { bowling: 86 }, ["Strike Bowler"]],
  ["Kumar Dharmasena", "SpinBowler", { bowling: 78 }],
  ["Pramodya Wickramasinghe", "PaceBowler", { bowling: 78 }],
  ["Asanka Gurusinha", "Batsman", { batting: 78 }],
]);

const australia2015: Squad = gen("Australia 2015", "Australia", 2015, "ODI_WC", "Michael Clarke", [
  ["Michael Clarke", "Batsman", { batting: 86, leadership: 88 }, ["Captain Fantastic"]],
  ["David Warner", "Batsman", { batting: 90 }, ["Powerplay Destroyer"]],
  ["Steve Smith", "Batsman", { batting: 92 }, ["Run Machine"]],
  ["Aaron Finch", "Batsman", { batting: 84 }],
  ["Glenn Maxwell", "AllRounder", { batting: 86, bowling: 74 }, ["Finisher"]],
  ["Brad Haddin", "Wicketkeeper", { batting: 80 }],
  ["James Faulkner", "AllRounder", { batting: 76, bowling: 82 }, ["Death Overs Specialist"]],
  ["Mitchell Starc", "PaceBowler", { bowling: 96 }, ["Strike Bowler"]],
  ["Mitchell Johnson", "PaceBowler", { bowling: 92 }, ["Strike Bowler"]],
  ["Josh Hazlewood", "PaceBowler", { bowling: 86 }],
  ["Shane Watson", "AllRounder", { batting: 82, bowling: 76 }],
]);

/* ---------- T20 extras ---------- */
const india2024T20: Squad = gen("India 2024", "India", 2024, "T20_WC", "Rohit Sharma", [
  ["Rohit Sharma", "Batsman", { batting: 92, leadership: 92 }, ["Captain Fantastic", "Powerplay Destroyer"]],
  ["Virat Kohli", "Batsman", { batting: 90 }, ["Run Machine"]],
  ["Rishabh Pant", "Wicketkeeper", { batting: 86 }, ["Clutch Performer"]],
  ["Suryakumar Yadav", "Batsman", { batting: 92 }, ["Finisher"]],
  ["Hardik Pandya", "AllRounder", { batting: 82, bowling: 80 }, ["Finisher"]],
  ["Ravindra Jadeja", "AllRounder", { batting: 76, bowling: 84 }],
  ["Axar Patel", "AllRounder", { batting: 74, bowling: 82 }],
  ["Kuldeep Yadav", "SpinBowler", { bowling: 88 }, ["Spin Wizard"]],
  ["Jasprit Bumrah", "PaceBowler", { bowling: 98, pressure: 96 }, ["Strike Bowler", "Ice Veins", "Death Overs Specialist"]],
  ["Arshdeep Singh", "PaceBowler", { bowling: 84 }, ["Death Overs Specialist"]],
  ["Shivam Dube", "AllRounder", { batting: 78, bowling: 68 }],
]);

const england2010T20: Squad = gen("England 2010", "England", 2010, "T20_WC", "Paul Collingwood", [
  ["Paul Collingwood", "AllRounder", { batting: 78, bowling: 70, leadership: 86 }, ["Captain Fantastic"]],
  ["Kevin Pietersen", "Batsman", { batting: 92, pressure: 90 }, ["Big Match Player"]],
  ["Craig Kieswetter", "Wicketkeeper", { batting: 82 }],
  ["Michael Lumb", "Batsman", { batting: 78 }],
  ["Eoin Morgan", "Batsman", { batting: 84 }, ["Finisher"]],
  ["Luke Wright", "AllRounder", { batting: 76, bowling: 72 }],
  ["Graeme Swann", "SpinBowler", { bowling: 88 }, ["Spin Wizard"]],
  ["Stuart Broad", "PaceBowler", { bowling: 86 }, ["Strike Bowler"]],
  ["Ryan Sidebottom", "PaceBowler", { bowling: 82 }],
  ["Tim Bresnan", "AllRounder", { batting: 70, bowling: 78 }],
  ["Michael Yardy", "SpinBowler", { bowling: 74 }],
]);

const pakistan2009T20: Squad = gen("Pakistan 2009", "Pakistan", 2009, "T20_WC", "Younis Khan", [
  ["Younis Khan", "Batsman", { batting: 84, leadership: 88 }, ["Captain Fantastic"]],
  ["Shahid Afridi", "AllRounder", { batting: 82, bowling: 82, pressure: 88 }, ["Clutch Performer", "Big Match Player"]],
  ["Umar Akmal", "Batsman", { batting: 80 }],
  ["Kamran Akmal", "Wicketkeeper", { batting: 78 }],
  ["Misbah-ul-Haq", "Batsman", { batting: 82 }],
  ["Shoaib Malik", "AllRounder", { batting: 78, bowling: 74 }],
  ["Umar Gul", "PaceBowler", { bowling: 90 }, ["Death Overs Specialist", "Strike Bowler"]],
  ["Mohammad Aamer", "PaceBowler", { bowling: 86 }, ["Strike Bowler"]],
  ["Saeed Ajmal", "SpinBowler", { bowling: 88 }, ["Spin Wizard"]],
  ["Abdul Razzaq", "AllRounder", { batting: 76, bowling: 78 }],
  ["Fawad Alam", "Batsman", { batting: 74 }],
]);

/* ---------- Champions Trophy extras ---------- */
const australia2006CT: Squad = gen("Australia 2006", "Australia", 2006, "CHAMPIONS", "Ricky Ponting", [
  ["Ricky Ponting", "Batsman", { batting: 94, leadership: 92 }, ["Captain Fantastic"]],
  ["Adam Gilchrist", "Wicketkeeper", { batting: 92 }, ["Powerplay Destroyer"]],
  ["Matthew Hayden", "Batsman", { batting: 90 }],
  ["Michael Hussey", "Batsman", { batting: 88, pressure: 92 }, ["Ice Veins"]],
  ["Damien Martyn", "Batsman", { batting: 84 }],
  ["Andrew Symonds", "AllRounder", { batting: 84, bowling: 74 }],
  ["Shane Watson", "AllRounder", { batting: 78, bowling: 76 }],
  ["Brett Lee", "PaceBowler", { bowling: 92 }, ["Strike Bowler"]],
  ["Glenn McGrath", "PaceBowler", { bowling: 94 }, ["Strike Bowler"]],
  ["Nathan Bracken", "PaceBowler", { bowling: 82 }],
  ["Brad Hogg", "SpinBowler", { bowling: 80 }],
]);

/* ---------- Franchise extras ---------- */
const cskLegends: Squad = gen("Chennai Kings 2010", "Franchise", 2010, "FRANCHISE_T20", "MS Dhoni", [
  ["MS Dhoni", "Wicketkeeper", { batting: 88, leadership: 96 }, ["Captain Fantastic", "Finisher"]],
  ["Suresh Raina", "AllRounder", { batting: 84, bowling: 66, fielding: 92 }, ["Finisher"]],
  ["Murali Vijay", "Batsman", { batting: 82 }],
  ["Matthew Hayden", "Batsman", { batting: 88 }, ["Powerplay Destroyer"]],
  ["Michael Hussey", "Batsman", { batting: 86, pressure: 92 }, ["Ice Veins"]],
  ["Doug Bollinger", "PaceBowler", { bowling: 82 }],
  ["Muttiah Muralitharan", "SpinBowler", { bowling: 92 }, ["Spin Wizard"]],
  ["Albie Morkel", "AllRounder", { batting: 76, bowling: 78 }, ["Finisher"]],
  ["R Ashwin", "SpinBowler", { bowling: 84 }, ["Spin Wizard"]],
  ["Joginder Sharma", "PaceBowler", { bowling: 70 }],
  ["S Badrinath", "Batsman", { batting: 76 }],
], ["Matthew Hayden", "Michael Hussey", "Doug Bollinger", "Muttiah Muralitharan", "Albie Morkel"]);

const rcbFire: Squad = gen("Bangalore Royals 2016", "Franchise", 2016, "FRANCHISE_T20", "Virat Kohli", [
  ["Virat Kohli", "Batsman", { batting: 98, leadership: 88 }, ["Captain Fantastic", "Run Machine"]],
  ["AB de Villiers", "Wicketkeeper", { batting: 96 }, ["Finisher", "Powerplay Destroyer"]],
  ["Chris Gayle", "Batsman", { batting: 94 }, ["Powerplay Destroyer"]],
  ["KL Rahul", "Batsman", { batting: 82 }],
  ["Shane Watson", "AllRounder", { batting: 80, bowling: 74 }],
  ["Sachin Baby", "Batsman", { batting: 70 }],
  ["Yuzvendra Chahal", "SpinBowler", { bowling: 86 }, ["Spin Wizard"]],
  ["Chris Jordan", "PaceBowler", { bowling: 82 }, ["Death Overs Specialist"]],
  ["Sreenath Aravind", "PaceBowler", { bowling: 76 }],
  ["Iqbal Abdulla", "SpinBowler", { bowling: 74 }],
  ["Stuart Binny", "AllRounder", { batting: 72, bowling: 72 }],
], ["AB de Villiers", "Chris Gayle", "Shane Watson", "Chris Jordan"]);

const kkrRoyals: Squad = gen("Kolkata Riders 2014", "Franchise", 2014, "FRANCHISE_T20", "Gautam Gambhir", [
  ["Gautam Gambhir", "Batsman", { batting: 84, leadership: 90 }, ["Captain Fantastic", "Wall"]],
  ["Robin Uthappa", "Batsman", { batting: 84 }, ["Powerplay Destroyer"]],
  ["Manish Pandey", "Batsman", { batting: 80 }],
  ["Yusuf Pathan", "AllRounder", { batting: 80, bowling: 68 }, ["Finisher"]],
  ["Ryan ten Doeschate", "AllRounder", { batting: 74, bowling: 72 }],
  ["Piyush Chawla", "SpinBowler", { bowling: 80 }],
  ["Sunil Narine", "SpinBowler", { bowling: 94 }, ["Spin Wizard", "Strike Bowler"]],
  ["Morne Morkel", "PaceBowler", { bowling: 86 }, ["Strike Bowler"]],
  ["Umesh Yadav", "PaceBowler", { bowling: 82 }],
  ["Andre Russell", "AllRounder", { batting: 84, bowling: 80 }, ["Finisher"]],
  ["Wriddhiman Saha", "Wicketkeeper", { batting: 76 }],
], ["Ryan ten Doeschate", "Sunil Narine", "Morne Morkel", "Andre Russell"]);

/* ---------- Test extras ---------- */
const england2005Test: Squad = gen("England 2005", "England", 2005, "TEST", "Michael Vaughan", [
  ["Michael Vaughan", "Batsman", { batting: 84, leadership: 90 }, ["Captain Fantastic"]],
  ["Andrew Strauss", "Batsman", { batting: 86 }, ["Wall"]],
  ["Marcus Trescothick", "Batsman", { batting: 86 }],
  ["Kevin Pietersen", "Batsman", { batting: 90, pressure: 90 }, ["Big Match Player"]],
  ["Andrew Flintoff", "AllRounder", { batting: 84, bowling: 88, pressure: 92 }, ["Big Match Player"]],
  ["Geraint Jones", "Wicketkeeper", { batting: 76 }],
  ["Ashley Giles", "SpinBowler", { bowling: 78 }],
  ["Matthew Hoggard", "PaceBowler", { bowling: 86 }, ["Strike Bowler"]],
  ["Steve Harmison", "PaceBowler", { bowling: 88 }, ["Strike Bowler"]],
  ["Simon Jones", "PaceBowler", { bowling: 84 }],
  ["Ian Bell", "Batsman", { batting: 82 }],
]);

const wi1984Test: Squad = gen("West Indies 1984", "West Indies", 1984, "TEST", "Clive Lloyd", [
  ["Clive Lloyd", "Batsman", { batting: 86, leadership: 94 }, ["Captain Fantastic"]],
  ["Viv Richards", "Batsman", { batting: 96 }, ["Run Machine"]],
  ["Gordon Greenidge", "Batsman", { batting: 90 }, ["Powerplay Destroyer"]],
  ["Desmond Haynes", "Batsman", { batting: 86 }],
  ["Larry Gomes", "Batsman", { batting: 80 }],
  ["Jeff Dujon", "Wicketkeeper", { batting: 78 }],
  ["Malcolm Marshall", "PaceBowler", { bowling: 98 }, ["Strike Bowler"]],
  ["Michael Holding", "PaceBowler", { bowling: 94 }, ["Strike Bowler"]],
  ["Joel Garner", "PaceBowler", { bowling: 94 }],
  ["Andy Roberts", "PaceBowler", { bowling: 90 }, ["Strike Bowler"]],
  ["Roger Harper", "SpinBowler", { bowling: 76 }],
]);

export const ALL_SQUADS: Squad[] = [
  india2011, australia2003, australia1999, england2019, pakistan1992, westindies1979,
  india2023, nz2019, sa1999, sl1996, australia2015,
  india2007T20, westindies2016, australia2021T20, india2024T20, england2010T20, pakistan2009T20,
  pakistan2017, india2013, australia2006CT,
  chennaiKings, mumbaiTitans, cskLegends, rcbFire, kkrRoyals,
  australia2005Test, india2018Test, england2005Test, wi1984Test,
];

export const SQUADS_BY_MODE: Record<GameMode, Squad[]> = {
  ODI_WC:        [india2011, australia2003, australia1999, england2019, pakistan1992, westindies1979, india2023, nz2019, sa1999, sl1996, australia2015],
  T20_WC:        [india2007T20, westindies2016, australia2021T20, india2024T20, england2010T20, pakistan2009T20],
  CHAMPIONS:     [pakistan2017, india2013, australia2006CT],
  FRANCHISE_T20: [chennaiKings, mumbaiTitans, cskLegends, rcbFire, kkrRoyals],
  TEST:          [australia2005Test, india2018Test, england2005Test, wi1984Test],
};

export const MODE_LABELS: Record<GameMode, { title: string; subtitle: string; format: string }> = {
  ODI_WC:        { title: "ODI World Cup",     subtitle: "50 overs. Every ball matters.",  format: "50 Overs" },
  T20_WC:        { title: "T20 World Cup",     subtitle: "Big hits. Bigger nights.",       format: "20 Overs" },
  CHAMPIONS:    { title: "Champions Trophy",  subtitle: "Only the best qualify.",          format: "50 Overs" },
  FRANCHISE_T20: { title: "Franchise League",  subtitle: "Draft heroes. Max 4 overseas.",   format: "20 Overs" },
  TEST:          { title: "Test Cricket",      subtitle: "The purest form of the game.",    format: "5 Days"  },
};

// Chemistry pairs (by name substrings — case sensitive display names)
export interface ChemistryLink {
  a: string; b: string; label: string;
}

export const CHEMISTRY: ChemistryLink[] = [
  { a: "Sachin Tendulkar", b: "Virender Sehwag", label: "Opening Partnership" },
  { a: "MS Dhoni",         b: "Suresh Raina",    label: "Finishing" },
  { a: "Shane Warne",      b: "Glenn McGrath",   label: "Bowling Pressure" },
  { a: "Virat Kohli",      b: "MS Dhoni",        label: "Chase Bonus" },
  { a: "Adam Gilchrist",   b: "Matthew Hayden",  label: "Explosive Starts" },
  { a: "Rohit Sharma",     b: "Jasprit Bumrah",  label: "Titans Core" },
  { a: "Wasim Akram",      b: "Imran Khan",      label: "Reverse Swing" },
];