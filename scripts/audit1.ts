import { SQUAD_REGISTRY, PROFILE_REGISTRY } from "@/data/catalog";
const ids = new Map<string, number>();
for (const s of SQUAD_REGISTRY) ids.set(s.id, (ids.get(s.id) ?? 0) + 1);
const dupes = [...ids].filter(([, n]) => n > 1);
console.log("squads:", SQUAD_REGISTRY.length, "unique:", ids.size, "dupeIds:", dupes.length);
console.log(dupes.slice(0, 20));
let mismatch = 0;
const examples: string[] = [];
for (const s of SQUAD_REGISTRY) {
  for (const pid of s.playerProfileIds) {
    const p = PROFILE_REGISTRY.get(pid);
    if (!p) {
      examples.push(`MISSING ${pid}`);
      mismatch++;
      continue;
    }
    if (p.squadId !== s.id) {
      mismatch++;
      if (examples.length < 10)
        examples.push(`${s.id} label=${s.label} -> ${p.name} belongs ${p.squadId}`);
    }
  }
}
console.log("profile mismatches:", mismatch);
console.log(examples);
