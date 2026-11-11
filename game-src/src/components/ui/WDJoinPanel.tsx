import * as React from "react";
import { Button, Stack, TextField } from "@mui/material";
import {
  apiErrorMessage,
  fetchJoinInfo,
  JoinInfo,
  joinGame,
} from "../../utils/api/joinGame";
import sendGameAnalyticsEvent from "../../utils/analytics";

// Above the board's buttons, as WDGameProgressOverlay is
const Z_INDEX = 4;

const cardStyle: React.CSSProperties = {
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  backgroundColor: "white",
  padding: "16px",
  borderRadius: "5px",
  zIndex: Z_INDEX,
  width: "min(360px, calc(100% - 32px))",
};

const overlayStyle: React.CSSProperties = {
  left: 0,
  top: 0,
  height: "100%",
  width: "100%",
  backgroundColor: "rgba(52,52,52,0.6)",
  zIndex: Z_INDEX,
};

const reopenStyle: React.CSSProperties = {
  bottom: "16px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: Z_INDEX,
};

interface WDJoinPanelProps {
  gameID: number;
  gameName: string;
  playerTypes: string;
  /** The viewer isn't logged in: ask them to sign in, then come back to this game */
  notLoggedIn: boolean;
  /** The game in the classic board, which has its own join form */
  legacyBoardLink: string;
  /** Called after a successful join; by default the page reloads onto the player's board */
  onJoined?: () => void;
}

/**
 * Shown to someone viewing a game they aren't in: what board.php's join form (gamepanel/game.php joinBar()) shows,
 * the bet, an invite code for a private game and a choice of country in civil disorder to take over, joining
 * through game/join. A logged-out visitor is asked to sign in instead.
 */
const WDJoinPanel: React.FC<WDJoinPanelProps> = function ({
  gameID,
  gameName,
  playerTypes,
  notLoggedIn,
  legacyBoardLink,
  onJoined,
}): React.ReactElement | null {
  const [info, setInfo] = React.useState<JoinInfo | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [gamepass, setGamepass] = React.useState("");
  const [countryID, setCountryID] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [joining, setJoining] = React.useState(false);
  const [joined, setJoined] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const newInfo = await fetchJoinInfo(gameID);
      setInfo(newInfo);
      setLoadFailed(false);
      setCountryID((current) => {
        const affordable = newInfo.takeover.filter((t) => t.affordable);
        if (current && affordable.some((t) => t.countryID === current))
          return current;
        return affordable.length ? affordable[0].countryID : null;
      });
    } catch (e) {
      setLoadFailed(true);
    }
  }, [gameID]);

  React.useEffect(() => {
    if (!notLoggedIn && gameID > 0) load();
  }, [notLoggedIn, gameID, load]);

  if (notLoggedIn) {
    // logon.php only goes back to a page of this site, given relative to it
    const returnTo = encodeURIComponent(`game/?gameID=${gameID}`);
    return (
      <>
        <div className="absolute" style={overlayStyle} />
        <div className="absolute" style={cardStyle} data-testid="join-panel">
          <Stack direction="column" alignItems="center" spacing={1.5}>
            <div className="font-bold">Sign in to join this game</div>
            <div className="text-sm text-center">
              You need a webDiplomacy account to play or follow a game.
            </div>
            <Button
              variant="contained"
              color="success"
              href={`../logon.php?returnTo=${returnTo}`}
            >
              Sign in
            </Button>
            <a href="../register.php" className="text-blue-500 text-sm">
              New here? Register an account
            </a>
          </Stack>
        </div>
      </>
    );
  }

  // Nothing to say to a spectator of a game which has started and has no place in it to take over
  if (!info) {
    return null;
  }
  const isPregame = info.phase === "Pre-game";
  if (
    info.isMember ||
    info.phase === "Finished" ||
    (!isPregame && !info.canJoin && info.takeover.length === 0)
  ) {
    return null;
  }

  if (hidden) {
    return (
      <div className="absolute" style={reopenStyle}>
        <Button
          variant="contained"
          color="success"
          onClick={() => setHidden(false)}
        >
          Join this game
        </Button>
      </div>
    );
  }

  const takeover = info.takeover.find((t) => t.countryID === countryID);
  const canSubmit =
    info.canJoin &&
    !joining &&
    !joined &&
    (isPregame || !!takeover) &&
    (!info.private || gamepass.length > 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setJoining(true);
    setError(null);
    try {
      await joinGame(
        gameID,
        info.formTicket,
        info.private ? gamepass : undefined,
        isPregame ? undefined : countryID || undefined,
      );
      setJoined(true);
      sendGameAnalyticsEvent("join_game", playerTypes);
      // A fresh load gives the board the player's context: their country, orders, messages and SSE channel
      if (onJoined) onJoined();
    } catch (e) {
      setError(apiErrorMessage(e));
      // The ticket was used up; get another for the next try
      await load();
    } finally {
      setJoining(false);
    }
  };

  const startNote = info.isLiveGame
    ? `The game will start at the scheduled time even if not all ${info.countryCount} players have joined.`
    : `The game will start when all ${info.countryCount} players have joined.`;

  return (
    <>
      <div className="absolute" style={overlayStyle} />
      <form
        className="absolute"
        style={cardStyle}
        onSubmit={submit}
        data-testid="join-panel"
      >
        <Stack direction="column" spacing={1.5}>
          <div className="font-bold">Join {gameName}</div>

          {isPregame && (
            <div className="text-sm">
              {info.memberCount} of {info.countryCount} players have joined.{" "}
              {startNote}
            </div>
          )}

          {isPregame && info.minimumBet !== null && (
            <div className="text-sm">
              Bet to join: <b>{info.minimumBet} points</b> (you have{" "}
              {info.userPoints})
            </div>
          )}

          {!isPregame && info.takeover.length > 0 && (
            <label className="text-sm" htmlFor="join-country">
              Take over a country in civil disorder:
              <select
                id="join-country"
                className="block w-full mt-1"
                value={countryID ?? ""}
                onChange={(e) => setCountryID(Number(e.target.value))}
                disabled={!info.canJoin}
              >
                {info.takeover.map((t) => (
                  <option
                    key={t.countryID}
                    value={t.countryID}
                    disabled={!t.affordable}
                  >
                    {t.country}
                    {t.bet > 0 ? `, for ${t.bet} points` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {info.minimumReliabilityRating > 0 && (
            <div className="text-sm">
              Required reliability: {info.minimumReliabilityRating}% (yours is{" "}
              {info.userReliabilityRating}%)
            </div>
          )}

          {info.canJoin && info.private && (
            <TextField
              label="Invite code"
              type="password"
              size="small"
              value={gamepass}
              onChange={(e) => setGamepass(e.target.value)}
              autoComplete="off"
            />
          )}

          {(error || info.reason) && (
            <div className="text-sm text-red-700" role="alert">
              {error || info.reason}
            </div>
          )}
          {loadFailed && (
            <div className="text-sm text-red-700" role="alert">
              Couldn&apos;t check whether you can join; reload to try again.
            </div>
          )}

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="text" onClick={() => setHidden(true)}>
              Just watch
            </Button>
            {info.canJoin && (
              <Button
                type="submit"
                variant="contained"
                color="success"
                disabled={!canSubmit}
              >
                {joined ? "Joined!" : "Join game"}
              </Button>
            )}
          </Stack>

          <a href={legacyBoardLink} className="text-blue-500 text-xs">
            Open in the classic board
          </a>
        </Stack>
      </form>
    </>
  );
};

WDJoinPanel.defaultProps = {
  onJoined: () => window.location.reload(),
};

export default WDJoinPanel;
