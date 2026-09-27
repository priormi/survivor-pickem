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
}

export interface DashboardResponse {
  league: { id: string; name: string; slug: string; timezone: string };
  season: { id: string; year: number; name: string; status: string };
  currentRound: CurrentRound;
  player: SessionPlayer;
  players: DashboardPlayer[];
}

export interface PickOptionsResponse {
  round: Omit<CurrentRound, "locked">;
  teams: Team[];
  currentPick: Team | null;
  locked: boolean;
  disabledReason?: string;
}
