import { expect, type Page, test } from "@playwright/test";

type Team = { id: string; abbreviation: string; city: string; name: string };
type PickRecord = { week: number; teamId: string; locked: boolean };

const teams: Team[] = [
  { id: "ari", abbreviation: "ARI", city: "Arizona", name: "Cardinals" },
  { id: "atl", abbreviation: "ATL", city: "Atlanta", name: "Falcons" },
  { id: "bal", abbreviation: "BAL", city: "Baltimore", name: "Ravens" },
  { id: "buf", abbreviation: "BUF", city: "Buffalo", name: "Bills" },
  { id: "car", abbreviation: "CAR", city: "Carolina", name: "Panthers" },
  { id: "chi", abbreviation: "CHI", city: "Chicago", name: "Bears" },
  { id: "cin", abbreviation: "CIN", city: "Cincinnati", name: "Bengals" },
  { id: "cle", abbreviation: "CLE", city: "Cleveland", name: "Browns" }
];

const players = ["Mike", "Heather", "Chloe", "Sophia"];

function teamName(team: Team) {
  return `${team.city} ${team.name}`;
}

function roundForWeek(week: number) {
  return {
    id: `round-${week}`,
    displayName: `Week ${week}`,
    deadlineAt: `2026-10-${String(week).padStart(2, "0")}T17:00:00.000Z`,
    status: "OPEN"
  };
}

function createHarness() {
  let week = 1;
  let locked = false;
  const picks: PickRecord[] = [];

  function currentPick() {
    return picks.find((pick) => pick.week === week) ?? null;
  }

  function usedTeamIds() {
    return new Set(picks.filter((pick) => pick.week !== week).map((pick) => pick.teamId));
  }

  function matchups() {
    const used = usedTeamIds();
    return Array.from({ length: teams.length / 2 }, (_, index) => {
      const awayTeam = teams[index * 2];
      const homeTeam = teams[index * 2 + 1];
      return {
        id: `week-${week}-${awayTeam.id}-${homeTeam.id}`,
        kickoffAt: roundForWeek(week).deadlineAt,
        status: "SCHEDULED",
        awayTeam: { ...awayTeam, used: used.has(awayTeam.id), started: false, available: !used.has(awayTeam.id) },
        homeTeam: { ...homeTeam, used: used.has(homeTeam.id), started: false, available: !used.has(homeTeam.id) }
      };
    });
  }

  function pickOptions() {
    const pick = currentPick();
    const used = usedTeamIds();
    const currentTeam = pick ? teams.find((team) => team.id === pick.teamId) ?? null : null;

    return {
      round: roundForWeek(week),
      teams: [],
      matchups: locked ? [] : matchups(),
      currentPick: currentTeam,
      locked,
      disabledReason: locked ? "ALL_PICKS_LOCKED" : undefined,
      usedTeamIds: Array.from(used)
    };
  }

  function dashboard() {
    const pick = currentPick();
    const team = pick ? teams.find((item) => item.id === pick.teamId) ?? null : null;
    return {
      league: { id: "league", name: "Prior Family Survivor", slug: "prior-family", timezone: "America/Chicago" },
      season: { id: "season", year: 2026, name: "2026 NFL Survivor", status: "ACTIVE" },
      currentRound: {
        ...roundForWeek(week),
        locked,
        allPicksSubmitted: locked,
        submittedPickCount: pick ? 1 : 0,
        expectedPickCount: 4
      },
      player: { id: "mike", displayName: "Mike", isAdmin: true },
      players: players.map((displayName, index) => ({
        id: `season-player-${index}`,
        playerId: displayName.toLowerCase(),
        displayName,
        strikeCount: 0,
        status: "ACTIVE",
        pickSubmitted: displayName === "Mike" ? Boolean(pick) : false,
        pickVisible: displayName === "Mike" && Boolean(team),
        pickTeam: displayName === "Mike" ? team : null,
        pickHistory: picks.map((historyPick) => ({
          id: `history-${historyPick.week}`,
          roundId: `round-${historyPick.week}`,
          roundName: `Week ${historyPick.week}`,
          roundSequence: historyPick.week,
          result: "PENDING",
          submittedAt: new Date().toISOString(),
          team: teams.find((item) => item.id === historyPick.teamId) ?? null,
          visible: true
        }))
      }))
    };
  }

  return {
    get week() {
      return week;
    },
    setWeek(nextWeek: number) {
      week = nextWeek;
      locked = false;
    },
    lockCurrentWeek() {
      locked = true;
      const pick = currentPick();
      if (pick) pick.locked = true;
    },
    picks,
    async install(page: Page) {
      await page.route("https://survivor-pickem.test/functions/v1/**", async (route) => {
        const functionName = route.request().url().split("/functions/v1/")[1]?.split("?")[0];
        let body: Record<string, unknown> = {};
        try {
          body = route.request().postDataJSON() as Record<string, unknown>;
        } catch {
          body = {};
        }

        if (functionName === "player-login") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ token: "test-token", player: { id: "mike", displayName: "Mike", isAdmin: true } })
          });
        }

        if (functionName === "get-dashboard") {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboard()) });
        }

        if (functionName === "get-pick-options") {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pickOptions()) });
        }

        if (functionName === "submit-pick") {
          const teamId = String(body.teamId ?? "");
          const selectedTeam = teams.find((team) => team.id === teamId);
          const previousUse = picks.find((pick) => pick.week !== week && pick.teamId === teamId);
          const existing = currentPick();

          if (!selectedTeam) {
            return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "TEAM_NOT_FOUND", message: "That team is not available." }) });
          }

          if (locked || existing?.locked) {
            return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "PICK_LOCKED", message: "All picks are in. Picks are locked and can no longer be changed." }) });
          }

          if (previousUse) {
            return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "TEAM_ALREADY_USED", message: "You already used that team this season." }) });
          }

          if (existing) existing.teamId = teamId;
          else picks.push({ week, teamId, locked: false });

          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ pick: { team: selectedTeam, submittedAt: new Date().toISOString(), locked: false } })
          });
        }

        return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "NOT_FOUND", message: functionName }) });
      });
    }
  };
}

