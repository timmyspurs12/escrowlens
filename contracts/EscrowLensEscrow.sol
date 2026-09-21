// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title  EscrowLensEscrow
 * @notice P2P escrow for Monad with AI-assisted dispute resolution.
 *         The AI arbiter can ONLY produce an EIP-712 signed recommendation.
 *         It has NO privileged on-chain authority: settlement always requires
 *         the signature of the registered arbiter AND the approval of BOTH
 *         parties, and every payout path is deterministic on-chain logic.
 *
 *         Trust model:
 *           Evidence -> AI analysis -> signed ruling -> buyer approval
 *           -> seller approval -> contract validation -> settlement
 *
 *         Timeout safety (no stranded funds):
 *           - delivery deadline passed, no dispute  -> permissionless release to seller
 *           - dispute open, no ruling accepted      -> refund to buyer after window
 *           - ruling pending, not approved in time  -> refund to buyer after window
 */
contract EscrowLensEscrow is ReentrancyGuard {
    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------
    error InvalidSeller();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidDisputeWindow();
    error DescriptionTooLong();
    error NotBuyer();
    error NotSeller();
    error NotParty();
    error BadState();
    error DisputeWindowClosed();
    error EmptyEvidence();
    error NotDisputed();
    error NotRulingPending();
    error RulingExpired();
    error RulingAlreadyUsed();
    error InvalidArbiterSignature();
    error InvalidRulingData();
    error RulingAlreadyApproved();
    error NotYetExpired();
    error RulingApprovalWindowClosed();
    error TransferFailed();

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------
    /// @dev Lifecycle states. Escrows are funded at creation (atomic), so
    ///      there is no unfunded "Created" state holding funds.
    enum Status {
        Funded,       // 0: buyer deposited, waiting for delivery/release/dispute
        Delivered,    // 1: seller marked the deal delivered
        Disputed,     // 2: dispute opened, evidence collection
        RulingPending,// 3: signed ruling recorded, awaiting dual approval
        Settled       // 4: terminal - funds fully distributed
    }

    /// @dev Deterministic outcomes the arbiter can recommend.
    enum RulingType {
        RELEASE_BUYER, // 0: refund the buyer in full
        RELEASE_SELLER,// 1: pay the seller in full
        SPLIT          // 2: splitBps to seller, remainder to buyer
    }

    /// @dev EIP-712 ruling signed by the arbiter. Every field is bound to a
    ///      specific escrow; the contract re-verifies all of them on-chain.
    struct Ruling {
        uint256 escrowId;
        address buyer;
        address seller;
        uint256 amount;
        bytes32 evidenceHash; // keccak256(buyerEvidenceHash || sellerEvidenceHash)
        RulingType rulingType;
        uint16 splitBps;      // basis points to seller when rulingType == SPLIT
        uint256 arbiterNonce; // per-escrow ruling sequence number
        uint64 expiry;        // ruling must be recorded before this timestamp
    }

    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        string description;
        uint64 deliveryDeadline; // after this: permissionless release to seller
        uint64 disputeWindow;    // seconds; dispute ruling/fallback windows
        uint64 disputeOpenedAt;  // 0 until disputed
        uint64 rulingDeadline;   // acceptance deadline once a ruling is recorded
        bytes32 buyerEvidenceHash;
        bytes32 sellerEvidenceHash;
        RulingType pendingRulingType;
        uint16 pendingSplitBps;
        Status status;
    }

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------
    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, string description, uint64 deliveryDeadline, uint64 disputeWindow);
    event Delivered(uint256 indexed escrowId);
    event Released(uint256 indexed escrowId, uint256 amount);
    event EvidenceSubmitted(uint256 indexed escrowId, address indexed party, bytes32 evidenceHash);
    event DisputeOpened(uint256 indexed escrowId, address indexed party, bytes32 evidenceHash, uint64 disputeOpenedAt);
    event RulingRecorded(uint256 indexed escrowId, bytes32 indexed rulingHash, RulingType rulingType, uint16 splitBps, uint64 recordUntil);
    event RulingApproved(uint256 indexed escrowId, address indexed party, bytes32 indexed rulingHash);
    event EscrowSettled(uint256 indexed escrowId, uint256 amountToBuyer, uint256 amountToSeller, string outcome);
    event RulingSettled(uint256 indexed escrowId, RulingType rulingType, uint16 splitBps);

    // ------------------------------------------------------------------
    // Constants / immutables
    // ------------------------------------------------------------------
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MIN_DISPUTE_WINDOW = 10 minutes;
    uint256 public constant MAX_DESCRIPTION = 280;
    /// @dev A dispute with no accepted ruling falls back to a buyer refund
    ///      after twice the dispute window; a recorded ruling must be
    ///      approved by both parties within one dispute window.
    uint256 public constant FALLBACK_MULTIPLIER = 2;

    /// @notice The ONLY address whose EIP-712 signatures are accepted.
    ///         Holds no fund-moving privileges of any kind.
    address public immutable arbiter;

    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant RULING_TYPEHASH = keccak256("Ruling(uint256 escrowId,address buyer,address seller,uint256 amount,bytes32 evidenceHash,uint8 rulingType,uint16 splitBps,uint256 arbiterNonce,uint64 expiry)");
    bytes32 private constant NAME_HASH = keccak256("EscrowLens");
    bytes32 private constant VERSION_HASH = keccak256("1");

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------
    uint256 public nextEscrowId = 1;
    mapping(uint256 => Escrow) private _escrows;
    mapping(uint256 => bytes32) public activeRulingHash;      // ruling awaiting approval
    mapping(uint256 => mapping(address => bool)) public rulingApproved;
    mapping(bytes32 => bool) public usedRulingHash;           // replay protection
    mapping(uint256 => uint256) public rulingNonce;           // per-escrow accepted-ruling counter

    constructor(address _arbiter) {
        if (_arbiter == address(0)) revert InvalidArbiterSignature();
        arbiter = _arbiter;
        _DOMAIN_SEPARATOR = keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    // ------------------------------------------------------------------
    // Create + fund (atomic)
    // ------------------------------------------------------------------
    function createEscrow(address seller, string calldata description, uint64 deliveryDeadline, uint64 disputeWindow)
        external
        payable
        nonReentrant
        returns (uint256 escrowId)
    {
        if (seller == address(0) || seller == msg.sender || seller == address(this)) revert InvalidSeller();
        if (msg.value == 0) revert InvalidAmount();
        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
        if (disputeWindow < MIN_DISPUTE_WINDOW) revert InvalidDisputeWindow();
        if (bytes(description).length > MAX_DESCRIPTION) revert DescriptionTooLong();

        escrowId = nextEscrowId++;
        Escrow storage e = _escrows[escrowId];
        e.buyer = msg.sender;
        e.seller = seller;
        e.amount = msg.value;
        e.description = description;
        e.deliveryDeadline = deliveryDeadline;
        e.disputeWindow = disputeWindow;
        e.status = Status.Funded;

        emit EscrowCreated(escrowId, msg.sender, seller, msg.value, description, deliveryDeadline, disputeWindow);
    }

    // ------------------------------------------------------------------
    // Delivery / release
    // ------------------------------------------------------------------
    function markDelivered(uint256 escrowId) external {
        Escrow storage e = _escrows[escrowId];
        if (msg.sender != e.seller) revert NotSeller();
        if (e.status != Status.Funded) revert BadState();
        e.status = Status.Delivered;
        emit Delivered(escrowId);
    }

    /// @notice Buyer releases the full amount to the seller (deal succeeded).
    function releaseToSeller(uint256 escrowId) external nonReentrant {
        Escrow storage e = _escrows[escrowId];
        if (msg.sender != e.buyer) revert NotBuyer();
        if (e.status != Status.Funded && e.status != Status.Delivered) revert BadState();
        e.status = Status.Settled;
        _pay(e.seller, e.amount);
        emit Released(escrowId, e.amount);
        emit EscrowSettled(escrowId, 0, e.amount, "RELEASED_BY_BUYER");
    }

    // ------------------------------------------------------------------
    // Disputes and evidence
    // ------------------------------------------------------------------
    /// @notice Either party opens a dispute with their first evidence hash.
    ///         Must happen before the delivery deadline.
    function openDispute(uint256 escrowId, bytes32 evidenceHash) external {
        Escrow storage e = _escrows[escrowId];
        if (msg.sender != e.buyer && msg.sender != e.seller) revert NotParty();
        if (e.status != Status.Funded && e.status != Status.Delivered) revert BadState();
        if (block.timestamp >= e.deliveryDeadline) revert DisputeWindowClosed();
        if (evidenceHash == bytes32(0)) revert EmptyEvidence();

        e.status = Status.Disputed;
        e.disputeOpenedAt = uint64(block.timestamp);
        if (msg.sender == e.buyer) e.buyerEvidenceHash = evidenceHash;
        else e.sellerEvidenceHash = evidenceHash;

        emit EvidenceSubmitted(escrowId, msg.sender, evidenceHash);
        emit DisputeOpened(escrowId, msg.sender, evidenceHash, uint64(block.timestamp));
    }

    /// @notice Attach or update this party's evidence hash while disputed.
    function submitEvidence(uint256 escrowId, bytes32 evidenceHash) external {
        Escrow storage e = _escrows[escrowId];
        if (msg.sender != e.buyer && msg.sender != e.seller) revert NotParty();
        if (e.status != Status.Disputed) revert NotDisputed();
        if (evidenceHash == bytes32(0)) revert EmptyEvidence();

        if (msg.sender == e.buyer) e.buyerEvidenceHash = evidenceHash;
        else e.sellerEvidenceHash = evidenceHash;

        emit EvidenceSubmitted(escrowId, msg.sender, evidenceHash);
    }

    /// @notice The combined, tamper-evident binding of the exact evidence set.
    function combinedEvidenceHash(uint256 escrowId) public view returns (bytes32) {
        Escrow storage e = _escrows[escrowId];
        return keccak256(abi.encodePacked(e.buyerEvidenceHash, e.sellerEvidenceHash));
    }

    // ------------------------------------------------------------------
    // Ruling: record (signed) + dual approval + settlement
    // ------------------------------------------------------------------
    /// @notice Record an arbiter-signed ruling. Permissionless: any party
    ///         (or the arbiter service) may submit it; it only takes effect
    ///         once BOTH buyer and seller approve.
    function submitRuling(Ruling calldata r, bytes calldata signature) external nonReentrant {
        Escrow storage e = _escrows[r.escrowId];
        if (e.status != Status.Disputed) revert NotDisputed();

        // 1. Integrity: every field must match the on-chain escrow.
        if (r.buyer != e.buyer || r.seller != e.seller) revert InvalidRulingData();
        if (r.amount != e.amount) revert InvalidRulingData();
        if (r.evidenceHash != combinedEvidenceHash(r.escrowId)) revert InvalidRulingData();
        if (uint8(r.rulingType) > uint8(RulingType.SPLIT)) revert InvalidRulingData();
        if (r.rulingType == RulingType.SPLIT && r.splitBps > BPS_DENOMINATOR) revert InvalidRulingData();
        if (r.expiry <= block.timestamp) revert RulingExpired();
        if (r.arbiterNonce != rulingNonce[r.escrowId]) revert InvalidRulingData();

        // 2. Cryptography: recover the signer, must be the registered arbiter.
        bytes32 digest = _hashRuling(r);
        if (ECDSA.recover(digest, signature) != arbiter) revert InvalidArbiterSignature();
        if (usedRulingHash[digest]) revert RulingAlreadyUsed();

        // 3. Effects: record the pending ruling, open the approval window.
        usedRulingHash[digest] = true;
        activeRulingHash[r.escrowId] = digest;
        e.pendingRulingType = r.rulingType;
        e.pendingSplitBps = r.splitBps;
        e.status = Status.RulingPending;
        e.rulingDeadline = uint64(block.timestamp) + e.disputeWindow;
        delete rulingApproved[r.escrowId][e.buyer];
        delete rulingApproved[r.escrowId][e.seller];

        emit RulingRecorded(r.escrowId, digest, r.rulingType, r.splitBps, e.rulingDeadline);

        // If a party submitted the ruling, that counts as their approval.
        if (msg.sender == e.buyer || msg.sender == e.seller) {
            rulingApproved[r.escrowId][msg.sender] = true;
            emit RulingApproved(r.escrowId, msg.sender, digest);
        }
    }

    /// @notice Approve the currently recorded ruling. The SECOND approval
    ///         deterministically executes the settlement.
    function approveRuling(uint256 escrowId) external nonReentrant {
        Escrow storage e = _escrows[escrowId];
        if (msg.sender != e.buyer && msg.sender != e.seller) revert NotParty();
        if (e.status != Status.RulingPending) revert NotRulingPending();
        if (block.timestamp > e.rulingDeadline) revert RulingApprovalWindowClosed();
        if (rulingApproved[escrowId][msg.sender]) revert RulingAlreadyApproved();

        rulingApproved[escrowId][msg.sender] = true;
        bytes32 digest = activeRulingHash[escrowId];
        emit RulingApproved(escrowId, msg.sender, digest);

        // Dual approval reached -> deterministic settlement.
        if (rulingApproved[escrowId][e.buyer] && rulingApproved[escrowId][e.seller]) {
            uint256 amount = e.amount;
            e.status = Status.Settled;
            rulingNonce[escrowId] += 1;

            (uint256 toBuyer, uint256 toSeller) = _payoutSplit(e.pendingRulingType, e.pendingSplitBps, amount);
            _settle(escrowId, toBuyer, toSeller, "RULING_EXECUTED");
            emit RulingSettled(escrowId, e.pendingRulingType, e.pendingSplitBps);
        }
    }

    // ------------------------------------------------------------------
    // Timeout safety (permissionless, deterministic)
    // ------------------------------------------------------------------
    /// @notice Delivery deadline passed with no dispute -> seller is paid.
    function expire(uint256 escrowId) external nonReentrant {
        Escrow storage e = _escrows[escrowId];
        if (e.status != Status.Funded && e.status != Status.Delivered) revert BadState();
        if (block.timestamp < e.deliveryDeadline) revert NotYetExpired();

        e.status = Status.Settled;
        uint256 amount = e.amount;
        _pay(e.seller, amount);
        emit EscrowSettled(escrowId, 0, amount, "TIMEOUT_RELEASED_TO_SELLER");
    }

    /// @notice Dispute stalled (no ruling recorded) -> refund buyer.
    function fallbackResolveDispute(uint256 escrowId) external nonReentrant {
        Escrow storage e = _escrows[escrowId];
        if (e.status != Status.Disputed) revert BadState();
        if (block.timestamp < e.disputeOpenedAt + (e.disputeWindow * FALLBACK_MULTIPLIER)) revert NotYetExpired();

        e.status = Status.Settled;
        uint256 amount = e.amount;
        _pay(e.buyer, amount);
        emit EscrowSettled(escrowId, amount, 0, "DISPUTE_TIMEOUT_REFUNDED_BUYER");
    }

    /// @notice Ruling recorded but never approved by both parties in time -> refund buyer.
    function fallbackResolveRuling(uint256 escrowId) external nonReentrant {
        Escrow storage e = _escrows[escrowId];
        if (e.status != Status.RulingPending) revert BadState();
        if (block.timestamp <= e.rulingDeadline) revert NotYetExpired();

        e.status = Status.Settled;
        uint256 amount = e.amount;
        _pay(e.buyer, amount);
        emit EscrowSettled(escrowId, amount, 0, "RULING_TIMEOUT_REFUNDED_BUYER");
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------
    function getEscrow(uint256 escrowId)
        external
        view
        returns (
            address buyer,
            address seller,
            uint256 amount,
            string memory description,
            uint64 deliveryDeadline,
            uint64 disputeWindow,
            uint64 disputeOpenedAt,
            uint64 rulingDeadline,
            bytes32 buyerEvidenceHash,
            bytes32 sellerEvidenceHash,
            RulingType pendingRulingType,
            uint16 pendingSplitBps,
            Status status
        )
    {
        Escrow storage e = _escrows[escrowId];
        return (
            e.buyer,
            e.seller,
            e.amount,
            e.description,
            e.deliveryDeadline,
            e.disputeWindow,
            e.disputeOpenedAt,
            e.rulingDeadline,
            e.buyerEvidenceHash,
            e.sellerEvidenceHash,
            e.pendingRulingType,
            e.pendingSplitBps,
            e.status
        );
    }

    function escrowCount() external view returns (uint256) {
        return nextEscrowId - 1;
    }

    function domainSeparator() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    /// @notice Canonical digest for a ruling (used by the arbiter service,
    ///         the approval UI and the tests).
    function rulingDigest(Ruling calldata r) external view returns (bytes32) {
        return _hashRuling(r);
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------
    function _hashRuling(Ruling calldata r) private view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                RULING_TYPEHASH,
                r.escrowId,
                r.buyer,
                r.seller,
                r.amount,
                r.evidenceHash,
                r.rulingType,
                r.splitBps,
                r.arbiterNonce,
                r.expiry
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));
    }

    function _payoutSplit(RulingType rulingType, uint16 splitBps, uint256 amount)
        private
        pure
        returns (uint256 toBuyer, uint256 toSeller)
    {
        if (rulingType == RulingType.RELEASE_BUYER) return (amount, 0);
        if (rulingType == RulingType.RELEASE_SELLER) return (0, amount);
        toSeller = (amount * splitBps) / BPS_DENOMINATOR;
        toBuyer = amount - toSeller;
    }

    function _settle(uint256 escrowId, uint256 toBuyer, uint256 toSeller, string memory outcome) private {
        emit EscrowSettled(escrowId, toBuyer, toSeller, outcome);
        if (toBuyer > 0) _pay(_escrows[escrowId].buyer, toBuyer);
        if (toSeller > 0) _pay(_escrows[escrowId].seller, toSeller);
    }

    function _pay(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
