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
        Winner,
        WinnerVerified,
        End
    }

    // Total number of cells per board
    uint8 public constant CELLS_BOARD = 8 * 8;

    // No hard requirements on the fleet composition: a player may decide to have it all 1x1 ships
    // This is a simplifying assumption, as checking for the correctness of a precise fleet composition
    // is very inefficient computationally-wise (fastly growing tree).
    // A possible solution may be to represent ships as triples (position, direction, size),
    // but this would also complicate Merkle proofs.
    uint8 public constant SHIP_CELLS_BOARD = 10; // CHANGE ME for faster games

    // Possible outcomes for a shot: not shot, shot taken (awaiting confirmation),
    // hit or miss. None is also the Solidity default value zero (no need for initialization).
    enum ShotType {
        None,
        Taken,
        Hit,
        Miss
    }

    struct Shot {
        uint8 index;
        ShotType typ;
    }

    //
    //
    // storage variables
    //
    //

    // Contract that created this contract
    address public owner;

    // Players of the game
    // PlayerOne is always the one who create the game (saves a few bytes of space)
    address public playerOne;
    address public playerTwo;

    // Current phase of the game
    Phase public currentPhase;

    // Address of the player reported as AFK
    address public AFKPlayer;
    // Block number after which the AFKPlayer is considered AFK, and its opponent the winner
    uint public timeout;

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
    address public playerTurn;

    // Maps the shots that each player has taken
    mapping(address => mapping(uint8 => bool)) public shotsTakenMap;
    mapping(address => Shot[]) public shotsTaken;

    // Maps a player address to the number of ships its opponent has hit
    mapping(address => uint8) public hits;

    // Winner of the game. Allows the winner to withdraw its price
    address public winner;

    //
    //
    // events
    //
    //

    // Emitted when a player reports the opponent as AFK
    event AFKWarning(address indexed player);

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
    // In most cases, this also means that the opponent
    // checked the previous shot result
    event ShotTaken(address indexed player, uint8 cell);

    // Winner of the game
    // The winner still needs to send his board to the contract for verification
    event Winner(address player);

    // Winner has been correctly verified to be player
    event WinnerVerified(address player);

    //
    //
    // modifiers
    //
    //

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    modifier onlyPlayer() {
        require(msg.sender == playerOne || msg.sender == playerTwo);
        _;
    }

    modifier onlyWinner() {
        require(msg.sender == winner);
        _;
    }

    modifier isPlayerTurn() {
        require(msg.sender == playerTurn);
        _;
    }

    modifier checkAFK() {
        if (AFKPlayer != address(0)) {
            // AFK player has done an action before the timer run out, safe
            if (block.number < timeout && msg.sender == AFKPlayer) {
                delete AFKPlayer;
            } else if (block.number >= timeout) {
                // No action from the AFK player was taken before the timeout
                // The opponent wins by default
                _declareWinner(AFKPlayer == playerOne ? playerTwo : playerOne);
                return;
            }
        }
        _;
    }

    // Modifiers to check we are in a specific phase
    modifier phaseWaitingForPlayer() {
        require(currentPhase == Phase.WaitingForPlayer);
        _;
    }

    modifier phaseBetAgreement() {
        require(currentPhase == Phase.BetAgreement);
        _;
    }

    modifier phaseWaitingFunds() {
        require(currentPhase == Phase.WaitingFunds);
        _;
    }

    modifier phasePlacement() {
        require(currentPhase == Phase.Placement);
        _;
    }

    modifier phaseAttack() {
        require(currentPhase == Phase.Attack);
        _;
    }

    modifier phaseWinner() {
        require(currentPhase == Phase.Winner);
        _;
    }

    modifier phaseWinnerVerified() {
        require(currentPhase == Phase.WinnerVerified);
        _;
    }

    //
    //
    // public functions
    //
    //

    constructor(address _creator) {
        owner = msg.sender;
        playerOne = _creator;
        currentPhase = Phase.WaitingForPlayer;
    }

    function registerPlayerTwo(
        address _playerTwo
    ) external onlyOwner phaseWaitingForPlayer {
        require(playerTwo == address(0));
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

    function reportOpponentAFK() external onlyPlayer {
        // Issue: we want to prevent AFKing. However, this feature may be exploited to win games.
        // For instance, it may happen that a player is accused of being AFK, but is unable
        // to take any action, basically defaulting to a loss.
        // We also don't want to give the player the ability to declare it is not AFK, as this may
        // also be abused to lock the funds of the opponent until the opponent goes AFK.

        // The solution implemented is the following: check that the reported player can do an action.
        // If not, disallow reporting it for AFK. This approach, as error prone as it may be, is likely
        // the best one if implemented correctly.
        address opponent = msg.sender == playerOne ? playerTwo : playerOne;
        require(
            // First, verify that no player has been accused of being AFK currently
            AFKPlayer == address(0) &&
                // Disallow reporting on some phases
                (currentPhase != Phase.WaitingForPlayer &&
                    currentPhase != Phase.WinnerVerified &&
                    currentPhase != Phase.End) &&
                // If reported in the betting phase, check that player reporting has already bet and opponent hasn't
                ((currentPhase == Phase.WaitingFunds &&
                    playerPaid[msg.sender] &&
                    !playerPaid[opponent]) ||
                    // If reported during placement, check that opponent hasn't committed its board yet
                    (currentPhase == Phase.Placement &&
                        playerBoardMerkleRoot[opponent] == 0) ||
                    // If reported during attack phase, check that it is the opponent's turn
                    (currentPhase == Phase.Attack && playerTurn == opponent) ||
                    // Also allow reporting during board checking phase
                    (currentPhase == Phase.Winner && msg.sender != winner)),
            "Cannot report AFK player now"
        );

        emit AFKWarning(opponent);
        AFKPlayer = opponent;
        timeout = block.number + 5;
    }

    // It is likely that the AFK player is the only player that can take action
    // In this case, it would be impossible to claim the funds, thus the need of this function
    function verifyOpponentAFK() external onlyPlayer {
        require(AFKPlayer != address(0) && block.number >= timeout);

        // No action from the AFK player was taken before the timeout
        // The opponent wins by default
        address opponent = AFKPlayer == playerOne ? playerTwo : playerOne;
        emit WinnerVerified(opponent);
        winner = opponent;
    }

    function betFunds() external payable onlyPlayer phaseWaitingFunds checkAFK {
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
    ) external onlyPlayer phasePlacement checkAFK {
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

    function getShotsTaken(
        address player
    ) external view returns (Shot[] memory) {
        return shotsTaken[player];
    }

    // isPlayerTurn allows a subset of addresses wrt to isPlayer, therefore we
    // don't need both here
    function attack(uint8 _index) external phaseAttack isPlayerTurn checkAFK {
        _attack(_index);
    }

    // Only the first attack is *only* an attack
    // We can save a transaction by doing both checking and attacking at
    // the same time
    function checkAndAttack(
        bool _isShip,
        uint256 _salt,
        uint8 _index,
        bytes32[] memory _proof,
        uint8 _attackIndex
    ) external phaseAttack isPlayerTurn checkAFK {
        address opponent = msg.sender == playerOne ? playerTwo : playerOne;
        uint last = shotsTaken[opponent].length - 1;
        assert(shotsTaken[opponent][last].typ == ShotType.Taken);
        require(shotsTaken[opponent][last].index == _index);

        if (
            !_checkProof(
                _isShip,
                _salt,
                _index,
                _proof,
                playerBoardMerkleRoot[msg.sender]
            )
        ) {
            // Player has attempted cheating, thus opponent wins by default
            // without even checking its board
            emit WinnerVerified(opponent);
            currentPhase = Phase.WinnerVerified;
            winner = opponent;
            return;
        }

        if (_isShip) {
            shotsTaken[opponent][last].typ = ShotType.Hit;
            hits[msg.sender]++;

            // If the opponent has hit all of our ships,
            // the opponent wins
            if (hits[msg.sender] == SHIP_CELLS_BOARD) {
                emit Winner(opponent);
                winner = opponent;
                currentPhase = Phase.Winner;
                return;
            }
        } else {
            shotsTaken[opponent][last].typ = ShotType.Miss;
        }

        _attack(_attackIndex);
    }

    function checkWinnerBoard(
        bytes32[] memory _proof,
        bool[] memory _proofFlags,
        bool[] memory _cells,
        uint256[] memory _salts,
        uint8[] memory _indexes
    ) external phaseWinner onlyWinner checkAFK {
        require(_cells.length == _salts.length);
        require(_cells.length == _indexes.length);
        address opponent = msg.sender == playerOne ? playerTwo : playerOne;
        uint8 ships = 0;

        // The winner is required to send the proofs for the cells that he hasn't given a proof yet
        // First, we verify that the whole board is verified to belong to the Merkle tree
        // Using a multiproof allows to save about 300k gas
        if (
            !_checkMultiProof(
                _proof,
                _proofFlags,
                _cells,
                _salts,
                _indexes,
                playerBoardMerkleRoot[msg.sender]
            )
        ) {
            _declareWinner(opponent);
            return;
        }

        // We also check that no indexes are re-used. To do so, we re-use shotsTakenMap.
        for (uint i = 0; i < _cells.length; i++) {
            // Check that the index is valid
            if (_indexes[i] >= CELLS_BOARD) {
                _declareWinner(opponent);
                return;
            }

            assert(!shotsTakenMap[opponent][_indexes[i]]);
            shotsTakenMap[opponent][_indexes[i]] = true;
            if (_cells[i]) {
                ships++;
            }
        }

        // Verify that every cell has been checked
        for (uint8 i = 0; i < CELLS_BOARD; i++) {
            if (!shotsTakenMap[opponent][i]) {
                _declareWinner(opponent);
                return;
            }
        }

        // Check that the required number of ships was placed
        if (ships + hits[msg.sender] == SHIP_CELLS_BOARD) {
            _declareWinner(msg.sender);
        } else {
            // placement is invalid, player cheated!
            _declareWinner(opponent);
        }
    }

    function withdraw() external phaseWinnerVerified onlyWinner {
        // Re-entrancy should not be an issue as this contract will have zero balance
        // but we still make sure to update the currentPhase before a transfer
        currentPhase = Phase.End;
        payable(msg.sender).transfer(address(this).balance);
    }

    //
    //
    // helpers
    //
    //

    function _attack(uint8 _index) internal {
        // Check the selected cell is valid for the current board
        //  - not already shot
        //  - in a valid range (i.e. inside the boards boundaries)
        require(
            shotsTakenMap[msg.sender][_index] == false,
            "You have already shot that cell"
        );
        require(_index < CELLS_BOARD, "Cell is invalid");

        // Set the shot as taken
        shotsTakenMap[msg.sender][_index] = true;
        shotsTaken[msg.sender].push(Shot(_index, ShotType.Taken));

        // Notify opponent of the shot
        emit ShotTaken(msg.sender, _index);

        // Other player turn now
        playerTurn = playerTurn == playerOne ? playerTwo : playerOne;
    }

    function _checkProof(
        bool _isShip,
        uint256 _salt,
        uint8 _index,
        bytes32[] memory _proof,
        bytes32 _root
    ) internal pure returns (bool) {
        bytes32 leaf = _encodeLeaf(_isShip, _salt, _index);

        return MerkleProof.verify(_proof, _root, leaf);
    }

    function _checkMultiProof(
        bytes32[] memory _proof,
        bool[] memory _proofFlags,
        bool[] memory _cells,
        uint256[] memory _salts,
        uint8[] memory _indexes,
        bytes32 _root
    ) internal pure returns (bool) {
        // First, must encode leaves correctly
        bytes32[] memory leaves = new bytes32[](_cells.length);
        for (uint i = 0; i < _cells.length; i++) {
            leaves[i] = _encodeLeaf(_cells[i], _salts[i], _indexes[i]);
        }

        return MerkleProof.multiProofVerify(_proof, _proofFlags, _root, leaves);
    }

    function _encodeLeaf(
        bool _isShip,
        uint256 _salt,
        uint8 _index
    ) internal pure returns (bytes32) {
        return
            keccak256(
                bytes.concat(keccak256(abi.encode(_isShip, _salt, _index)))
            );
    }

    function _declareWinner(address player) internal {
        emit WinnerVerified(player);
        winner = player;
        currentPhase = Phase.WinnerVerified;
    }
}
