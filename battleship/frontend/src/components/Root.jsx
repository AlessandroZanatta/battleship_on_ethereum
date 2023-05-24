import { useEffect } from "react";
import useEth from "../contexts/EthContext/useEth";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import halfmoon from "halfmoon";

import { Navbar } from "./Navbar";
import { createToast } from "../utils";

export const Root = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    state: { contract, accounts },
  } = useEth();

  useEffect(() => {
    // Required by Halfmoon framework
    halfmoon.onDOMContentLoaded();

    if (location.pathname === "/" || location.pathname === "") {
      navigate("/menu");
    }
  });

  useEffect(() => {
    // Add event listeners for Battleship contract

    // New game created
    contract.events
      .NewGame({ filter: { creator: accounts[0] } })
      .on("data", (e) => {
        navigate(`/wait/${e.returnValues.game}`);
      });

    // Game joined from this account
    contract.events
      .JoinGame({ filter: { player: accounts[0] } })
      .on("data", (e) => {
        navigate(`/game/${e.returnValues.game}/bet`);
      });

    // Game joined from this account
    contract.events
      .NoGame({ filter: { player: accounts[0] } })
      .on("data", (e) => {
        createToast("No game available", "", "alert-danger");
      });
  }, []);

  return (
    <div className="page-wrapper with-navbar">
      <div className="sticky-alerts"></div>
      <Navbar />
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="card">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};
