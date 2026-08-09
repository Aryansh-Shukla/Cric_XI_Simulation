import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Shield, Star, ArrowRight, ArrowLeft } from "lucide-react";
import type { Player } from "@/lib/cricket/types";

interface Props {
  players: Player[];
  onBack: () => void;
  onConfirm: (leadership: { captainId: string; viceCaptainId: string; keeperId: string }) => void;
  teamName: string;
  onTeamNameChange: (name: string) => void;
}

export function Leadership({ players, onBack, onConfirm, teamName, onTeamNameChange }: Props) {
  const keepers = useMemo(() => players.filter((p) => p.role === "Wicketkeeper"), [players]);
  const suggestedCaptain = useMemo(
    () => [...players].sort((a, b) => b.stats.leadership - a.stats.leadership)[0],
    [players],
  );
  const [captainId, setCaptainId] = useState<string>(suggestedCaptain?.id ?? players[0].id);
  const [viceCaptainId, setViceCaptainId] = useState<string>(() => {
    const others = players.filter((p) => p.id !== captainId);
    return (
      [...others].sort((a, b) => b.stats.leadership - a.stats.leadership)[0]?.id ?? others[0]?.id
    );
  });
  const [keeperId, setKeeperId] = useState<string>(keepers[0]?.id ?? "");

  const captain = players.find((p) => p.id === captainId)!;
  const eligibleVc = players.filter((p) => p.id !== captainId);

  const canConfirm = captainId && viceCaptainId && viceCaptainId !== captainId && keeperId;

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to draft
        </button>
        <div className="text-xs uppercase tracking-widest text-gold">Leadership</div>
        <h2 className="mt-1 text-3xl font-bold md:text-4xl">Appoint your leaders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Captaincy and the gloves influence pressure moments in the simulation.
        </p>

        <div className="mt-6 glass-card rounded-2xl p-4">
          <label
            htmlFor="team-name"
            className="text-xs uppercase tracking-widest text-muted-foreground"
          >
            Name Your Team
          </label>
          <input
            id="team-name"
            type="text"
            value={teamName}
            maxLength={24}
            onChange={(e) => onTeamNameChange(e.target.value)}
            placeholder="Your XI"
            className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/30 px-4 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-[color:var(--gold)]/60 sm:max-w-sm"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Optional · up to 24 characters. Leave blank to use the default &ldquo;Your XI&rdquo;.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <LeaderColumn
            icon={<Crown className="h-4 w-4 text-gold" />}
            title="Captain"
            desc="Sets the tempo. Boosts pressure, chemistry, and clutch scenarios."
            selectedId={captainId}
            onSelect={(id) => {
              setCaptainId(id);
              if (viceCaptainId === id) {
                const other = players.find((p) => p.id !== id);
                setViceCaptainId(other?.id ?? "");
              }
            }}
            options={players}
            accent="gold"
          />
          <LeaderColumn
            icon={<Star className="h-4 w-4 text-[color:var(--accent)]" />}
            title="Vice Captain"
            desc="Steps up when it matters. Second-in-command leadership boost."
            selectedId={viceCaptainId}
            onSelect={setViceCaptainId}
            options={eligibleVc}
            accent="emerald"
          />
          <LeaderColumn
            icon={<Shield className="h-4 w-4 text-[color:var(--accent)]" />}
            title="Designated Keeper"
            desc={
              keepers.length > 1
                ? "Multiple keepers drafted — pick the gloves."
                : "Only one keeper — automatic."
            }
            selectedId={keeperId}
            onSelect={setKeeperId}
            options={keepers}
            accent="emerald"
            disabled={keepers.length <= 1}
          />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Captain: <span className="font-semibold text-gold">{captain.name}</span> · Leadership{" "}
            {captain.stats.leadership}
          </div>
          <button
            onClick={() => canConfirm && onConfirm({ captainId, viceCaptainId, keeperId })}
            disabled={!canConfirm}
            className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm XI <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaderColumn({
  icon,
  title,
  desc,
  options,
  selectedId,
  onSelect,
  accent,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  options: Player[];
  selectedId: string;
  onSelect: (id: string) => void;
  accent: "gold" | "emerald";
  disabled?: boolean;
}) {
  const ring = accent === "gold" ? "ring-[color:var(--gold)]" : "ring-[color:var(--accent)]";
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon} {title}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{desc}</p>
      <div
        className={`mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1 ${disabled ? "opacity-60" : ""}`}
      >
        {options.map((p) => {
          const active = p.id === selectedId;
          return (
            <motion.button
              key={p.id}
              onClick={() => !disabled && onSelect(p.id)}
              whileHover={{ x: 2 }}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                active
                  ? `border-transparent bg-[color:var(--muted)] ring-2 ${ring}`
                  : "border-[color:var(--border)] hover:border-[color:var(--gold)]/40"
              }`}
            >
              <span className="truncate">{p.name}</span>
              <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                L{p.stats.leadership}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
