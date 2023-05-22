import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEth } from "./contexts/EthContext";

import { Root } from "./components/Root";
import { Error } from "./components/Error";
import { Menu, action as menuAction } from "./components/Menu";
import { Wait, loader as waitLoader } from "./components/Wait";
import {
  Game,
  loader as gameLoader,
  action as gameAction,
} from "./components/Game";
import { Bet, action as betAction } from "./components/Game/Bet";
import { Funds, action as fundsAction } from "./components/Game/Funds";
import { Placing, action as placingAction } from "./components/Game/Placing";
import {
  Play,
  action as playAction,
  loader as playLoader,
} from "./components/Game/Play";
import { Winner } from "./components/Game/Winner";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <Error />,
    children: [
      { path: "/menu", element: <Menu />, action: menuAction },
      { path: "/wait/:address", element: <Wait />, loader: waitLoader },
      {
        path: "/game/:address",
        element: <Game />,
        loader: gameLoader,
        action: gameAction,
        id: "game",
        children: [
          {
            path: "/game/:address/bet",
            element: <Bet />,
            action: betAction,
          },
          {
            path: "/game/:address/funds",
            element: <Funds />,
            action: fundsAction,
          },
          {
            path: "/game/:address/placing",
            element: <Placing />,
            action: placingAction,
          },
          {
            path: "/game/:address/play",
            element: <Play />,
            action: playAction,
            loader: playLoader,
          },
          {
            path: "/game/:address/winner",
            element: <Winner />,
          },
        ],
      },
    ],
  },
]);

export const App = () => {
  const {
    state: { contract },
  } = useEth();

  return contract ? <RouterProvider router={router} /> : null;
};
