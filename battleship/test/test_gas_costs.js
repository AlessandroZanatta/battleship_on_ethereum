const Battleship = artifacts.require("Battleship");
const BattleshipGame = artifacts.require("BattleshipGame");
const truffleAssert = require("truffle-assertions");
const StandardMerkleTree =
  require("@openzeppelin/merkle-tree").StandardMerkleTree;
const fs = require("fs");
const gasFile = "gas_analysis.json";

// Empty file
fs.writeFileSync(gasFile, JSON.stringify({}));

contract("Compute gas expense for AFK player functions", (accounts) => {
  let game;
  const playerOne = accounts[0];
  const playerTwo = accounts[1];
  let battleship;
  const data = {};

  before(async () => {
    battleship = await Battleship.deployed();
  });

  before(async () => {
    // Create game
    const tx = await battleship.createGame({
      from: playerOne,
    });
    data.createGame = tx.receipt.gasUsed;
    let gameAddr;
    truffleAssert.eventEmitted(tx, "NewGame", (ev) => {
      gameAddr = ev.game;
      return ev.creator == playerOne;
    });
    game = await BattleshipGame.at(gameAddr);
    const tx2 = await battleship.joinGameByID(gameAddr, {
      from: playerTwo,
    });
    data.joinID = tx2.receipt.gasUsed;
  });

  describe("Report and win game due to opponent AFK", () => {
    const amount = 100000;
    it("Propose a bet", async () => {
      await game.proposeBet(amount, { from: playerOne });
    });

    it("Other player agrees to the bet", async () => {
      await game.acceptBet(amount, { from: playerTwo });
    });

    it("Players deposit funds", async () => {
      await game.betFunds({ from: playerOne, value: amount });
    });

    it("PlayerOne accuses of AFKing playerTwo", async () => {
      const tx = await game.reportOpponentAFK({ from: playerOne });
      data.reportOpponentAFK = tx.receipt.gasUsed;
    });

    it("Wait for five blocks", async () => {
      for (let i = 0; i < 5; i++)
        await battleship.createGame({
          from: playerOne,
        });

      const tx = await game.verifyOpponentAFK({ from: playerOne });
      data.verifyOpponentAFK = tx.receipt.gasUsed;
    });

    it("Save data to file", () => {
      const prev = JSON.parse(fs.readFileSync(gasFile));
      fs.writeFileSync(gasFile, JSON.stringify({ ...data, ...prev }));
    });
  });
});

contract("Compute gas expenses for a full 8x8 board game", (accounts) => {
  let game;
  const playerOne = accounts[0];
  const playerTwo = accounts[1];
  let battleship;
  const data = {};

  before(async () => {
    battleship = await Battleship.deployed();
  });

  before(async () => {
    // Create game
    const tx = await battleship.createGame({
      from: playerOne,
    });
    data.createGame = tx.receipt.gasUsed;
    let gameAddr;
    truffleAssert.eventEmitted(tx, "NewGame", (ev) => {
      gameAddr = ev.game;
      return ev.creator == playerOne;
    });
    game = await BattleshipGame.at(gameAddr);
    const tx2 = await battleship.joinGameByID(gameAddr, {
      from: playerTwo,
    });
    data.joinID = tx2.receipt.gasUsed;
  });

  describe("Play a full game", () => {
    // Don't really know where to put this if not here
    it("Create game and join randomly", async () => {
      // Create game
      await battleship.createGame({
        from: playerOne,
      });

      const tx = await battleship.joinRandomGame({
        from: playerTwo,
      });
      data.joinRandomGame = tx.receipt.gasUsed;
    });

    const amount = 100000;
    it("Propose a bet", async () => {
      const tx = await game.proposeBet(amount, { from: playerOne });
      data.proposeBet = tx.receipt.gasUsed;
    });

    it("Other player agrees to the bet", async () => {
      const tx = await game.acceptBet(amount, { from: playerTwo });
      data.acceptBet = tx.receipt.gasUsed;
    });

    it("Players deposit funds", async () => {
      const tx = await game.betFunds({ from: playerOne, value: amount });
      data.betFunds = tx.receipt.gasUsed;
      await game.betFunds({ from: playerTwo, value: amount });
    });

    let p1_tree;
    let p2_tree;
    it("Players commit their board", async () => {
      // we cannot use browser crypto utils, therefore, for testing only,
      // use weak salts

      // Format:
      // isShip, salt, boardIndex+
      const board = [];
      for (let i = 0; i < 8 * 8; i++) {
        board.push([i < 10, i, i]);
      }
      p1_tree = StandardMerkleTree.of(board, ["bool", "uint256", "uint8"]);

      const tx = await game.commitBoard(p1_tree.root, { from: playerOne });
      data.commitBoard = tx.receipt.gasUsed;

      // same board, but different (weak) salts
      p2_tree = StandardMerkleTree.of(board, ["bool", "uint256", "uint8"]);
      await game.commitBoard(p2_tree.root, { from: playerTwo });
    });

    it("Players shoot each other's boards", async () => {
      // Player who joined the game always starts attacking first
      let tx = await game.attack(63, { from: playerTwo });
      data.attack = tx.receipt.gasUsed;

      for (let i = 63; i >= 0; i--) {
        // Generate proof
        value = p1_tree.values.find((v) => v.value[2] == i).value;
        proof = p1_tree.getProof(i);

        // Send proof and shoot in the same place as the other player
        tx = await game.checkAndAttack(value[0], value[1], value[2], proof, i, {
          from: playerOne,
        });
        if (i == 0) break;
        data.checkAndAttack = tx.receipt.gasUsed;

        // Generate proof
        value = p2_tree.values.find((v) => v.value[2] == i).value;
        proof = p2_tree.getProof(i);
        tx = await game.checkAndAttack(
          value[0],
          value[1],
          value[2],
          proof,
          i - 1,
          {
            from: playerTwo,
          }
        );
      }
    });

    it("Winner (playerTwo) sends its board for verification", async () => {
      // Get array of shots already taken
      const shotsTaken = await game.getShotsTaken(playerOne);

      // For each index in board, get value and proof if not already in shots verified
      const all = [...Array.from({ length: 8 * 8 }, (_, index) => index)];
      const { proof, proofFlags, leaves } = p2_tree.getMultiProof(
        all.filter((i) => !shotsTaken.find((e) => parseInt(e.index) === i))
      );
      const board = [];
      const salts = [];
      const indexes = [];
      leaves.forEach((e) => {
        board.push(e[0]);
        salts.push(e[1]);
        indexes.push(e[2]);
      });

      const tx = await game.checkWinnerBoard(
        proof,
        proofFlags,
        board,
        salts,
        indexes,
        {
          from: playerTwo,
        }
      );
      data.checkWinnerBoard = tx.receipt.gasUsed;
    });

    it("Winner (playerTwo) withdraws its winnings", async () => {
      const tx = await game.withdraw({ from: playerTwo });
      data.withdraw = tx.receipt.gasUsed;
    });

    it("Save data to file", () => {
      const prev = JSON.parse(fs.readFileSync(gasFile));
      fs.writeFileSync(gasFile, JSON.stringify({ ...data, ...prev }));
    });
  });
});
