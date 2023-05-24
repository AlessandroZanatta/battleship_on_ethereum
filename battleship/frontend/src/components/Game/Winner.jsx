import { Form, useNavigate, useRouteLoaderData } from "react-router-dom";
import {
  battleshipGameContractFromAddress,
  createToast,
  getWeb3Instance,
  loadBoardTree,
} from "../../utils";
import { useEth } from "../../contexts/EthContext";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { useEffect, useState } from "react";

export const action = async ({ request }) => {
  const form = await request.formData();
  const address = form.get("address");
  const contract = battleshipGameContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();
  const opponent = form.get("opponent");
  const tree = StandardMerkleTree.load(await loadBoardTree(), [
    "bool",
    "uint256",
    "uint8",
  ]);

  try {
    // Get array of shots already taken
    const shotsTaken = await contract.methods.getShotsTaken(opponent).call();

    // For each index in board, get value and proof if not already in shots verified
    const values = [];
    const proofs = [];
    for (const [i, v] of tree.entries()) {
      if (!shotsTaken.find((e) => parseInt(e.index) === i)) {
        values.push(v);
        proofs.push(tree.getProof(i));
      }
    }

    const board = [];
    const salts = [];
    const indexes = [];
    values.forEach((e) => {
      board.push(e[0]);
      salts.push(e[1]);
      indexes.push(e[2]);
    });

    await contract.methods
      .checkWinnerBoard(board, salts, indexes, proofs)
      .send({
        from: accounts[0],
      });
  } catch (err) {
    createToast("Error", err.message, "alert-danger");
  }
  return null;
};

export const Winner = () => {
  const {
    game,
    data: { winner, playerOne, playerTwo },
  } = useRouteLoaderData("game");
  const {
    state: { accounts },
  } = useEth();
  const navigate = useNavigate();
  const [loserMsg, setLoserMsg] = useState(
    "You have lost the game. Waiting for the opponent to reveal its board for verification..."
  );

  useEffect(() => {
    (async () => {
      game.events.WinnerVerified().on("data", (e) => {
        const finalWinner = e.returnValues.player;

        if (finalWinner !== winner) {
          // Winner found cheating!
          if (winner === accounts[0]) {
            setLoserMsg("Cheater detected! Opponent wins by default!");
          } else {
            navigate(`/game/${game._address}/withdraw`);
          }
        } else {
          if (winner === accounts[0]) {
            navigate(`/game/${game._address}/withdraw`);
          } else {
            setLoserMsg("Opponent board has been verified. You have lost.");
          }
        }
      });
    })();
  }, []);

  const opponent = playerOne === accounts[0] ? playerTwo : playerOne;
  return winner === accounts[0] ? (
    <Form method="post">
      <input type="hidden" name="address" value={game._address} />
      <input type="hidden" name="opponent" value={opponent} />
      <button type="submit" className="btn btn-primary">
        Send board for verification
      </button>
    </Form>
  ) : (
    loserMsg
  );
};
