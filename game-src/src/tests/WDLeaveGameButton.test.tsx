import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WDLeaveGameButton from "../components/ui/WDLeaveGameButton";
import * as joinApi from "../utils/api/joinGame";
import { JoinInfo } from "../utils/api/joinGame";

jest.mock("../utils/api/joinGame", () => ({
  ...jest.requireActual("../utils/api/joinGame"),
  fetchJoinInfo: jest.fn(),
  leaveGame: jest.fn(),
}));

const mockedFetch = joinApi.fetchJoinInfo as jest.MockedFunction<
  typeof joinApi.fetchJoinInfo
>;
const mockedLeave = joinApi.leaveGame as jest.MockedFunction<
  typeof joinApi.leaveGame
>;

const memberInfo: JoinInfo = {
  gameID: 5,
  phase: "Pre-game",
  isMember: true,
  canJoin: false,
  canLeave: true,
  reason: null,
  private: false,
  minimumBet: 5,
  userPoints: 100,
  minimumReliabilityRating: 0,
  userReliabilityRating: 100,
  isLiveGame: false,
  countryCount: 7,
  memberCount: 3,
  takeover: [],
  formTicket: 42,
};

beforeEach(() => {
  mockedFetch.mockReset();
  mockedLeave.mockReset();
  jest.spyOn(window, "confirm").mockReturnValue(true);
});

test("leaves the game with the form ticket once confirmed", async () => {
  mockedFetch.mockResolvedValue(memberInfo);
  mockedLeave.mockResolvedValue("You've left");
  const onLeft = jest.fn();
  render(<WDLeaveGameButton gameID={5} onLeft={onLeft} />);

  fireEvent.click(await screen.findByText("Leave game"));
  await waitFor(() => expect(onLeft).toHaveBeenCalled());
  expect(mockedLeave).toHaveBeenCalledWith(5, 42);
});

test("does nothing if the player doesn't confirm", async () => {
  mockedFetch.mockResolvedValue(memberInfo);
  (window.confirm as jest.Mock).mockReturnValue(false);
  render(<WDLeaveGameButton gameID={5} onLeft={jest.fn()} />);

  fireEvent.click(await screen.findByText("Leave game"));
  expect(mockedLeave).not.toHaveBeenCalled();
});

test("shows why the server refused, and gets a new ticket", async () => {
  mockedFetch.mockResolvedValue(memberInfo);
  mockedLeave.mockRejectedValue({
    isAxiosError: true,
    response: { status: 400, data: "Can't leave game; game starting soon." },
  });
  const onLeft = jest.fn();
  render(<WDLeaveGameButton gameID={5} onLeft={onLeft} />);

  fireEvent.click(await screen.findByText("Leave game"));
  expect(
    await screen.findByText("Can't leave game; game starting soon."),
  ).toBeInTheDocument();
  await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
  expect(onLeft).not.toHaveBeenCalled();
});

test("explains why a player can't leave, with no button", async () => {
  mockedFetch.mockResolvedValue({
    ...memberInfo,
    canLeave: false,
    reason: "Can't leave game; game starting soon.",
  });
  render(<WDLeaveGameButton gameID={5} onLeft={jest.fn()} />);

  expect(
    await screen.findByText("Can't leave game; game starting soon."),
  ).toBeInTheDocument();
  expect(screen.queryByText("Leave game")).toBeNull();
});
