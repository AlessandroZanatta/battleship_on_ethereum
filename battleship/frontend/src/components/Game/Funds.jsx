import { Form, useRouteLoaderData } from "react-router-dom";
import {
  battleshipGameContractFromAddress,
  createToast,
  getWeb3Instance,
} from "../../utils";

export const action = async ({ request }) => {
  const form = await request.formData();
  const address = form.get("address");
  const agreedBetAmount = form.get("agreedBetAmount");
  const contract = battleshipGameContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();
  try {
    await contract.methods
      .betFunds()
      .send({ from: accounts[0], value: agreedBetAmount });
  } catch (err) {
    createToast("Error", err.message, "alert-danger");
  }
  return null;
};

export const Funds = () => {
  const {
    game,
    data: { agreedBetAmount },
  } = useRouteLoaderData("game");
  return (
    <Form method="post">
      <input type="hidden" name="address" value={game._address} />
      <input type="hidden" name="agreedBetAmount" value={agreedBetAmount} />
      <button type="submit" className="btn btn-primary">
        Deposit funds
      </button>
    </Form>
  );
};
