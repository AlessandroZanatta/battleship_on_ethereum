// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "./BattleshipGame.sol";

contract Battleship {
    //
    //
    // variables
    //
    //

    // Maps BattleshipGames that are currently in the WaitingForPlayer phase.
    // Needed to keep track of valid indexes in joinableGamesIndexes
    mapping(BattleshipGame => bool) private joinableGamesMap;

    // Addresses of the BattleshipGame in the WaitingForPlayer phase.
    // We need to keep this list to implement a random join functionality
    BattleshipGame[] private joinableGames;

    // Mapping that keeps the association of the index of a BattleshipGame
    // inside the joinableGames. Used to prevent the need of iterating through
    // joinableGames for deletion
    mapping(BattleshipGame => uint256) private joinableGamesIndexes;

    // Nonce for pseudo-random number generation
    uint256 private nonce;

    //
    //
    // events
    //
    //

    // Emitted when a new game is created
    event NewGame(address indexed creator, BattleshipGame game);

    // Emitted when second player joins
    event JoinGame(address indexed player, BattleshipGame indexed game);

    // Emitted when player tries to join a random game, but not game is available
    event NoGame(address indexed player);

    //
    //
    // public functions
    //
    //

    function createGame() external {
        // Create a new game by deploying a new BattleshipGame contract
        BattleshipGame newGame = new BattleshipGame(msg.sender);

        // Add the game to our state
        _addGame(newGame);

        // Emit event to inform client of newGame address
        emit NewGame(msg.sender, newGame);
    }

    function joinGameByID(BattleshipGame _game) external {
        require(
            joinableGamesMap[_game] == true,
            "Game does not exist or cannot be joined"
        );

        require(
            msg.sender != _game.playerOne(),
            "It's kinda sad to play alone, isn't it?"
        );

        // Register the sender as the second player for the chosen game
        _game.registerPlayerTwo(msg.sender);

        // Delete the game
        _removeGame(_game);

        emit JoinGame(msg.sender, _game);
    }

    function joinRandomGame() external {
        require(joinableGames.length > 0, "There is no joinable game");

        // Generate a random starting index
        uint256 random = uint256(
            keccak256(
                abi.encodePacked(blockhash(block.number - 1), msg.sender, nonce)
            )
        ) % joinableGames.length;

        // Increment nonce
        nonce++;

        // We use the random index as a starting point. We need to check that we
        // do not pick a game that msg.sender created, thus the need to possibly loop
        // at most joinableGames.length times. In most cases, the for body is executed once.
        bool found = false;
        for (uint256 i = 0; i < joinableGames.length; i++) {
            // Get the randomly selected game
            BattleshipGame game = joinableGames[
                (random + i) % joinableGames.length
            ];

            // Check if picked game was created by msg.sender
            if (game.playerOne() != msg.sender) {
                found = true;

                // Register msg.sender as the second player
                game.registerPlayerTwo(msg.sender);

                // Remove game from our state
                _removeGame(game);

                // Inform client of game address
                emit JoinGame(msg.sender, game);
                break;
            }
        }

        // There is no playable game for msg.sender (i.e. msg.sender has created all joinable games)
        if (!found) emit NoGame(msg.sender);
    }

    //
    //
    // helpers
    //
    //

    function _removeGame(BattleshipGame _game) internal {
        // Must be called with a BattleshipGame that is currently saved in our state
        assert(joinableGamesMap[_game] == true);
        assert(joinableGames.length > 0);

        delete joinableGamesMap[_game];

        // Remove _game from joinableGames array
        // Does not retain elements order, therefore we also need to update joinableGamesIndexes
        uint256 index = joinableGamesIndexes[_game];
        if (joinableGames.length == 1 || index == joinableGames.length - 1) {
            joinableGames.pop();
        } else {
            joinableGames[index] = joinableGames[joinableGames.length - 1];
            joinableGames.pop();
            joinableGamesIndexes[joinableGames[index]] = index;
        }

        delete joinableGamesIndexes[_game];
    }

    function _addGame(BattleshipGame _game) internal {
        // Add the game to the list of games that can be joined
        joinableGamesMap[_game] = true;
        joinableGames.push(_game);
        // Push inserts at the top, thus length - 1 is the index of the element
        joinableGamesIndexes[_game] = joinableGames.length - 1;
    }
}
