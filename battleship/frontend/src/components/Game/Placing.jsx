import { useEffect, useState } from "react";
import { Form, useRouteLoaderData } from "react-router-dom";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import {
  BOARD_SIDE_SIZE,
  BOARD_SIZE,
  SHIP_CELLS,
  battleshipGameContractFromAddress,
  createToast,
  getWeb3Instance,
  rnd256,
  saveBoard,
  saveBoardTree,
} from "../../utils";
import "./Placing.css";

export const action = async ({ request }) => {
  const form = await request.formData();

  // This is received as a string
  const board = form
    .get("board")
    .split(",")
    .map((e) => e === "true");
  const address = form.get("address");
  const contract = battleshipGameContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();

  const values = [];
  for (let i = 0; i < board.length; i++) {
    values.push([board[i], rnd256(), i]);
  }

  const tree = StandardMerkleTree.of(values, ["bool", "uint256", "uint8"]);
  try {
    await contract.methods.commitBoard(tree.root).send({ from: accounts[0] });
    await saveBoard(board);
    await saveBoardTree(tree.dump());
  } catch (err) {
    createToast("Error", err.message, "alert-danger");
  }

  return null;
};

export const Placing = () => {
  const { game } = useRouteLoaderData("game");
  const [board, setBoard] = useState([...Array(BOARD_SIZE)]);

  useEffect(() => {
    const initial = [...board].fill(false, 0, BOARD_SIZE);
    setBoard(initial);
  }, []);

  const updateBoard = (pos) => () => {
    const newBoard = [...board];
    newBoard[pos] = !newBoard[pos];
    setBoard(newBoard);
  };

  const range = [...Array(BOARD_SIDE_SIZE).keys()];
  const table = range.map((i) => (
    <tr key={`col-${i}`}>
      {range.map((j) => {
        const pos = i * BOARD_SIDE_SIZE + j;
        return (
          <td key={`row-${j}`} onClick={updateBoard(pos)}>
            <div className={board[pos] ? "selected" : ""}></div>
          </td>
        );
      })}
    </tr>
  ));

  const shipsPlaced = board.filter((e) => e === true).length;
  return (
    <div className="row justify-content-between">
      <div className="col-md-3">
        <div className="alert mb-7" role="alert">
          <h4 className="alert-heading">Ships placing rules:</h4>
          Must place a total of {SHIP_CELLS} ships, arranged in any formation.
        </div>
        <div
          className={`alert mb-7 ${shipsPlaced === SHIP_CELLS ? "alert-success" : "alert-danger"
            }`}
          role="alert"
        >
          <h4 className="alert-heading">Ships placed: {shipsPlaced}</h4>
        </div>
      </div>
      <div className="col-md-8 text-center">
        <table className="mb-10 m-auto">
          <tbody>{table}</tbody>
        </table>
        <Form method="post">
          <input type="hidden" name="address" value={game._address} />
          <input type="hidden" name="board" value={board} />
          <button type="submit" className="btn btn-primary">
            Commit board
          </button>
        </Form>
      </div>
    </div>
  );
};