async function login(page: Page) {
  await page.goto("./");
  await page.getByLabel("Player").selectOption("Mike");
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Week 1" })).toBeVisible();
}

async function openPickPage(page: Page) {
  await page.getByRole("link", { name: "Pick", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Make Pick" })).toBeVisible();
}

async function pickTeam(page: Page, name: string, abbreviation: string) {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByText("Selected team")).toBeVisible();
  await page.getByRole("button", { name: `Submit ${abbreviation}` }).click();
}

test.describe("survivor pick flow simulations", () => {
  test("simulates one user selecting teams across four weeks", async ({ page }) => {
    const harness = createHarness();
    await harness.install(page);
    await login(page);

    const weeklySelections = [
      { week: 1, name: "Arizona Cardinals", abbreviation: "ARI" },
      { week: 2, name: "Atlanta Falcons", abbreviation: "ATL" },
      { week: 3, name: "Baltimore Ravens", abbreviation: "BAL" },
      { week: 4, name: "Buffalo Bills", abbreviation: "BUF" }
    ];

    for (const selection of weeklySelections) {
      harness.setWeek(selection.week);
      await openPickPage(page);
      await expect(page.getByText(`Week ${selection.week}`)).toBeVisible();
      await pickTeam(page, selection.name, selection.abbreviation);
      await expect(page.getByText(new RegExp(`Saved: ${selection.name}`))).toBeVisible();
      await page.getByRole("link", { name: "Dashboard" }).click();
    }

    expect(harness.picks.map((pick) => pick.teamId)).toEqual(["ari", "atl", "bal", "buf"]);
  });

  test("allows a user to change a team before the week is locked", async ({ page }) => {
    const harness = createHarness();
    await harness.install(page);
    await login(page);
    await openPickPage(page);

    await pickTeam(page, "Arizona Cardinals", "ARI");
    await expect(page.getByText(/Saved: Arizona Cardinals/)).toBeVisible();

    await page.getByRole("button", { name: /Atlanta Falcons/ }).click();
    await page.getByRole("button", { name: "Submit ATL" }).click();
    await expect(page.getByText(/Saved: Atlanta Falcons/)).toBeVisible();

    expect(harness.picks).toEqual([{ week: 1, teamId: "atl", locked: false }]);
  });

  test("blocks a user from changing a team after the week is locked", async ({ page }) => {
    const harness = createHarness();
    await harness.install(page);
    await login(page);
    await openPickPage(page);

    await pickTeam(page, "Arizona Cardinals", "ARI");
    harness.lockCurrentWeek();

    await page.reload();
    await expect(page.getByText("ALL PICKS LOCKED")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit ARI" })).toBeDisabled();
  });

  test("blocks a user from selecting a team they used in a past week", async ({ page }) => {
    const harness = createHarness();
    await harness.install(page);
    await login(page);

    await openPickPage(page);
    await pickTeam(page, "Arizona Cardinals", "ARI");

    harness.setWeek(2);
    await page.reload();
    const usedCardinals = page.getByRole("button", { name: /Arizona Cardinals/ });
    await expect(usedCardinals).toBeDisabled();
    await expect(usedCardinals).toContainText("Used previously");
  });
});
