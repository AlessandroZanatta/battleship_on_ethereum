const Battleship = artifacts.require("Battleship");

module.exports = (deployer) => {
  deployer.deploy(Battleship);
};
