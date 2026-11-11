import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WDJoinPanel from "../components/ui/WDJoinPanel";
import * as joinApi from "../utils/api/joinGame";
import { JoinInfo } from "../utils/api/joinGame";

jest.mock("../utils/api/joinGame", () => ({
  ...jest.requireActual("../utils/api/joinGame"),
  fetchJoinInfo: jest.fn(),
  joinGame: jest.fn(),
}));

const mockedFetch = joinApi.fetchJoinInfo as jest.MockedFunction<
  typeof joinApi.fetchJoinInfo
>;
const mockedJoin = joinApi.joinGame as jest.MockedFunction<
  typeof joinApi.joinGame
>;

const baseInfo: JoinInfo = {
  gameID: 5,
  phase: "Pre-game",
  isMember: false,
  canJoin: true,
  canLeave: false,
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
  formTicket: 1234,
};

const renderPanel = (
  props: Partial<React.ComponentProps<typeof WDJoinPanel>> = {},
) =>
  render(
    <WDJoinPanel
      gameID={5}
      gameName="Test game"
      playerTypes="Members"
      notLoggedIn={false}
      legacyBoardLink="../board.php?gameID=5&view=dropDown"
      onJoined={jest.fn()}
      {...props}
    />,
  );

beforeEach(() => {
  mockedFetch.mockReset();
  mockedJoin.mockReset();
});

test("asks a logged-out visitor to sign in and come back to the game", () => {
  renderPanel({ notLoggedIn: true });
  const signIn = screen.getByText("Sign in").closest("a");
  expect(signIn).toHaveAttribute(
    "href",
    "../logon.php?returnTo=game%2F%3FgameID%3D5",
  );
  expect(mockedFetch).not.toHaveBeenCalled();
});

test("shows the bet and joins a pre-game game with the form ticket", async () => {
  mockedFetch.mockResolvedValue(baseInfo);
  mockedJoin.mockResolvedValue("You have joined! Good luck");
  const onJoined = jest.fn();
  renderPanel({ onJoined });

  expect(await screen.findByText("5 points")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Join game"));

  await waitFor(() => expect(onJoined).toHaveBeenCalled());
  expect(mockedJoin).toHaveBeenCalledWith(5, 1234, undefined, undefined);
});

test("needs an invite code for a private game, and shows why a join was refused", async () => {
  mockedFetch
    .mockResolvedValueOnce({ ...baseInfo, private: true })
    .mockResolvedValueOnce({ ...baseInfo, private: true, formTicket: 99 });
  // As axios rejects a 403 from api.php, whose body is the reason
  mockedJoin.mockRejectedValue({
    isAxiosError: true,
    response: {
      status: 403,
      data: "The invite code you supplied is incorrect, please try again.",
    },
  });
  const onJoined = jest.fn();
  renderPanel({ onJoined });

  const joinButton = (await screen.findByText("Join game")).closest("button");
  expect(joinButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Invite code"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByText("Join game"));

  expect(
    await screen.findByText(
      "The invite code you supplied is incorrect, please try again.",
    ),
  ).toBeInTheDocument();
  expect(mockedJoin).toHaveBeenCalledWith(5, 1234, "wrong", undefined);
  // The used-up ticket is replaced for the next try
  await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
  expect(onJoined).not.toHaveBeenCalled();
});

test("offers the countries in civil disorder once the game has started", async () => {
  mockedFetch.mockResolvedValue({
    ...baseInfo,
    phase: "Diplomacy",
    takeover: [
      { countryID: 3, country: "France", bet: 0, affordable: true },
      { countryID: 6, country: "Russia", bet: 0, affordable: true },
    ],
  });
  mockedJoin.mockResolvedValue("ok");
  renderPanel();

  fireEvent.change(await screen.findByRole("combobox"), {
    target: { value: "6" },
  });
  fireEvent.click(screen.getByText("Join game"));
  await waitFor(() =>
    expect(mockedJoin).toHaveBeenCalledWith(5, 1234, undefined, 6),
  );
});

test("says nothing to a spectator when there is no place to take over", async () => {
  mockedFetch.mockResolvedValue({
    ...baseInfo,
    phase: "Diplomacy",
    canJoin: false,
    reason: "No country is in civil disorder",
  });
  const { container } = renderPanel();
  await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

test("explains why a pre-game game can't be joined", async () => {
  mockedFetch.mockResolvedValue({
    ...baseInfo,
    canJoin: false,
    reason: "This game is full.",
  });
  renderPanel();
  expect(await screen.findByText("This game is full.")).toBeInTheDocument();
  expect(screen.queryByText("Join game")).toBeNull();
});
