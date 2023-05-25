import { Form, useActionData, useRouteLoaderData } from "react-router-dom";
import {
  battleshipGameContractFromAddress,
  createToast,
  getWeb3Instance,
} from "../../utils";
import { useEth } from "../../contexts/EthContext";

export const action = async ({ request }) => {
  const form = await request.formData();
  const address = form.get("address");
  const contract = battleshipGameContractFromAddress(address);
  const accounts = await getWeb3Instance().eth.getAccounts();
  try {
    await contract.methods.withdraw().send({ from: accounts[0] });
    return { msg: "Funds were credited to your account. Thanks for playing!" };
  } catch (err) {
    createToast("Error", err.message, "alert-danger");
    return null;
  }
};

export const Withdraw = () => {
  const {
    game,
    data: { winner },
  } = useRouteLoaderData("game");
  const {
    state: { accounts },
  } = useEth();
  const actionData = useActionData();

  return winner === accounts[0] ? (
    actionData?.msg ? (
      actionData?.msg
    ) : (
      <Form method="post">
        <input type="hidden" name="address" value={game._address} />
        <button type="submit" className="btn btn-primary">
          Withdraw bet
        </button>
      </Form>
    )
  ) : (
    "You have lost."
  );
};
