import { Link } from "react-router-dom";
import { useEth } from "../contexts/EthContext";

export const Navbar = () => {
  const {
    state: { accounts },
  } = useEth();

  const accountBadge = accounts ? (
    <span className="badge ">Account: {accounts[0]}</span>
  ) : (
    <></>
  );

  return (
    <nav className="navbar justify-content-between">
      <Link to="/" className="navbar-brand">
        Battleship DApp
      </Link>
      <div className="navbar-content">{accountBadge}</div>
    </nav>
  );
};
