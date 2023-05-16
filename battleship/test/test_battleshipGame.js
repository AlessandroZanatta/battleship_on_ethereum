const Battleship = artifacts.require("Battleship");
const BattleshipGame = artifacts.require("BattleshipGame");
const truffleAssert = require("truffle-assertions");
const utils = require("./utils");

const setupGame = async (playerOne, playerTwo) => {
  const battleship = await Battleship.deployed();

  // Create game
  const createGameTx = await battleship.createGame(utils.BoardSize.Small, {
    from: playerOne,
  });
  let game;
  truffleAssert.eventEmitted(createGameTx, "NewGame", (ev) => {
    game = ev.game;
    return ev.creator == playerOne;
  });

  // Register playerTwo
  const joinGameTx = await battleship.joinGameByID(game, { from: playerTwo });
  truffleAssert.eventEmitted(joinGameTx, "GameCanStart", (ev) => {
    return ev.game == game;
  });

  // Return setupped game
  return BattleshipGame.at(game);
};

contract("Test BattleshipGame contract", (accounts) => {
  let game;
  const playerOne = accounts[0];
  const playerTwo = accounts[1];
  before(async () => {
    game = await setupGame(playerOne, playerTwo);
  });

  describe("Play a simple game", () => {
    const amount = 100000;
    it("Propose a bet", async () => {
      const tx = await game.proposeBet(amount, { from: playerOne });
      truffleAssert.eventEmitted(tx, "BetProposal", (ev) => {
        return ev.player == playerOne && ev.amount == amount;
      });
      const proposedAmount = await game.proposedBets(playerOne);
      assert.equal(proposedAmount, amount);
    });

    it("Same player cannot also agree to it itself", async () => {
      try {
        await game.acceptBet(amount, { from: playerOne });
        assert.fail("The transaction should have thrown an error");
      } catch (err) {
        assert.include(
          err.message,
          "revert",
          "Attempting to agree to its own bet should fail"
        );
      }
    });

    it("Other player agrees to the bet", async () => {
      const tx = await game.acceptBet(amount, { from: playerTwo });
      truffleAssert.eventEmitted(tx, "BetAgreed", (ev) => {
        return ev.amount == amount;
      });
      const agreedBetAmount = await game.agreedBetAmount();
      assert.equal(agreedBetAmount, amount);
    });

    it("Player cannot bet an amount different from the agreed one", async () => {
      try {
        await game.betFunds({ from: playerOne, value: amount - 1 });
        assert.fail("The transaction should have thrown an error");
      } catch (err) {
        assert.include(
          err.message,
          "revert",
          "Trying to cheat on funds depositing should fail"
        );
      }
    });

    it("PlayerOne deposits funds", async () => {
      await game.betFunds({ from: playerOne, value: amount });

      const gameBalance = await web3.eth.getBalance(game.address);
      assert.equal(gameBalance, amount);
    });

    it("Players cannot double bet", async () => {
      try {
        await game.betFunds({ from: playerOne, value: amount });
        assert.fail("The transaction should have thrown an error");
      } catch (err) {
        assert.include(
          err.message,
          "revert",
          "Trying to double deposit should fail"
        );
      }
    });

    it("PlayerTwo deposits funds", async () => {
      const tx = await game.betFunds({ from: playerTwo, value: amount });

      const gameBalance = await web3.eth.getBalance(game.address);
      assert.equal(gameBalance, amount * 2);
      truffleAssert.eventEmitted(tx, "FundsDeposited");
    });
  });
});
