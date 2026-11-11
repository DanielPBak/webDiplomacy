/**
 * Joining a game the viewer isn't in, through the same API routes a bot uses: game/joininfo says whether they can
 * and gives the form ticket that game/join checks, as board.php's join form (gamepanel/game.php joinBar()) does.
 */
import axios from "axios";
import ApiRoute from "../../enums/ApiRoute";

export interface TakeoverOption {
  countryID: number;
  country: string;
  bet: number;
  affordable: boolean;
}

export interface JoinInfo {
  gameID: number;
  phase: string;
  isMember: boolean;
  canJoin: boolean;
  canLeave: boolean;
  /** Why they can't join, for showing to them; null if they can */
  reason: string | null;
  private: boolean;
  minimumBet: number | null;
  userPoints: number;
  minimumReliabilityRating: number;
  userReliabilityRating: number;
  isLiveGame: boolean;
  countryCount: number;
  memberCount: number;
  /** The countries in civil disorder, once the game has started */
  takeover: TakeoverOption[];
  /** Used up by one game/join, whether or not it succeeds */
  formTicket: number | null;
}

const apiURL = (route: ApiRoute) => `../api.php?route=${route}`;

/**
 * The text of a failed request: the API answers a refused join with a message meant for the user, e.g. a wrong
 * invite code or too few points.
 */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string" && data.trim()) return data.trim();
    if (data && typeof data === "object" && "msg" in data)
      return String((data as { msg: unknown }).msg);
  }
  return "Couldn't reach the server, please try again.";
}

export async function fetchJoinInfo(gameID: number): Promise<JoinInfo> {
  const { data } = await axios.get(
    `${apiURL(ApiRoute.GAME_JOIN_INFO)}&gameID=${gameID}`,
    { timeout: 30000 },
  );
  return data.data as JoinInfo;
}

/**
 * Sent as a form, as the route reads $_POST like board.php's form. Rejects with the reason if they can't join.
 */
export async function joinGame(
  gameID: number,
  formTicket: number | null,
  gamepass?: string,
  countryID?: number,
): Promise<string> {
  const form = new URLSearchParams();
  form.set("gameID", String(gameID));
  if (formTicket !== null) form.set("formTicket", String(formTicket));
  if (gamepass) form.set("gamepass", gamepass);
  if (countryID) form.set("countryID", String(countryID));
  const { data } = await axios.post(apiURL(ApiRoute.GAME_JOIN), form, {
    timeout: 30000,
  });
  return data.msg as string;
}
