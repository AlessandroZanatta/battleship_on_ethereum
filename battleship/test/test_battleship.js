const Battleship = artifacts.require("Battleship");
const truffleAssert = require("truffle-assertions");
const utils = require("./utils");

contract("Test battleship contract - Create", (accounts) => {
  before(async () => {
    battleship = await Battleship.deployed();
  });

  describe("Create a new game and get its identifier", () => {
    it("Create a game", async () => {
      const playerOne = accounts[0];
      const tx = await battleship.createGame(utils.BoardSize.Small, {
        from: playerOne,
      });
      truffleAssert.eventEmitted(tx, "NewGame", (ev) => {
        return ev.creator == playerOne;
      });
    });
  });
});

contract("Test battleship contract - Join", (accounts) => {
  describe("Create a new game and join it given its ID", () => {
    const playerOne = accounts[0];
    const playerTwo = accounts[1];
    var game;
    it("Create a game", async () => {
      const tx = await battleship.createGame(utils.BoardSize.Small, {
        from: playerOne,
      });
      truffleAssert.eventEmitted(tx, "NewGame", (ev) => {
        game = ev.game;
        return ev.creator == playerOne;
      });
    });

    it("Join the game", async () => {
      const tx = await battleship.joinGameByID(game, { from: playerTwo });
      truffleAssert.eventEmitted(tx, "GameCanStart", (ev) => {
        return ev.game == game;
      });
    });

    it("No one else can join then", async () => {
      try {
        await battleship.joinGameByID(game, { from: accounts[2] });
        assert.fail("The transaction should have thrown an error");
      } catch (err) {
        assert.include(
          err.message,
          "revert",
          "Attemping to join a game with two players should revert"
        );
      }
    });
  });
});

contract("Test battleship contract - Random join", (accounts) => {
  describe("Create a new game and join it given its ID", () => {
    const playerOne = accounts[0];
    const playerTwo = accounts[1];
    var game;
    it("Create some games", async () => {
      await battleship.createGame(utils.BoardSize.Small, { from: playerOne });
      await battleship.createGame(utils.BoardSize.Small, { from: playerOne });
      await battleship.createGame(utils.BoardSize.Small, { from: playerOne });
    });

    it("playerOne cannot join", async () => {
      try {
        await battleship.joinRandomGame({ from: playerOne });
        assert.fail("The transaction should have thrown an error");
      } catch (err) {
        assert.include(err.message, "revert", "Cannot join your own games");
      }
    });

    it("playerTwo joins a random game", async () => {
      const tx = await battleship.joinRandomGame({ from: playerTwo });
      truffleAssert.eventEmitted(tx, "JoinGame");
      truffleAssert.eventEmitted(tx, "GameCanStart");
    });
  });
});
