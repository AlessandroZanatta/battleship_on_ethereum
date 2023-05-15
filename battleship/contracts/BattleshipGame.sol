// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract BattleshipGame {
    // Possible phases for a game
    enum Phase {
        WaitingForPlayer,
        BetAgreement,
        WaitingFunds,
        Placement,
        Attack,
        Ended
    }

    // Ammissible board sizes
    enum BoardSize {
        Small,
        Medium,
        Large
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
    BoardSize public boardsize;

    // Following amounts are all in wei
    // Contains the association between a player and its proposed bet.
    mapping(address => uint256) public proposedBets;
    // Final bet agreement
    uint256 public agreedBetAmount;

    // Whether a player has paied the agree amount
    mapping(address => bool) public playerPaid;

    // Players boards Merkle tree root
    mapping(address => bytes32) playerBoardMerkleRoot;

    // Emitted when a player proposed an amount for the bet
    event BetProposal(address indexed player, uint256 amount);

    // Emitted when players have agreed on the bet amount
    event BetAgreed(uint256 amount);

    // Emitted when both players have deposited `agreedBetAmount` in the contract
    event FundsDeposited();

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

    constructor(address _creator, BoardSize _boardsize) {
        owner = msg.sender;
        playerOne = _creator;
        boardsize = _boardsize;
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
        // and non-zero
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

        playerPaid[msg.sender] = true;
        if (playerPaid[playerOne] && playerPaid[playerTwo]) {
            emit FundsDeposited();
            currentPhase = Phase.Placement;
        }
    }
}
