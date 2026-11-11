import * as React from "react";
import { Button, Stack } from "@mui/material";
import {
  apiErrorMessage,
  fetchJoinInfo,
  JoinInfo,
  leaveGame,
} from "../../utils/api/joinGame";

interface WDLeaveGameButtonProps {
  gameID: number;
  /** Called after leaving; by default goes to the home page, as board.php's leave form does */
  onLeft?: () => void;
}

/**
 * board.php's "Leave game" form (gamepanel/game.php joinBar()) for a player in a game which hasn't started: their
 * bet is returned. game/joininfo says whether they can leave yet, and why not, and gives the form ticket.
 */
const WDLeaveGameButton: React.FC<WDLeaveGameButtonProps> = function ({
  gameID,
  onLeft,
}): React.ReactElement | null {
  const [info, setInfo] = React.useState<JoinInfo | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [leaving, setLeaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setInfo(await fetchJoinInfo(gameID));
    } catch (e) {
      setInfo(null);
    }
  }, [gameID]);

  React.useEffect(() => {
    if (gameID > 0) load();
  }, [gameID, load]);

  if (!info || !info.isMember) return null;

  if (!info.canLeave) {
    return info.reason ? (
      <div className="m-2 text-sm">{info.reason}</div>
    ) : null;
  }

  const leave = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm("Are you sure you want to leave this game?")) return;
    setLeaving(true);
    setError(null);
    try {
      await leaveGame(gameID, info.formTicket);
      if (onLeft) onLeft();
    } catch (e) {
      setError(apiErrorMessage(e));
      // The ticket was used up; get another for the next try
      await load();
      setLeaving(false);
    }
  };

  return (
    <Stack direction="column" alignItems="center" className="m-2">
      <Button
        variant="outlined"
        color="error"
        size="small"
        onClick={leave}
        disabled={leaving}
      >
        Leave game
      </Button>
      {error && (
        <div className="text-sm text-red-700 mt-1" role="alert">
          {error}
        </div>
      )}
    </Stack>
  );
};

WDLeaveGameButton.defaultProps = {
  onLeft: () => {
    window.location.href = "../index.php";
  },
};

export default WDLeaveGameButton;
