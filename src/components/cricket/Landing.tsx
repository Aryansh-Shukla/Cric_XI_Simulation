import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Calendar, Trophy, HelpCircle, Users, Github } from "lucide-react";
import { HowToPlay } from "./HowToPlay";

interface Props { onPlay: () => void; }

const recentWinners = [
  { name: "Priya S.", team: "India 2011 core", when: "2m ago" },
  { name: "Alex R.",  team: "Aussie 2003 pace attack", when: "9m ago" },
  { name: "Kabir M.", team: "1992 Cornered Tigers", when: "22m ago" },
];

export function Landing({ onPlay }: Props) {
  const [howToOpen, setHowToOpen] = useState(false);
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,oklch(0.78_0.14_85/.15),transparent_60%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--card)]/60 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-gold backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--accent)]" />
            Season 1 · Live
          </div>
          <h1 className="text-6xl font-black tracking-tight md:text-8xl">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">Cricket</span>{" "}
            <span className="bg-[image:var(--gradient-gold)] bg-clip-text text-transparent">XI</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-2xl">Draft Legends. Build Dynasties.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button onClick={onPlay} className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold">
            <Play className="h-4 w-4" /> Play Now
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="btn-ghost-gold inline-flex cursor-not-allowed items-center gap-2 rounded-full px-5 py-3 text-sm font-medium opacity-50"
          >
            <Calendar className="h-4 w-4" /> Daily Challenge
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">Coming Soon</span>
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="btn-ghost-gold inline-flex cursor-not-allowed items-center gap-2 rounded-full px-5 py-3 text-sm font-medium opacity-50"
          >
            <Trophy className="h-4 w-4" /> Leaderboard
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">Coming Soon</span>
          </button>
          <button
            type="button"
            onClick={() => setHowToOpen(true)}
            className="btn-ghost-gold inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
          >
            <HelpCircle className="h-4 w-4" /> How To Play
          </button>
        </motion.div>

        <HowToPlay open={howToOpen} onOpenChange={setHowToOpen} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="mt-14 w-full max-w-3xl">
          <div className="mb-3 flex items-center gap-2 px-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Recent Winners
          </div>
          <div className="glass-card grid gap-2 rounded-2xl p-2">
            {recentWinners.map((w) => (
              <div key={w.name} className="flex items-center justify-between rounded-xl px-4 py-3 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--gold)]/10 text-sm font-semibold text-gold">
                    {w.name.split(" ").map(x => x[0]).join("")}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground">{w.team}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{w.when}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <footer className="mt-14 w-full max-w-3xl border-t border-[color:var(--border)]/60 pt-6 text-center">
          <div className="text-xs text-muted-foreground">
            Fictional draft simulator · No affiliation with any cricket board.
          </div>
          <div className="mt-4 text-sm font-medium">Built by Aryansh Shukla</div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">Let&apos;s Connect</div>
          <a
            href="https://github.com/aryanshshukla"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-[color:var(--gold)]/50 hover:text-gold"
          >
            <Github className="h-3.5 w-3.5" /> GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}