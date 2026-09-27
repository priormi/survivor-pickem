import { describe, expect, it } from "vitest";
import { canUseTeam, processRound } from "../src/utils/survivorRules";
import type { SeasonPlayer } from "../src/types";

function player(id: string, strikeCount: number): SeasonPlayer {
  return { id, displayName: id, strikeCount, status: "ACTIVE" };
}

describe("survivor rules", () => {
  it("adds no strike for wins or ties", () => {
    const result = processRound([player("mike", 0), player("heather", 0)], [
      { seasonPlayerId: "mike", result: "WIN" },
      { seasonPlayerId: "heather", result: "TIE" }
    ]);

    expect(result.players.map((item) => item.strikeCount)).toEqual([0, 0]);
  });

  it("adds one strike for a loss or no pick", () => {
    const result = processRound([player("mike", 0), player("heather", 0), player("chloe", 0)], [
      { seasonPlayerId: "mike", result: "LOSS" },
      { seasonPlayerId: "heather", result: "NO_PICK" },
      { seasonPlayerId: "chloe", result: "WIN" }
    ]);

    expect(result.players.find((item) => item.id === "mike")?.strikeCount).toBe(1);
    expect(result.players.find((item) => item.id === "heather")?.strikeCount).toBe(1);
    expect(result.players.find((item) => item.id === "chloe")?.strikeCount).toBe(0);
  });

  it("waives strikes when every active survivor would be eliminated", () => {
    const result = processRound([player("mike", 1), player("heather", 1)], [
      { seasonPlayerId: "mike", result: "LOSS" },
      { seasonPlayerId: "heather", result: "LOSS" }
    ]);

    expect(result.players.every((item) => item.status === "ACTIVE")).toBe(true);
    expect(result.players.map((item) => item.strikeCount)).toEqual([1, 1]);
    expect(result.results.every((item) => item.result === "SURVIVED_ALL_LOST")).toBe(true);
    expect(result.events[0].type).toBe("ALL_SURVIVORS_LOST_RULE");
  });

  it("does not activate the special rule when one active player survives normally", () => {
    const result = processRound([player("mike", 1), player("heather", 1)], [
      { seasonPlayerId: "mike", result: "LOSS" },
      { seasonPlayerId: "heather", result: "WIN" }
    ]);

    expect(result.players.find((item) => item.id === "mike")?.status).toBe("ELIMINATED");
    expect(result.players.find((item) => item.id === "heather")?.status).toBe("CHAMPION");
  });

  it("does not activate the special rule when a losing player remains alive", () => {
    const result = processRound([player("mike", 0), player("heather", 1)], [
      { seasonPlayerId: "mike", result: "LOSS" },
      { seasonPlayerId: "heather", result: "LOSS" }
    ]);

    expect(result.players.find((item) => item.id === "mike")?.strikeCount).toBe(1);
    expect(result.players.find((item) => item.id === "heather")?.status).toBe("ELIMINATED");
    expect(result.events.some((event) => event.type === "ALL_SURVIVORS_LOST_RULE")).toBe(false);
  });

  it("prevents reusing a locked team", () => {
    expect(canUseTeam(["BUF", "KC"], "BUF")).toBe(false);
    expect(canUseTeam(["BUF", "KC"], "DET")).toBe(true);
  });
});
