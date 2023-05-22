import { useState } from "react";
import { Form } from "react-router-dom";

import { useEth } from "../contexts/EthContext";
import {
  battleshipContractFromAddress,
  BoardSize,
  createToast,
  getWeb3Instance,
} from "../utils";

export const action = async ({ request }) => {
  const form = await request.formData();
  const intent = form.get("intent");
  const address = form.get("address");
  const contract = battleshipContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();
  try {
    switch (intent) {
      case "create":
        await contract.methods.createGame().send({ from: accounts[0] });
        break;

      case "joinGameByID":
        await contract.methods
          .joinGameByID(form.get("gameID"))
          .send({ from: accounts[0] });
        break;

      case "joinRandomGame":
        await contract.methods.joinRandomGame().send({ from: accounts[0] });
        break;

      default:
        return null;
    }
  } catch (err) {
    console.log({ err });
    createToast("Error", err.message, "alert-danger");
  }
  return null;
};

export const Menu = () => {
  const {
    state: { contract },
  } = useEth();

  const [joinGameByID, setJoinGameByID] = useState(false);

  let content;
  if (!joinGameByID) {
    content = (
      <>
        <Form method="post">
          <input type="hidden" name="address" value={contract._address} />
          <input type="hidden" name="intent" value="create" />
          <button type="submit" className="btn btn-primary btn-block mb-5">
            Create new game
          </button>
        </Form>
        <button
          className="btn btn-block btn-primary mb-5"
          type="button"
          onClick={() => {
            setJoinGameByID(true);
          }}
        >
          Join game by ID
        </button>
        <Form method="post" className="form-inline">
          <input type="hidden" name="address" value={contract._address} />
          <input type="hidden" name="intent" value="joinRandomGame" />
          <button type="submit" className="btn btn-block btn-primary">
            Join random game
          </button>
        </Form>
      </>
    );
  } else {
    content = (
      <>
        <button
          className="btn btn-block btn-danger mb-10"
          type="button"
          onClick={() => {
            setJoinGameByID(false);
          }}
        >
          Go back
        </button>

        <Form method="post" className="form-inline">
          <input type="hidden" name="address" value={contract._address} />
          <input type="hidden" name="intent" value="joinGameByID" />
          <input
            className="form-control"
            type="text"
            placeholder="Insert your game ID"
            name="gameID"
          />
          <input type="submit" value="Join game" className="btn btn-primary" />
        </Form>
      </>
    );
  }
  return (
    <div className="row justify-content-center">
      <div className="col-md-4">{content}</div>
    </div>
  );
};
