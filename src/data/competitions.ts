import type { Competition, CompetitionId, Edition } from "./model";

export const COMPETITIONS: Competition[] = [
  { id: "ODI_WC", name: "ODI World Cup", format: "ODI", mode: "ODI_WC" },
  { id: "T20_WC", name: "T20 World Cup", format: "T20", mode: "T20_WC" },
  { id: "CHAMPIONS", name: "Champions Trophy", format: "ODI", mode: "CHAMPIONS" },
  { id: "IPL", name: "Indian Premier League", format: "T20", mode: "FRANCHISE_T20" },
  { id: "ODI", name: "One Day Internationals", format: "ODI", mode: null },
  { id: "TEST", name: "Test Cricket", format: "TEST", mode: "TEST" },
];

export const COMPETITION_BY_ID = new Map(COMPETITIONS.map((c) => [c.id, c]));

const ed = (
  competitionId: CompetitionId,
  prefix: string,
  year: number,
  label: string,
): Edition => ({
  id: `${prefix}-${year}`,
  competitionId,
  year,
  label,
});

const ODI_WC_YEARS = [1975, 1979, 1983, 1987, 1992, 1996, 1999, 2003, 2007, 2011, 2015, 2019, 2023];
const T20_WC_YEARS = [2007, 2009, 2010, 2012, 2014, 2016, 2021, 2022, 2024];
const CT_YEARS = [2002, 2004, 2006, 2009, 2013, 2017, 2025];
const IPL_YEARS = Array.from({ length: 17 }, (_, i) => 2008 + i);
const ODI_YEARS = [1985, 1990, 1996, 2002, 2007, 2013, 2018, 2024];
/** Test snapshots are era-based, not annual. */
const TEST_YEARS = [1976, 1981, 1984, 1989, 1994, 1999, 2001, 2005, 2011, 2013, 2018, 2023];

export const EDITIONS: Edition[] = [
  ...ODI_WC_YEARS.map((y) => ed("ODI_WC", "odiwc", y, `World Cup ${y}`)),
  ...T20_WC_YEARS.map((y) => ed("T20_WC", "t20wc", y, `T20 World Cup ${y}`)),
  ...CT_YEARS.map((y) => ed("CHAMPIONS", "ct", y, `Champions Trophy ${y}`)),
  ...IPL_YEARS.map((y) => ed("IPL", "ipl", y, `IPL ${y}`)),
  ...ODI_YEARS.map((y) => ed("ODI", "odi", y, `ODI ${y}`)),
  ...TEST_YEARS.map((y) => ed("TEST", "test", y, `Test Era ${y}`)),
];

export const EDITION_BY_ID = new Map(EDITIONS.map((e) => [e.id, e]));
