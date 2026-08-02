import { validateCatalog } from "@/lib/cricket/validation";
import { DraftPoolService } from "@/services/DraftPoolService";
import { RerollService } from "@/services/RerollService";
const r = validateCatalog();
console.log("counts", r.counts, "ok", r.ok);
console.log("coverage", r.coverage);
console.log("errors", r.errors.length, r.errors.slice(0,15));
console.log("warnings", r.warnings.length, r.warnings.slice(0,5));
for (const m of ["ODI_WC","T20_WC","CHAMPIONS","FRANCHISE_T20","TEST"] as const) {
  const pool = DraftPoolService.getPool(m);
  const s = pool.find(x => x.label.startsWith("India")) ?? pool[0];
  console.log(m, "squads:", pool.length, "| sample:", s.label,
    "| sameTeamDiffYear:", RerollService.sameTeamDifferentYear(s, m).length,
    "| sameYearDiffTeam:", RerollService.sameYearDifferentTeam(s, m).length);
}
