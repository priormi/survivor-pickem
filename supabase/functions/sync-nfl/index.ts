import { apiError, jsonResponse, optionsResponse } from "../_shared/errors.ts";
import { serviceClient } from "../_shared/supabase.ts";

type EspnEvent = {
  id: string;
  date: string;
  competitions?: Array<{
    status?: { type?: { name?: string } };
    competitors?: Array<{
      homeAway: "home" | "away";
      score?: string;
      winner?: boolean;
      team?: { abbreviation?: string };
    }>;
  }>;
};

type EspnCalendarEntry = {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
};

const SEASON_YEAR = 2026;
const REGULAR_SEASON_TYPE = 2;
const WEEK_COUNT = 18;
const TEAM_ABBREVIATION_MAP: Record<string, string> = { WSH: "WAS" };

function authToken(request: Request) {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

function mapTeam(abbreviation?: string) {
  if (!abbreviation) return "";
  return TEAM_ABBREVIATION_MAP[abbreviation] ?? abbreviation;
}

function gameStatus(statusName?: string) {
  if (statusName === "STATUS_FINAL") return "FINAL";
  if (statusName === "STATUS_IN_PROGRESS" || statusName === "STATUS_HALFTIME" || statusName === "STATUS_DELAYED") return "IN_PROGRESS";
  if (statusName === "STATUS_POSTPONED") return "POSTPONED";
  if (statusName === "STATUS_CANCELED") return "CANCELED";
  return "SCHEDULED";
}

function roundStatus(startDate: string, endDate: string, events: EspnEvent[], now = new Date()) {
  const firstKickoff = events
    .map((event) => new Date(event.date).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  if (events.length && events.every((event) => gameStatus(event.competitions?.[0]?.status?.type?.name) === "FINAL")) return "FINAL";
  if (Number.isFinite(firstKickoff) && now.getTime() >= firstKickoff) return "LOCKED";
  if (now.getTime() >= start && now.getTime() <= end) return "OPEN";
  return "UPCOMING";
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ESPN returned ${response.status} for ${url}`);
  return await response.json();
}

async function fetchWeek(week: number) {
  const params = new URLSearchParams({
    dates: String(SEASON_YEAR),
    seasontype: String(REGULAR_SEASON_TYPE),
    week: String(week)
  });
  return await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?${params}`);
}

function regularSeasonEntries(data: any): EspnCalendarEntry[] {
  return data.leagues?.[0]?.calendar?.find((item: any) => String(item.value) === String(REGULAR_SEASON_TYPE))?.entries ?? [];
}

async function weeksToSync(body: Record<string, unknown>, now = new Date()) {
  const requestedWeeks = Array.isArray(body.weeks)
    ? body.weeks.map((week) => Number(week)).filter((week) => Number.isInteger(week) && week >= 1 && week <= WEEK_COUNT)
    : [];

  if (requestedWeeks.length) return [...new Set(requestedWeeks)];
  if (body.mode !== "current") return Array.from({ length: WEEK_COUNT }, (_, index) => index + 1);

  const weekOneData = await fetchWeek(1);
  const entries = regularSeasonEntries(weekOneData);
  const currentEntry = entries.find((entry) => {
    const start = new Date(entry.startDate).getTime();
    const end = new Date(entry.endDate).getTime();
    return now.getTime() >= start && now.getTime() <= end;
  });

  if (currentEntry) return [Number(currentEntry.value)];

  const nextEntry = entries.find((entry) => new Date(entry.endDate).getTime() > now.getTime());
  return [Number(nextEntry?.value ?? 1)];
}

async function runSync(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const supabase = serviceClient();
  const now = new Date();
  const weeks = await weeksToSync(body, now);

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("slug", "prior-family")
    .single();
  if (leagueError) return apiError("LEAGUE_LOOKUP_FAILED", leagueError.message, 500);

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .upsert({ league_id: league.id, year: SEASON_YEAR, name: `${SEASON_YEAR} NFL Survivor`, status: "ACTIVE" }, { onConflict: "league_id,year" })
    .select("id")
    .single();
  if (seasonError) return apiError("SEASON_UPSERT_FAILED", seasonError.message, 500);

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .eq("active", true);
  if (teamsError) return apiError("TEAMS_LOOKUP_FAILED", teamsError.message, 500);

  const teamByAbbreviation = new Map((teams ?? []).map((team: any) => [team.abbreviation, team.id]));
  let currentRoundId: string | null = null;
  let syncedGames = 0;
  let syncedRounds = 0;

  for (const week of weeks) {
    const data = await fetchWeek(week);
    const entries = regularSeasonEntries(data);
    const calendarEntry = entries.find((entry) => Number(entry.value) === week) ?? {
      label: `Week ${week}`,
      value: String(week),
      startDate: data.events?.[0]?.date,
      endDate: data.events?.[data.events.length - 1]?.date
    };
    const events = (data.events ?? []) as EspnEvent[];
    if (!calendarEntry.startDate || !calendarEntry.endDate) throw new Error(`Missing calendar window for Week ${week}.`);

    const earliestKickoff = events
      .map((event) => new Date(event.date).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    const deadlineAt = new Date(earliestKickoff || new Date(calendarEntry.startDate).getTime()).toISOString();
    const status = roundStatus(calendarEntry.startDate, calendarEntry.endDate, events, now);

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .upsert({
        season_id: season.id,
        sequence_number: week,
        round_code: `WEEK_${week}`,
        round_type: "REGULAR",
        display_name: `Week ${week}`,
        deadline_at: deadlineAt,
        status
      }, { onConflict: "season_id,round_code" })
      .select("id")
      .single();
    if (roundError) return apiError("ROUND_UPSERT_FAILED", `Week ${week}: ${roundError.message}`, 500);
    syncedRounds += 1;

    const entryStart = new Date(calendarEntry.startDate).getTime();
    const entryEnd = new Date(calendarEntry.endDate).getTime();
    if (!currentRoundId && now.getTime() >= entryStart && now.getTime() <= entryEnd) currentRoundId = round.id;
    if (!currentRoundId && status === "OPEN") currentRoundId = round.id;

    for (const event of events) {
      const competition = event.competitions?.[0];
      const home = competition?.competitors?.find((competitor) => competitor.homeAway === "home");
      const away = competition?.competitors?.find((competitor) => competitor.homeAway === "away");
      const homeTeamId = teamByAbbreviation.get(mapTeam(home?.team?.abbreviation));
      const awayTeamId = teamByAbbreviation.get(mapTeam(away?.team?.abbreviation));

      if (!homeTeamId || !awayTeamId) {
        return apiError("TEAM_MAPPING_FAILED", `Week ${week}: could not map ${away?.team?.abbreviation ?? "away"} at ${home?.team?.abbreviation ?? "home"}.`, 500);
      }

      const homeScore = home?.score === undefined ? null : Number(home.score);
      const awayScore = away?.score === undefined ? null : Number(away.score);
      const winnerTeamId = home?.winner ? homeTeamId : away?.winner ? awayTeamId : null;
      const isTie = gameStatus(competition?.status?.type?.name) === "FINAL" && homeScore === awayScore;

      const { error: gameError } = await supabase.from("games").upsert({
        season_id: season.id,
        round_id: round.id,
        external_game_id: event.id,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: event.date,
        status: gameStatus(competition?.status?.type?.name),
        home_score: Number.isFinite(homeScore) ? homeScore : null,
        away_score: Number.isFinite(awayScore) ? awayScore : null,
        winner_team_id: winnerTeamId,
        is_tie: isTie,
        last_synced_at: now.toISOString()
      }, { onConflict: "season_id,external_game_id" });
      if (gameError) return apiError("GAME_UPSERT_FAILED", `Week ${week} game ${event.id}: ${gameError.message}`, 500);
      syncedGames += 1;
    }
  }

  if (!currentRoundId) {
    const { data: nextRound, error: nextRoundError } = await supabase
      .from("rounds")
      .select("id")
      .eq("season_id", season.id)
      .in("status", ["OPEN", "UPCOMING"])
      .order("sequence_number", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextRoundError) return apiError("CURRENT_ROUND_LOOKUP_FAILED", nextRoundError.message, 500);
    currentRoundId = nextRound?.id ?? null;
  }

  if (currentRoundId) {
    const { error: currentRoundError } = await supabase
      .from("seasons")
      .update({ current_round_id: currentRoundId, updated_at: now.toISOString() })
      .eq("id", season.id);
    if (currentRoundError) return apiError("CURRENT_ROUND_UPDATE_FAILED", currentRoundError.message, 500);
  }

  return jsonResponse({ seasonYear: SEASON_YEAR, weeks, syncedRounds, syncedGames, currentRoundId });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "Use POST.", 405);

  const syncSecret = Deno.env.get("SYNC_SECRET");
  if (syncSecret && authToken(request) !== syncSecret) return apiError("UNAUTHORIZED", "Invalid sync token.", 401);

  try {
    return await runSync(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return apiError("SYNC_FAILED", message, 500);
  }
});
