// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract BattleshipGame {
    // Possible phases for a game
    enum Phase {
        WaitingForPlayer,
        BetAgreement,
        WaitingFunds,
        Placement,
        Attack,
        CheckShot,
        Winner,
        WinnerVerified
    }

    // Ammissible board sizes
    enum BoardSize {
        Small,
        Medium,
        Large
    }

    uint8 public constant CELLS_BOARD_SIZE_SMALL = 2 * 2;
    uint8 public constant CELLS_BOARD_SIZE_MEDIUM = 4 * 4;
    uint8 public constant CELLS_BOARD_SIZE_LARGE = 8 * 8;

    // Two small 1x1 ships
    uint8 public constant SHIP_CELLS_BOARD_SIZE_SMALL = 2;

    // Two 1x2 ships, two 1x1 ships
    uint8 public constant SHIP_CELLS_BOARD_SIZE_MEDIUM = 6;

    // One 1x5 ship, one 1x4 ship, two 1x3 ships, two 1x2 ships, two 1x1 ships
    uint8 public constant SHIP_CELLS_BOARD_SIZE_LARGE = 21;

    // Possible outcomes for a shot: not shot, shot taken (awaiting confirmation),
    // hit or miss. None is also the Solidity default value zero (no need for initialization).
    enum Shot {
        None,
        Taken,
        Hit,
        Miss
    }

    // value == 1 -> cell with a ship
    // value == 0 -> empty cell
    struct Cell {
        bool isShip;
        uint256 salt;
    }

    // Contract that created this contract
    address public owner;

    // Players of the game
    // PlayerOne is always the one who create the game (saves a few bytes of space)
    address public playerOne;
    address public playerTwo;

    // Current phase of the game
    Phase public currentPhase;

    // Board size
    BoardSize public boardSize;

    // Following amounts are all in wei
    // Contains the association between a player and its proposed bet.
    mapping(address => uint256) public proposedBets;
    // Final bet agreement
    uint256 public agreedBetAmount;

    // Whether a player has paied the agree amount
    mapping(address => bool) public playerPaid;

    // Players boards Merkle tree root
    mapping(address => bytes32) playerBoardMerkleRoot;

    // Whose player turn is the current one
    address playerTurn;

    // Maps the shots that each player has taken
    mapping(address => mapping(uint8 => Shot)) shotsTaken;

    // Maps a player address to the number of ships its opponent has hit
    mapping(address => uint8) hits;

    // Emitted when a player proposed an amount for the bet
    event BetProposal(address indexed player, uint256 amount);

    // Emitted when players have agreed on the bet amount
    event BetAgreed(uint256 amount);

    // Emitted when both players have deposited `agreedBetAmount` in the contract
    event FundsDeposited();

    // Emitted when both players have committed their board (e.g. have sent
    // the Merkle root of their board)
    event BoardsCommitted();

    // Informs the opponent that cell `cell` has been shot
    event ShotTaken(address indexed player, uint8 cell);

    // Winner of the game
    // The winner still needs to send his board to the contract for verification
    event Winner(address player);

    modifier onlyOwner() {
        require(msg.sender == owner, "You are not the owner");
        _;
    }

    modifier onlyPlayer() {
        require(
            msg.sender == playerOne || msg.sender == playerTwo,
            "You are not a player"
        );
        _;
    }

    // Modifiers to check we are in a specific phase
    modifier phaseWaitingForPlayer() {
        require(
            currentPhase == Phase.WaitingForPlayer,
            "Invalid function for current phase"
        );
        _;
    }

    modifier phaseBetAgreement() {
        require(
            currentPhase == Phase.BetAgreement,
            "Invalid function for current phase"
        );
        _;
    }

    modifier phaseWaitingFunds() {
        require(
            currentPhase == Phase.WaitingFunds,
            "Invalid function for current phase"
        );
        _;
    }

    modifier phasePlacement() {
        require(
            currentPhase == Phase.Placement,
            "Invalid function for current phase"
        );
        _;
    }

    modifier phaseAttack() {
        require(
            currentPhase == Phase.Attack,
            "Invalid function for current phase"
        );
        _;
    }

    modifier phaseCheckShot() {
        require(
            currentPhase == Phase.CheckShot,
            "Invalid function for current phase"
        );
        _;
    }

    modifier phaseWinner() {
        require(
            currentPhase == Phase.Winner,
            "Invalid function for current phase"
        );
        _;
    }

    modifier phaseWinnerVerified() {
        require(
            currentPhase == Phase.WinnerVerified,
            "Invalid function for current phase"
        );
        _;
    }

    modifier isPlayerTurn() {
        require(msg.sender == playerTurn, "It is not your turn");
        _;
    }

    constructor(address _creator, BoardSize _boardSize) {
        owner = msg.sender;
        playerOne = _creator;
        boardSize = _boardSize;
        currentPhase = Phase.WaitingForPlayer;
    }

    function registerPlayerTwo(
        address _playerTwo
    ) external onlyOwner phaseWaitingForPlayer {
        // Set second player and move to next phase
        playerTwo = _playerTwo;
        currentPhase = Phase.BetAgreement;
    }

    function proposeBet(uint256 _amount) external onlyPlayer phaseBetAgreement {
        // Set the proposed bet from player
        proposedBets[msg.sender] = _amount;
        emit BetProposal(msg.sender, _amount);
    }

    function acceptBet(uint256 _amount) external onlyPlayer phaseBetAgreement {
        // Check that the amount is actually the one proposed by the other player
        // and non-zero. Needed to avoid having a player agree to a different bet.
        require(
            _amount != 0 &&
                ((msg.sender == playerOne &&
                    proposedBets[playerTwo] == _amount) ||
                    (msg.sender == playerTwo &&
                        proposedBets[playerOne] == _amount)),
            "Amount invalid or does not match"
        );

        // Inform players that consensus on the amount has been reached
        emit BetAgreed(_amount);

        // Save it in the state
        agreedBetAmount = _amount;
        currentPhase = Phase.WaitingFunds;
    }

    function betFunds() external payable onlyPlayer phaseWaitingFunds {
        require(
            !playerPaid[msg.sender] && msg.value == agreedBetAmount,
            "Should pay exactly the agreed amount"
        );

        // Record that the player has paid
        playerPaid[msg.sender] = true;

        // If both have paid, move on to the next phase (placement)
        if (playerPaid[playerOne] && playerPaid[playerTwo]) {
            emit FundsDeposited();
            currentPhase = Phase.Placement;
        }
    }

    function commitBoard(
        bytes32 merkleTreeRoot
    ) external onlyPlayer phasePlacement {
        require(
            playerBoardMerkleRoot[msg.sender] == 0,
            "You have alread committed your board!"
        );

        // Save the Merkle root of the player
        playerBoardMerkleRoot[msg.sender] = merkleTreeRoot;

        // If both have committed their board, move on to the next phase (attack)
        if (
            playerBoardMerkleRoot[playerOne] != 0 &&
            playerBoardMerkleRoot[playerTwo] != 0
        ) {
            emit BoardsCommitted();
            currentPhase = Phase.Attack;

            // PlayerOne decided the size of the board, thus we let playerTwo
            // have the first turn in the attack phase
            playerTurn = playerTwo;
        }
    }

    function attack(uint8 _cell) external phaseAttack isPlayerTurn {
        // Check the selected cell is valid for the current board
        //  - not already shot
        //  - in a valid range (i.e. inside the boards boundaries, which depend
        //    on the boardSize)
        require(
            shotsTaken[msg.sender][_cell] == Shot.None,
            "You have already shot that cell"
        );
        require(
            ((boardSize == BoardSize.Small && _cell < 4) ||
                (boardSize == BoardSize.Medium && _cell < 16) ||
                (boardSize == BoardSize.Large && _cell < 64)),
            "Cell is invalid"
        );

        // Set the shot as taken
        shotsTaken[msg.sender][_cell] = Shot.Taken;

        // Change phase: opponent must now prove if the shot was a hit or a miss
        currentPhase = Phase.CheckShot;
        emit ShotTaken(msg.sender, _cell);

        // Other player turn now
        // Player is required to check the result of the shot before playing its move
        playerTurn = playerTurn == playerOne ? playerTwo : playerOne;
    }

    function shotResult(
        Cell calldata _cell,
        uint8 _index,
        bytes32[] memory _proof
    ) external phaseCheckShot isPlayerTurn {
        address opponent = playerTurn == playerOne ? playerTwo : playerOne;
        require(shotsTaken[opponent][_index] == Shot.Taken, "Invalid index");

        if (!checkProof(_cell, _proof, playerBoardMerkleRoot[msg.sender])) {
            // Player has attempted cheating, thus opponent wins by default
            // without even checking its board
            emit Winner(opponent);
            currentPhase = Phase.WinnerVerified;
        } else {
            if (_cell.isShip) {
                shotsTaken[opponent][_index] = Shot.Hit;
                hits[msg.sender]++;

                if (checkWinner()) {
                    emit Winner(opponent);
                    currentPhase = Phase.Winner;
                }
            } else {
                shotsTaken[opponent][_index] = Shot.Miss;
            }
            currentPhase = Phase.Attack;
        }
    }

    function checkProof(
        Cell calldata _cell,
        bytes32[] memory _proof,
        bytes32 _root
    ) internal returns (bool) {
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(_cell.isShip, _cell.salt)))
        );
        return MerkleProof.verify(_proof, _root, leaf);
    }

    function checkWinner() internal returns (bool) {
        return
            (boardSize == BoardSize.Small &&
                hits[msg.sender] == SHIP_CELLS_BOARD_SIZE_SMALL) ||
            (boardSize == BoardSize.Medium &&
                hits[msg.sender] == SHIP_CELLS_BOARD_SIZE_MEDIUM) ||
            (boardSize == BoardSize.Large &&
                hits[msg.sender] == SHIP_CELLS_BOARD_SIZE_LARGE);
    }
}
