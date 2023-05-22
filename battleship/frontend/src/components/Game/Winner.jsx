import { Form, useRouteLoaderData } from "react-router-dom";
import {
  battleshipGameContractFromAddress,
  getWeb3Instance,
  loadBoardTree,
} from "../../utils";
import { useEth } from "../../contexts/EthContext";

export const action = async ({ request }) => {
  const form = await request.formData();
  const address = form.get("address");
  const contract = battleshipGameContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();
  const opponent = form.get("opponent");
  const tree = await loadBoardTree();

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

  await contract.methods.checkWinnerBoard(board, salts, indexes, proofs).send({
    from: accounts[0],
  });
};

export const Winner = () => {
  const {
    game,
    data: { winner },
  } = useRouteLoaderData("game");
  const {
    state: { accounts },
  } = useEth();

  return winner === accounts[0] ? (
    <Form>
      <input type="hidden" name="address" value={game._address} />
      <button type="submit" className="btn btn-primary">
        Send board for verification
      </button>
    </Form>
  ) : (
    "You have lost!"
  );
};
