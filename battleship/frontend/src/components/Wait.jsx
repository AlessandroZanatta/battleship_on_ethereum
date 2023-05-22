import { useEffect } from "react";
import {
  Navigate,
  redirect,
  useLoaderData,
  useNavigate,
} from "react-router-dom";
import { useEth } from "../contexts/EthContext";

import { battleshipGameContractFromAddress } from "../utils";

export const loader = ({ params }) => {
  try {
    const game = battleshipGameContractFromAddress(params.address);
    return { game };
  } catch {
    return redirect("/menu");
  }
};

export const Wait = () => {
  const {
    state: { contract },
  } = useEth();
  const { game } = useLoaderData();
  const navigate = useNavigate();

  useEffect(() => {
    // Setup listener for game
    // Game created by this account has been joined
    contract.events
      .JoinGame({ filter: { game: game._address } })
      .on("data", () => navigate(`/game/${game._address}/bet`));
  });

  const content =
    game !== null ? (
      <>
        <h1 className="card-title">Waiting for player</h1>
        Want to invite someone to play? Here is the game ID: {game._address}
      </>
    ) : (
      <Navigate to="/menu" />
    );
  return content;
};
