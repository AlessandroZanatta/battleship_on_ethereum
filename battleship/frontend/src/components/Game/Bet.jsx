import { useEffect } from "react";
import { Form, useNavigate, useRouteLoaderData } from "react-router-dom";

import { useEth } from "../../contexts/EthContext";
import {
  battleshipGameContractFromAddress,
  createToast,
  getWeb3Instance,
} from "../../utils";

export const action = async ({ request }) => {
  const form = await request.formData();
  const intent = form.get("intent");
  const address = form.get("address");
  const contract = battleshipGameContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();
  try {
    switch (intent) {
      case "acceptBet":
        await contract.methods
          .acceptBet(form.get("betAmount"))
          .send({ from: accounts[0] });
        break;
      case "proposeBet":
        await contract.methods
          .proposeBet(form.get("betAmount"))
          .send({ from: accounts[0] });
        break;
      default:
        break;
    }
  } catch (err) {
    createToast("Error", err.message, "alert-danger");
  }
  return null;
};

export const Bet = () => {
  const {
    state: { accounts },
  } = useEth();
  const {
    game,
    data: { playerOne, playerTwo, playerOneBet, playerTwoBet },
  } = useRouteLoaderData("game");
  const navigate = useNavigate();

  const opponent = playerOne === accounts[0] ? playerTwo : playerOne;
  const opponentBet = playerOne === accounts[0] ? playerTwoBet : playerOneBet;
  const yourBet = playerOne === accounts[0] ? playerOneBet : playerTwoBet;

  useEffect(() => {
    // Listen for bet proposal events from the opponent
    // We could update the state in a better way, but navigating
    // to the same page is much more simple
    (async () => {
      game.events
        .BetProposal({ filter: { player: opponent } })
        .on("data", () => {
          navigate(`/game/${game._address}/bet`);
        });
    })();
  });

  return (
    <>
      <div className="alert mb-10" role="alert">
        <h4 className="alert-heading">
          Bet proposed by opponent: {opponentBet} wei
        </h4>
        <Form method="post">
          <input type="hidden" name="address" value={game._address} />
          <input type="hidden" name="intent" value="acceptBet" />
          <input type="hidden" name="betAmount" value={opponentBet} />
          <button className="btn btn-primary">Accept opponent proposal</button>
        </Form>
      </div>
      <div className="alert" role="alert">
        <h4 className="alert-heading">Your bet: {yourBet} wei</h4>
        <Form method="post" className="form-inline">
          <input type="hidden" name="address" value={game._address} />
          <input type="hidden" name="intent" value="proposeBet" />
          <input
            placeholder="Insert your new bet"
            type="number"
            className="form-control"
            name="betAmount"
          />
          <button type="submit" className="btn btn-primary">
            Propose new bet (in wei)
          </button>
        </Form>
      </div>
    </>
  );
};
