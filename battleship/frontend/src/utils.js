import halfmoon from "halfmoon";
import localforage from "localforage";
import Web3 from "web3";

export const BOARD_SIDE_SIZE = 8;
export const BOARD_SIZE = BOARD_SIDE_SIZE * BOARD_SIDE_SIZE;
export const SHIP_CELLS = 10;

export const Phase = {
  WaitingForPlayer: "0",
  BetAgreement: "1",
  WaitingFunds: "2",
  Placement: "3",
  Attack: "4",
  Winner: "5",
  WinnerVerified: "6",
  End: "7",
};

export const phaseToString = (phase) => {
  switch (phase) {
    case Phase.WaitingForPlayer:
      return "Waiting for player";
    case Phase.BetAgreement:
      return "Agreement on the bet";
    case Phase.WaitingFunds:
      return "Waiting for funds";
    case Phase.Placement:
      return "Placing ships";
    case Phase.Attack:
      return "Attacking";
    case Phase.Winner:
      return "Winner found";
    case Phase.WinnerVerified:
      return "Winner verified";
    case Phase.End:
      return "Winner verified";
    default:
      throw new Error("Invalid phase");
  }
};

export const ShotType = {
  None: "0",
  Taken: "1",
  Hit: "2",
  Miss: "3",
};

// Toasts function
export const createToast = (title, content, alert_type = "alert-primary") => {
  halfmoon.initStickyAlert({
    title: title,
    content: content,
    alertType: alert_type, // Optional, type of the alert, must be "alert-primary" || "alert-success" || "alert-secondary" || "alert-danger"
    timeShown: 5000, // Optional, time the alert stays on the screen (in ms), default: 5000, type: number
  });
};

export const getWeb3Instance = () => {
  return new Web3(Web3.givenProvider || "http://localhost:8545");
};

export const battleshipGameContractFromAddress = (address) => {
  const web3 = getWeb3Instance();
  const { abi } = require("./contracts/BattleshipGame.json");
  const contract = new web3.eth.Contract(abi, address);
  return contract;
};

export const battleshipContractFromAddress = (address) => {
  const web3 = getWeb3Instance();
  const { abi } = require("./contracts/Battleship.json");
  const contract = new web3.eth.Contract(abi, address);
  return contract;
};

export const rnd256 = () => {
  const bytes = new Uint8Array(32);

  window.crypto.getRandomValues(bytes);

  // convert byte array to hexademical representation
  const bytesHex = bytes.reduce(
    (o, v) => o + ("00" + v.toString(16)).slice(-2),
    ""
  );

  // convert hexademical value to a decimal string
  return window.BigInt("0x" + bytesHex).toString(10);
};

export const saveBoardTree = async (tree) => {
  await localforage.setItem("tree", tree);
};

export const loadBoardTree = async () => {
  return await localforage.getItem("tree");
};

export const saveBoard = async (board) => {
  await localforage.setItem("board", board);
};

export const loadBoard = async () => {
  return await localforage.getItem("board");
};
