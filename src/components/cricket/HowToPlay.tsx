import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Shuffle,
  Crown,
  Globe2,
  TrendingUp,
  Trophy,
  BarChart3,
  ClipboardList,
  Gauge,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTIONS = [
  {
    icon: Users,
    title: "The Draft",
    body: "You play 11 rounds. Each round deals you one historical squad — India at the 2011 World Cup, Chennai in IPL 2010 — and five players from it. Pick one, and the next round deals a new squad. A cricketer can only be drafted once: take Sachin Tendulkar from the 1996 World Cup and every other Tendulkar profile disappears from the pool for the rest of the draft.",
  },
  {
    icon: ClipboardList,
    title: "Team Composition",
    body: "The sidebar checklist tracks the XI you legally need: at least one wicketkeeper, a minimum of five bowling options (pace and spin), and no more than seven specialist batters. Players that would break a rule are greyed out with the reason shown on the card. If a round ever deals no legal pick, the draft auto-reshuffles so you can never get stuck.",
  },
  {
    icon: Shuffle,
    title: "Rerolls",
    body: "You get four of each reroll. 'Another Team · <year>' swaps to a different participant of that same tournament edition. 'Same Team · Different Year' keeps the team and jumps to another season of the same competition — franchise renames are followed, so Kings XI Punjab and Punjab Kings count as one club. If the catalogue has no valid alternative, the button is disabled rather than giving you a fake squad.",
  },
  {
    icon: TrendingUp,
    title: "Team Rating",
    body: "Every player carries a visible OVR derived from their role — batting for batters, bowling for bowlers, an average for all-rounders and keepers. Your team rating blends those with balance, depth and squad chemistry, and it updates live as you draft.",
  },
  {
    icon: Crown,
    title: "Captain & Vice-Captain",
    body: "After the eleventh pick you appoint a captain and a vice-captain. Leadership ratings matter: a strong captain improves your side under pressure, in tight chases and in knockout matches. The vice-captain provides a smaller backup bonus.",
  },
  {
    icon: Gauge,
    title: "Wicketkeeper",
    body: "One player in the XI must be nominated as keeper. Specialist keepers do the job best; nominating an outfielder is allowed but costs you in the field, so drafting at least one genuine gloveman is usually worth a slot.",
  },
  {
    icon: Globe2,
    title: "Overseas Restrictions",
    body: "In Franchise (IPL) mode only four overseas players may take the field. The overseas meter in the sidebar fills as you draft, and once it hits four every remaining non-Indian player is locked out for the rest of the draft.",
  },
  {
    icon: Trophy,
    title: "Tournament Progression",
    body: "Your XI enters the tournament format you chose — a World Cup group stage into knockouts, a Champions Trophy, a franchise league into playoffs, or a Test series. Matches are played one at a time: simulate, reveal the result, then continue. Lose a knockout and your run ends.",
  },
  {
    icon: BarChart3,
    title: "Match Simulation & Stats",
    body: "Each match is simulated ball by ball with pitch, weather, toss, phase-aware tactics and player attributes all feeding in. Open the full scorecard for batter and bowler lines, and check the standings and leaders tabs for runs, wickets and tournament-wide statistics.",
  },
];

export function HowToPlay({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-[color:var(--border)] bg-[color:var(--card)]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            How To Play <span className="text-gold">Cricket XI</span>
          </DialogTitle>
          <DialogDescription>
            Draft eleven cricketers from across cricket history, then take them through a
            tournament.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {SECTIONS.map(({ icon: Icon, title, body }) => (
            <section
              key={title}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/30 p-4"
            >
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-gold" />
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
