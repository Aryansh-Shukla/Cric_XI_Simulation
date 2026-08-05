import { DraftPoolService } from "@/services/DraftPoolService";
import { RerollService } from "@/services/RerollService";
const pool = DraftPoolService.getPool("ODI_WC");
const pak = pool.find(s => s.country === "Pakistan" && s.year === 1987)!;
console.log("cur", pak?.id, pak?.label);
console.log("sameTeam", RerollService.sameTeamDifferentYear(pak, "ODI_WC").slice(0,5).map(s=>s.label));
console.log("sameYear", RerollService.sameYearDifferentTeam(pak, "ODI_WC").slice(0,5).map(s=>s.label));
const aus99 = pool.find(s => s.country === "Australia" && s.year === 1999)!;
console.log("aus99 sameYear", RerollService.sameYearDifferentTeam(aus99, "ODI_WC").map(s=>s.label));
