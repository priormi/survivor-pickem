export type PlayerStatus = "ACTIVE" | "ELIMINATED" | "CHAMPION";
export type PickResult = "PENDING" | "WIN" | "LOSS" | "TIE" | "NO_PICK" | "SURVIVED_ALL_LOST" | "VOID";

export interface SeasonPlayer {
  id: string;
  displayName: string;
  strikeCount: number;
  status: PlayerStatus;
}

export interface RoundPickInput {
  seasonPlayerId: string;
  result: "WIN" | "LOSS" | "TIE" | "NO_PICK";
}

export interface RoundPlayerResult {
  seasonPlayerId: string;
  result: PickResult;
  strikeDelta: number;
  strikeWaived: boolean;
  explanation?: string;
}

export interface ProcessRoundOutput {
  players: SeasonPlayer[];
  results: RoundPlayerResult[];
  events: Array<{ type: string; message: string }>;
}

export interface Team {
  id: string;
  abbreviation: string;
  city: string;
  name: string;
  conference?: string;
  division?: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface SessionPlayer {
  id: string;
  displayName: string;
  isAdmin: boolean;
}

export interface CurrentRound {
  id: string;
  displayName: string;
  deadlineAt: string;
  status: string;
  locked: boolean;
  allPicksSubmitted: boolean;
  submittedPickCount: number;
  expectedPickCount: number;
}

export interface DashboardPickHistoryItem {
  id: string;
  roundId: string;
  roundName: string;
  roundSequence: number;
  result: PickResult;
  submittedAt: string;
  team: Team | null;
  visible: boolean;
}

export interface DashboardPlayer {
  id: string;
  playerId: string;
  displayName: string;
  strikeCount: number;
  status: PlayerStatus;
  pickSubmitted: boolean;
  pickVisible: boolean;
  pickTeam: Team | null;
  pickHistory: DashboardPickHistoryItem[];
}

export interface DashboardResponse {
  league: { id: string; name: string; slug: string; timezone: string };
  season: { id: string; year: number; name: string; status: string };
  currentRound: CurrentRound;
  player: SessionPlayer;
  players: DashboardPlayer[];
}

export interface PickOptionsRound {
  id: string;
  displayName: string;
  deadlineAt: string;
  status: string;
}

export interface MatchupTeam extends Team {
  used: boolean;
  available: boolean;
}

export interface PickMatchup {
  id: string;
  kickoffAt: string;
  status: string;
  homeTeam: MatchupTeam;
  awayTeam: MatchupTeam;
}

export interface PickOptionsResponse {
  round: PickOptionsRound;
  teams: Team[];
  matchups: PickMatchup[];
  currentPick: Team | null;
  locked: boolean;
  disabledReason?: string;
}
