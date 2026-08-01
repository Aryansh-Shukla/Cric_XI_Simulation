
# Phase 4 — Historical Universe + Living Tournament

This is a large phase. I'll execute it in staged sub-phases behind stable interfaces so nothing currently working breaks. Cloud/Supabase stays OFF.

## Sub-phase 4A — Data architecture (no gameplay change)

Introduce a normalized model + repository layer that the existing UI reads through. Existing squads keep working via a migration adapter.

New layout:
```text
src/data/
  competitions/    ODI_WC, T20_WC, CHAMPIONS, IPL, ODI, TEST
  editions/        one file per edition (year/season)
  teams/           canonical teams + franchise lineages
  players/         canonical players (id, name, nationality, hand, style)
  squads/          HistoricalSquad = competition+edition+team+profileIds
  profiles/        PlayerEditionProfile (ratings per edition)
  chemistry/       ChemistryRelationship
src/repositories/
  PlayerRepository, TeamRepository, CompetitionRepository,
  EditionRepository, SquadRepository, ProfileRepository
src/services/
  DraftPoolService, HistoricalSquadService, RatingService
```

Models (mapped onto existing `Player`/`Squad` types via adapters — no breaking rename):
- `Player` canonical: `{ id, name, nationality, battingHand?, bowlingStyle? }`
- `PlayerEditionProfile`: `{ playerId, competitionId, editionId, teamId, primaryRole, secondaryRoles, batting, bowling, fielding, wicketkeeping?, leadership, pressure, consistency, fitness, overall, canKeepWicket, bowlingRole, traits[] }`
- `HistoricalSquad`: `{ id, competitionId, editionId, teamId, playerProfileIds[] }`
- `TournamentFixture`: `{ id, stage, round, teamAId, teamBId, involvesUser, status, result? }`

Adapter: `squadToLegacy(HistoricalSquad) -> Squad` and `profileToPlayer(profile) -> Player` so the current draft/sim code keeps working while data moves under repositories.

Migration order: (1) create models + repos with in-memory store, (2) migrate existing hardcoded squads from `data.ts` into the new files, (3) swap `SQUADS_BY_MODE` to a repository-backed getter, (4) delete leftover inline data. Regression-test drafting after each swap.

## Sub-phase 4B — Canonical identity + edition ratings

- Assign stable `playerId` per real cricketer; multiple `PlayerEditionProfile`s per player.
- Draft engine dedupes by `playerId` (not by profile id) so "Kohli 2011" and "Kohli 2023" can't both be picked.
- Overall derived programmatically by role (batter=batting, bowler=bowling, AR=avg, WK=avg(bat,wk)) inside `RatingService.computeOverall(profile)`; stored value is a cache, mismatches are flagged by validator.
- Format-specific + era-normalized ratings live inside the profile (a T20 profile ≠ ODI profile ≠ Test profile even for the same player-year).

## Sub-phase 4C — Reroll rewiring

`SquadRepository`:
- `getAlternateEditionsForTeam(competitionId, teamId, excludeEditionId[], franchiseLineageId?)` → for "Same Team → Different Year", franchise renames traversed via `franchiseLineageId` (e.g. `kings-xi-punjab` and `punjab-kings` share `punjab-ipl`).
- `getOtherTeamsInEdition(competitionId, editionId, excludeTeamId[])` → "Same Year → Different Team", scoped to actual participants of that edition.
- Both return `[]` when nothing eligible; Draft disables the button and shows "No other eligible season available." — no crashes.

## Sub-phase 4D — Full fixture ledger + background AI simulation (critical fix)

Rewrite `src/lib/cricket/tournament.ts` around a full `TournamentFixture[]` ledger:

1. `generateFixtures(mode, userTeam, opponents)` produces the complete schedule for the mode:
   - ODI_WC 10-team single round robin → 45 fixtures, top 4 → SF1 (1v4) / SF2 (2v3) → Final.
   - T20_WC → configured group stage (all group fixtures) → Super 8 (top 2/group reseeded) → SF/Final.
   - CHAMPIONS → 2 groups round-robin → SF → Final.
   - IPL → 10 teams, 14 league matches per team (double round-robin trimmed to configured schedule) → Q1/Eliminator/Q2/Final.
   - TEST → 2-team N-match series (no background teams).
