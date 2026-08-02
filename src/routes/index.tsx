import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landing } from "@/components/cricket/Landing";
import { ModeSelect } from "@/components/cricket/ModeSelect";
import { Draft } from "@/components/cricket/Draft";
import { Leadership } from "@/components/cricket/Leadership";
import { TeamView } from "@/components/cricket/TeamView";
import { TournamentView } from "@/components/cricket/TournamentView";
import type { Difficulty, GameMode, Player } from "@/lib/cricket/types";

export const Route = createFileRoute("/")({
  component: Index,
});

type Screen = "landing" | "mode" | "draft" | "leadership" | "team" | "tournament";

export interface LeadershipChoice {
  captainId: string;
  viceCaptainId: string;
  keeperId: string;
}

function Index() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [mode, setMode] = useState<GameMode>("ODI_WC");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [players, setPlayers] = useState<Player[]>([]);
  const [leadership, setLeadership] = useState<LeadershipChoice | null>(null);

  // Dev-only catalogue integrity report.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void import("@/lib/cricket/validation").then(m => m.logValidationReport());
  }, []);

  const reset = () => {
    setPlayers([]);
    setLeadership(null);
    setScreen("mode");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {screen === "landing" && <Landing onPlay={() => setScreen("mode")} />}
      {screen === "mode" && (
        <ModeSelect
          onBack={() => setScreen("landing")}
          onStart={(m, d) => { setMode(m); setDifficulty(d); setPlayers([]); setLeadership(null); setScreen("draft"); }}
        />
      )}
      {screen === "draft" && (
        <Draft
          mode={mode}
          difficulty={difficulty}
          onComplete={(p) => { setPlayers(p); setScreen("leadership"); }}
        />
      )}
      {screen === "leadership" && (
        <Leadership
          players={players}
          onBack={() => setScreen("draft")}
          onConfirm={(l) => { setLeadership(l); setScreen("team"); }}
        />
      )}
      {screen === "team" && (
        <TeamView
          players={players}
          mode={mode}
          leadership={leadership}
          onSimulate={() => setScreen("tournament")}
          onRestart={reset}
        />
      )}
      {screen === "tournament" && (
        <TournamentView players={players} mode={mode} leadership={leadership} onRestart={reset} />
      )}
    </div>
  );
}
