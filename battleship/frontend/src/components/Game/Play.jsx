import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { useEffect } from "react";
import {
  Form,
  redirect,
  useLoaderData,
  useRevalidator,
  useRouteLoaderData,
} from "react-router-dom";
import { useEth } from "../../contexts/EthContext";
import {
  battleshipGameContractFromAddress,
  BOARD_SIDE_SIZE,
  createToast,
  getWeb3Instance,
  loadBoard,
  loadBoardTree,
  ShotType,
} from "../../utils";

export const loader = async ({ params }) => {
  try {
    const board = await loadBoard();
    const game = battleshipGameContractFromAddress(params.address);
    const playerOne = await game.methods.playerOne().call();
    const playerTwo = await game.methods.playerTwo().call();
    const playerOneShots = await game.methods.getShotsTaken(playerOne).call();
    const playerTwoShots = await game.methods.getShotsTaken(playerTwo).call();
    return { board, data: { playerOneShots, playerTwoShots } };
  } catch (err) {
    return redirect("/menu");
  }
};

export const action = async ({ request }) => {
  const form = await request.formData();
  const address = form.get("address");
  const intent = form.get("intent");
  const contract = battleshipGameContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();
  const pos = parseInt(form.get("pos"));
  try {
    switch (intent) {
      case "attack":
        await contract.methods.attack(pos).send({ from: accounts[0] });
        break;

      case "checkAndAttack":
        const tree = StandardMerkleTree.load(await loadBoardTree());
        const checkPos = parseInt(form.get("checkPos"));
        const value = tree.values.find((v) => v.value[2] === checkPos).value;
        const proof = tree.getProof(checkPos);
        await contract.methods
          .checkAndAttack(value[0], value[1], value[2], proof, pos)
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

export const Play = () => {
  const {
    game,
    data: { playerOne, playerTwo, playerTurn },
  } = useRouteLoaderData("game");
  const {
    board,
    data: { playerOneShots, playerTwoShots },
  } = useLoaderData();
  const {
    state: { accounts },
  } = useEth();
  const revalidator = useRevalidator();

  const opponent = playerOne === accounts[0] ? playerTwo : playerOne;
  const isPlayerTurn = playerTurn === accounts[0];
  const playerShots =
    playerOne === accounts[0] ? playerOneShots : playerTwoShots;
  const opponentShots =
    playerOne === accounts[0] ? playerTwoShots : playerOneShots;

  const range = [...Array(BOARD_SIDE_SIZE).keys()];

  useEffect(() => {
    (async () => {
      game.events
        .ShotTaken({ filter: { player: opponent } })
        .on("data", () => revalidator.revalidate());
    })();
  });

  const opponentBoard = range.map((i) => (
    <tr key={`opponent-col-${i}`}>
      {range.map((j) => {
        const pos = i * BOARD_SIDE_SIZE + j;
        const shot = playerShots.filter((e) => parseInt(e.index) === pos);
        const classes =
          shot.length > 0
            ? shot[0].typ === ShotType.Hit
              ? "hit"
              : shot[0].typ === ShotType.Taken
                ? "taken"
                : "miss"
            : "";

        const shotToCheck = opponentShots.filter(
          (e) => e.typ === ShotType.Taken
        );

        return (
          <td key={`opponent-row-${j}`}>
            <div className={classes}>
              {isPlayerTurn && shot.length === 0 && (
                <Form method="post">
                  {shotToCheck.length !== 0 ? (
                    <>
                      <input
                        type="hidden"
                        name="intent"
                        value="checkAndAttack"
                      />
                      <input
                        type="hidden"
                        name="checkPos"
                        value={shotToCheck[0].index}
                      />
                    </>
                  ) : (
                    <input type="hidden" name="intent" value="attack" />
                  )}
                  <input type="hidden" name="pos" value={pos} />
                  <input type="hidden" name="address" value={game._address} />
                  <button type="submit">shoot</button>
                </Form>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  ));

  const myBoard = range.map((i) => (
    <tr key={`player-col-${i}`}>
      {range.map((j) => {
        const pos = i * BOARD_SIDE_SIZE + j;
        const shot = opponentShots.filter((e) => parseInt(e.index) === pos);
        return (
          <td key={`player-row-${j}`}>
            <div
              className={
                shot.length > 0
                  ? shot[0].typ === ShotType.Hit
                    ? "hit"
                    : shot[0].typ === ShotType.Miss
                      ? "miss"
                      : "taken"
                  : board[pos]
                    ? "selected"
                    : ""
              }
            ></div>
          </td>
        );
      })}
    </tr>
  ));

  return (
    <>
      <div className="alert mb-10" role="alert">
        <h4 className="alert-heading">Opponent:</h4>
        <div className="text-center">
          <table className="mb-10 m-auto">
            <tbody>{opponentBoard}</tbody>
          </table>
        </div>
      </div>
      <div className="alert mb-10" role="alert">
        <h4 className="alert-heading">Your board:</h4>
        <div className="text-center">
          <table className="mb-10 m-auto">
            <tbody>{myBoard}</tbody>
          </table>
        </div>
      </div>
    </>
  );
};