2. Each fixture flagged `involvesUser`.
3. `advanceTournament(state)`:
   - Find next `involvesUser && !completed` fixture → run interactive `simulateLimitedMatch`/`simulateTestMatch` exactly as today (this preserves current UX).
   - Then auto-simulate every non-user fixture in the same round/matchday using the real engine (silent, no animation).
   - Store canonical `MatchResult` on the fixture. Never resimulate: guarded by `status === 'completed'`.
4. `computeStandings(fixtures)` derives P/W/L/T/NR/Pts/NRR from completed fixtures only — no manual mutation. NRR from actual runs/overs in results.
5. `computePlayerStats(fixtures)` aggregates runs / wickets / catches across ALL completed fixtures (user + AI). Orange/Purple caps for IPL derive from this.
6. Qualification gate: transition to next stage only when every scheduled fixture of the current stage is `completed`. Knockout brackets seed from the completed table (not random).
7. Stage-transition hook generates next-stage fixtures from qualifiers (e.g. IPL Q2 = loser Q1 vs winner Eliminator, Final = Q1 winner vs Q2 winner).

Idempotency: `advanceTournament` operates on fixture IDs; re-invocation with the same state is a no-op. UI components only read derived state.

## Sub-phase 4E — UI wiring (minimal, preserves current styling)

- `TournamentView`: unchanged flow (Simulate → Reveal → Continue). Add small "Around the Tournament" panel listing AI results simulated on the same matchday. Standings/Leaders tabs now populated from the ledger.
- `Draft`: show historical context on cards (`Team — Competition Edition`), overall rating stays. Reroll buttons call new repository methods; disable when empty.
- No visual redesign.

## Sub-phase 4F — Historical catalogue population (batched)

Populate under `src/data/` incrementally. Each batch: add files, run validator, commit.
- Batch 1: ODI World Cup editions 1975–2023.
- Batch 2: T20 World Cup editions 2007–2024.
- Batch 3: Champions Trophy editions 2002–2025.
- Batch 4: IPL seasons 2008–2024 (with franchise lineage IDs; correct participants per year including defunct franchises).
- Batch 5: Generic ODI historical snapshots 1985–present.
- Batch 6: Test historical snapshots 1970–present (era-based, not annual).

Realistic scope note: I will not fabricate 300+ complete verified rosters in one shot. I'll seed each edition with the historically-correct participating teams and their **core known squads** (starting XIs + key squad members), marking any gaps with `sourceStatus: 'partiallyVerified'`. This is what the spec requires (§31, §32). The architecture supports later enrichment without code changes.

## Sub-phase 4G — Validation + reporting

`src/lib/cricket/validation.ts`:
- Unique squad IDs, resolvable player/team/competition/edition refs, no duplicate player within a squad, ratings in range, role-Overall formula match, IPL nationality present, WK/bowling metadata present.
- Dev-only console report on load: player/squad/edition counts, broken refs, coverage matrix per competition × edition.
- Sanity checks on tournament state: `W+L+T+NR = P`, scheduled == completed at stage boundaries, no MatchResult double-counted.

## Non-goals (explicit)

- No Cloud/Supabase (§9). Repository interfaces designed to be swappable later.
- No visual redesign of drafting/tournament/scorecard UI.
- No admin data browser UI (spec marks it optional §40; skipping for now).
- Test series remains 2-team, no invented background standings (§67).

## Files touched (high level)

- New: `src/data/**`, `src/repositories/**`, `src/services/**`, `src/lib/cricket/validation.ts`, `src/lib/cricket/fixtures.ts`.
- Rewritten: `src/lib/cricket/tournament.ts` (fixture ledger + background sim + derived standings/stats), `src/lib/cricket/data.ts` (thin re-export from repository).
- Adjusted: `src/components/cricket/Draft.tsx` (reroll via repos, historical context on cards), `src/components/cricket/TournamentView.tsx` ("Around the Tournament" + real standings/leaders), `src/lib/cricket/rating.ts` (formula-driven overall).
- Untouched behavior: `Landing`, `ModeSelect`, `Leadership`, `TeamView`, `ScorecardModal`, sim engines under `sim/`.

## Order of execution

1. 4A models + repository skeleton + adapters (no behavior change).
2. 4A migrate existing squads → repos; verify draft/sim.
3. 4B canonical player IDs + edition profiles; dedupe in draft.
4. 4C rewire rerolls.
5. 4D fixture ledger + background AI sim + derived standings/stats + qualification gates.
6. 4E UI wiring (context labels + around-the-tournament panel).
7. 4G validation + dev report.
8. 4F catalogue population, batch by batch, validating after each.
9. Full regression: each mode end-to-end.
