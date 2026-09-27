import type { ProcessRoundOutput, RoundPickInput, RoundPlayerResult, SeasonPlayer } from "../types";

const WAIVED_MESSAGE =
  "All remaining players would have been eliminated. Elimination-causing strikes were waived.";

export function processRound(players: SeasonPlayer[], picks: RoundPickInput[]): ProcessRoundOutput {
  const activeAtStart = players.filter((player) => player.status === "ACTIVE");
  const pickByPlayer = new Map(picks.map((pick) => [pick.seasonPlayerId, pick]));

  const proposedResults = activeAtStart.map((player): RoundPlayerResult => {
    const pick = pickByPlayer.get(player.id);
    const result = pick?.result ?? "NO_PICK";
    const strikeDelta = result === "LOSS" || result === "NO_PICK" ? 1 : 0;
    return {
      seasonPlayerId: player.id,
      result,
      strikeDelta,
      strikeWaived: false
    };
  });

  const everyActiveWouldBeEliminated =
    activeAtStart.length > 0 &&
    activeAtStart.every((player) => {
      const result = proposedResults.find((item) => item.seasonPlayerId === player.id);
      return player.strikeCount + (result?.strikeDelta ?? 0) >= 2;
    });

  const shouldWaiveAllLost = everyActiveWouldBeEliminated;
  const results = proposedResults.map((result) => {
    if (!shouldWaiveAllLost || result.strikeDelta === 0) return result;
    return {
      ...result,
      result: "SURVIVED_ALL_LOST" as const,
      strikeDelta: 0,
      strikeWaived: true,
      explanation: WAIVED_MESSAGE
    };
  });

  const nextPlayers = players.map((player) => {
    if (player.status !== "ACTIVE") return { ...player };
    const result = results.find((item) => item.seasonPlayerId === player.id);
    const strikeCount = Math.min(2, player.strikeCount + (result?.strikeDelta ?? 0));
    return {
      ...player,
      strikeCount,
      status: strikeCount >= 2 ? "ELIMINATED" as const : "ACTIVE" as const
    };
  });

  const stillActive = nextPlayers.filter((player) => player.status === "ACTIVE");
  const championPlayers =
    !shouldWaiveAllLost && stillActive.length === 1
      ? nextPlayers.map((player) => (player.id === stillActive[0].id ? { ...player, status: "CHAMPION" as const } : player))
      : nextPlayers;

  const events = [];
  if (shouldWaiveAllLost) {
    events.push({ type: "ALL_SURVIVORS_LOST_RULE", message: WAIVED_MESSAGE });
  }
  const champion = championPlayers.find((player) => player.status === "CHAMPION");
  if (champion) {
    events.push({ type: "CHAMPION_DECLARED", message: `${champion.displayName} is the last active survivor.` });
  }

  return {
    players: championPlayers,
    results,
    events
  };
}

export function canUseTeam(usedTeamAbbreviations: string[], requestedTeam: string): boolean {
  return !usedTeamAbbreviations.includes(requestedTeam);
}
