import type { Team } from "./model";

const intl = (id: string, name: string): Team => ({
  id,
  name,
  type: "International",
  country: name,
});

export const TEAMS: Team[] = [
  intl("india", "India"),
  intl("australia", "Australia"),
  intl("england", "England"),
  intl("pakistan", "Pakistan"),
  intl("west-indies", "West Indies"),
  intl("new-zealand", "New Zealand"),
  intl("south-africa", "South Africa"),
  intl("sri-lanka", "Sri Lanka"),
  intl("bangladesh", "Bangladesh"),
  intl("zimbabwe", "Zimbabwe"),
  intl("afghanistan", "Afghanistan"),
  intl("ireland", "Ireland"),
  intl("netherlands", "Netherlands"),
  intl("kenya", "Kenya"),
  intl("east-africa", "East Africa"),

  // ---- IPL franchises. Renames share a lineage id, genuinely distinct clubs do not.
  {
    id: "csk",
    name: "Chennai Super Kings",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "chennai-ipl",
  },
  {
    id: "mi",
    name: "Mumbai Indians",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "mumbai-ipl",
  },
  {
    id: "rcb",
    name: "Royal Challengers Bengaluru",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "bengaluru-ipl",
    nameHistory: [
      { from: 2008, name: "Royal Challengers Bangalore" },
      { from: 2024, name: "Royal Challengers Bengaluru" },
    ],
  },
  {
    id: "kkr",
    name: "Kolkata Knight Riders",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "kolkata-ipl",
  },
  {
    id: "rr",
    name: "Rajasthan Royals",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "rajasthan-ipl",
  },
  {
    id: "pbks",
    name: "Punjab Kings",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "punjab-ipl",
    nameHistory: [
      { from: 2008, name: "Kings XI Punjab" },
      { from: 2021, name: "Punjab Kings" },
    ],
  },
  {
    id: "dc",
    name: "Delhi Capitals",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "delhi-ipl",
    nameHistory: [
      { from: 2008, name: "Delhi Daredevils" },
      { from: 2019, name: "Delhi Capitals" },
    ],
  },
  {
    id: "srh",
    name: "Sunrisers Hyderabad",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "sunrisers-ipl",
  },
  // Deccan Chargers is a separate club from Sunrisers Hyderabad, not a rename.
  {
    id: "dch",
    name: "Deccan Chargers",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "deccan-ipl",
  },
  {
    id: "ktk",
    name: "Kochi Tuskers Kerala",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "kochi-ipl",
  },
  {
    id: "pwi",
    name: "Pune Warriors India",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "pune-warriors-ipl",
  },
  {
    id: "rps",
    name: "Rising Pune Supergiant",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "rising-pune-ipl",
  },
  {
    id: "gl",
    name: "Gujarat Lions",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "gujarat-lions-ipl",
  },
  {
    id: "gt",
    name: "Gujarat Titans",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "gujarat-titans-ipl",
  },
  {
    id: "lsg",
    name: "Lucknow Super Giants",
    type: "Franchise",
    country: "India",
    franchiseLineageId: "lucknow-ipl",
  },
];

export const TEAM_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

/** Era-correct display name for a team in a given year. */
export function teamNameForYear(teamId: string, year: number): string {
  const t = TEAM_BY_ID.get(teamId);
  if (!t) return teamId;
  if (!t.nameHistory?.length) return t.name;
  let name = t.name;
  for (const h of t.nameHistory) if (year >= h.from) name = h.name;
  return name;
}
