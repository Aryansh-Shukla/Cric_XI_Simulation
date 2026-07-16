import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Landing } from "@/components/cricket/Landing";
import { ModeSelect } from "@/components/cricket/ModeSelect";
import { Draft } from "@/components/cricket/Draft";
import { TeamView } from "@/components/cricket/TeamView";
import { TournamentView } from "@/components/cricket/TournamentView";
import type { Difficulty, GameMode, Player } from "@/lib/cricket/types";

export const Route = createFileRoute("/")({
  component: Index,
});

type Screen = "landing" | "mode" | "draft" | "team" | "tournament";

function Index() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [mode, setMode] = useState<GameMode>("ODI_WC");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [players, setPlayers] = useState<Player[]>([]);

  const reset = () => {
    setPlayers([]);
    setScreen("mode");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {screen === "landing" && <Landing onPlay={() => setScreen("mode")} />}
      {screen === "mode" && (
        <ModeSelect
          onBack={() => setScreen("landing")}
          onStart={(m, d) => { setMode(m); setDifficulty(d); setPlayers([]); setScreen("draft"); }}
        />
      )}
      {screen === "draft" && (
        <Draft
          mode={mode}
          difficulty={difficulty}
          onComplete={(p) => { setPlayers(p); setScreen("team"); }}
        />
      )}
      {screen === "team" && (
        <TeamView
          players={players}
          mode={mode}
          onSimulate={() => setScreen("tournament")}
          onRestart={reset}
        />
      )}
      {screen === "tournament" && (
        <TournamentView players={players} mode={mode} onRestart={reset} />
      )}
    </div>
  );
}
