import { useEffect } from "react";
import {
  Form,
  Outlet,
  redirect,
  useLoaderData,
  useNavigate,
} from "react-router-dom";

import { useEth } from "../contexts/EthContext";
import {
  battleshipGameContractFromAddress,
  createToast,
  getWeb3Instance,
  phaseToString,
} from "../utils";

export const loader = async ({ params }) => {
  try {
    const game = battleshipGameContractFromAddress(params.address);
    const playerOne = await game.methods.playerOne().call();
    const playerTwo = await game.methods.playerTwo().call();
    const data = {
      playerOne,
      playerTwo,
      currentPhase: await game.methods.currentPhase().call(),
      bet: await game.methods.agreedBetAmount().call(),
      agreedBetAmount: await game.methods.agreedBetAmount().call(),
      playerOneBet: await game.methods.proposedBets(playerOne).call(),
      playerTwoBet: await game.methods.proposedBets(playerTwo).call(),
      playerTurn: await game.methods.playerTurn().call(),
      winner: await game.methods.winner().call(),
      AFKPlayer: await game.methods.AFKPlayer().call(),
    };
    return { game, data };
  } catch (err) {
    return redirect("/menu");
  }
};

export const action = async ({ request }) => {
  const form = await request.formData();
  const intent = form.get("intent");
  const address = form.get("address");
  const contract = battleshipGameContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();
  try {
    switch (intent) {
      case "report":
        await contract.methods.reportOpponentAFK().send({ from: accounts[0] });
        break;
      case "validate":
        await contract.methods.verifyOpponentAFK().send({ from: accounts[0] });
        break;
      default:
        break;
    }
  } catch (err) {
    createToast("Error", err.message, "alert-danger");
  }
  return null;
};

export const Game = () => {
  const {
    game,
    data: {
      playerOne,
      playerTwo,
      currentPhase,
      bet,
      playerTurn,
      AFKPlayer,
      winner,
    },
  } = useLoaderData();
  const {
    state: { accounts },
  } = useEth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      game.events
        .BetAgreed()
        .on("data", () => navigate(`/game/${game._address}/funds`));
    })();

    (async () => {
      game.events
        .FundsDeposited()
        .on("data", () => navigate(`/game/${game._address}/placing`));
    })();

    (async () => {
      game.events
        .BoardsCommitted()
        .on("data", () => navigate(`/game/${game._address}/play`));
    })();

    (async () => {
      game.events
        .Winner()
        .on("data", () => navigate(`/game/${game._address}/winner`));
    })();

    (async () => {
      game.events.AFKWarning().on("data", (e) => {
        e.returnValues.player !== accounts[0]
          ? createToast("Opponent reported as AFK", "", "alert-success")
          : createToast(
            "You have been flagged as AFK",
            "Take an action before 5 blocks are mined or you will lose by default",
            "alert-danger"
          );
      });
    })();
  }, []);

  return (
    <>
      <h1 className="card-title">Game {game._address}</h1>
      <div>Opponent: {playerOne === accounts[0] ? playerTwo : playerOne}</div>
      <div>Phase: {phaseToString(currentPhase)}</div>
      {bet !== "0" && <div>{"Bet: " + bet + " wei"}</div>}
      {playerTurn !== "0x0000000000000000000000000000000000000000" && (
        <div>{"Turn: " + playerTurn}</div>
      )}
      {winner !== "0x0000000000000000000000000000000000000000" && (
        <div>{"Winner: " + winner}</div>
      )}

      <Form method="post" className="mb-5">
        <input type="hidden" name="intent" value="report" />
        <input type="hidden" name="address" value={game._address} />
        <button type="submit" className="btn btn-danger">
          Report opponent as AFK
        </button>
      </Form>
      {AFKPlayer !== "0x0000000000000000000000000000000000000000" &&
        AFKPlayer !== accounts[0] && (
          <Form method="post">
            <input type="hidden" name="intent" value="validate" />
            <input type="hidden" name="address" value={game._address} />
            <button type="submit" className="btn btn-success">
              Validate AFK report
            </button>
          </Form>
        )}
      <hr />
      <Outlet />
    </>
  );
};
