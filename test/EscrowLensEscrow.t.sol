// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EscrowLensEscrow} from "../contracts/EscrowLensEscrow.sol";

contract ReentrantSeller {
    EscrowLensEscrow public escrow;
    uint256 public escrowId;
    bool public attacked;

    constructor(EscrowLensEscrow _escrow) payable {
        escrow = _escrow;
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Reentry attempt: approve again from inside the payout.
            escrow.approveRuling(escrowId);
        }
    }
}

contract EscrowLensEscrowTest is Test {
    EscrowLensEscrow internal escrow;

    uint256 internal constant ARBITER_PK = 0xA11CE;
    address internal arbiter;
    address internal buyer = makeAddr("buyer");
    address internal seller = makeAddr("seller");
    address internal stranger = makeAddr("stranger");

    string internal constant DESC = "Vintage camera lens - Nikon 50mm f/1.4";
    uint256 internal constant AMOUNT = 1 ether;
    uint64 internal constant DELIVERY_DEADLINE = 3 days;
    uint64 internal constant DISPUTE_WINDOW = 1 days;

    bytes32 internal constant BUYER_EVIDENCE = keccak256("buyer-evidence-photo-no-lens-cap");
    bytes32 internal constant SELLER_EVIDENCE = keccak256("seller-evidence-shipping-receipt");

    uint256 internal escrowId;

    function setUp() public {
        arbiter = vm.addr(ARBITER_PK);
        escrow = new EscrowLensEscrow(arbiter);
        vm.deal(buyer, 100 ether);
        vm.deal(seller, 100 ether);
        vm.deal(stranger, 100 ether);
        escrowId = _createDefaultEscrow();
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------
    function _createDefaultEscrow() internal returns (uint256) {
        return _createEscrowFrom(buyer, seller);
    }

    function _createEscrowFrom(address b, address s) internal returns (uint256 id) {
        vm.deal(b, 100 ether);
        vm.startPrank(b);
        id = escrow.createEscrow{value: AMOUNT}(
            s, DESC, uint64(block.timestamp + DELIVERY_DEADLINE), DISPUTE_WINDOW
        );
        vm.stopPrank();
    }

    function _openDisputedWithBothEvidence(uint256 id) internal {
        vm.prank(buyer);
        escrow.openDispute(id, BUYER_EVIDENCE);
        vm.prank(seller);
        escrow.submitEvidence(id, SELLER_EVIDENCE);
    }

    function _makeRuling(EscrowLensEscrow c, uint256 id, EscrowLensEscrow.RulingType rt, uint16 splitBps, uint64 expiryOffset, uint256 nonce)
        internal
        view
        returns (EscrowLensEscrow.Ruling memory r)
    {
        (
            address b,
            address s,
            uint256 amt,
            , // description
            , // deliveryDeadline
            , // disputeWindow
            , // disputeOpenedAt
            , // rulingDeadline
            bytes32 be,
            bytes32 se,
            , // pendingRulingType
            , // pendingSplitBps
            // status
        ) = c.getEscrow(id);
        r = EscrowLensEscrow.Ruling({
            escrowId: id,
            buyer: b,
            seller: s,
            amount: amt,
            evidenceHash: keccak256(abi.encodePacked(be, se)),
            rulingType: rt,
            splitBps: splitBps,
            arbiterNonce: nonce,
            expiry: uint64(block.timestamp + expiryOffset)
        });
    }

    function _sign(EscrowLensEscrow.Ruling memory r, uint256 pk) internal view returns (bytes memory) {
        bytes32 digest = escrow.rulingDigest(r);
        // vm.sign returns (v, r, s). Keep the order straight and normalize
        // to low-s, because OZ's ECDSA rejects malleable high-s signatures.
        (uint8 v, bytes32 sigR, bytes32 sigS) = vm.sign(pk, digest);
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        if (uint256(sigS) > n / 2) {
            sigS = bytes32(n - uint256(sigS));
            v = v == 27 ? 28 : 27;
        }
        return abi.encodePacked(sigR, sigS, v);
    }

    function _status(uint256 id) internal view returns (EscrowLensEscrow.Status) {
        (,,,,,,,,,,,, EscrowLensEscrow.Status st) = escrow.getEscrow(id);
        return st;
    }

    // ---------------------------------------------------------------
    // Create / fund
    // ---------------------------------------------------------------
    function test_CreateEscrow_StoresStateAndFunds() public {
        (address b, address s, uint256 amt, string memory d, uint64 deadline, uint64 window,,,,,, ,) =
            escrow.getEscrow(escrowId);
        assertEq(b, buyer);
        assertEq(s, seller);
        assertEq(amt, AMOUNT);
        assertEq(d, DESC);
        assertEq(deadline, uint64(block.timestamp) + DELIVERY_DEADLINE);
        assertEq(window, DISPUTE_WINDOW);
        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.Funded));
        assertEq(address(escrow).balance, AMOUNT);
        assertEq(escrow.escrowCount(), 1);
    }

    function test_CreateEscrow_RevertsOnZeroValue() public {
        vm.prank(buyer);
        vm.expectRevert(EscrowLensEscrow.InvalidAmount.selector);
        escrow.createEscrow(seller, DESC, uint64(block.timestamp + 1 days), DISPUTE_WINDOW);
    }

    function test_CreateEscrow_RevertsOnSelfSeller() public {
        vm.prank(buyer);
        vm.expectRevert(EscrowLensEscrow.InvalidSeller.selector);
        escrow.createEscrow{value: AMOUNT}(buyer, DESC, uint64(block.timestamp + 1 days), DISPUTE_WINDOW);
    }

    function test_CreateEscrow_RevertsOnPastDeadline() public {
        vm.prank(buyer);
        vm.expectRevert(EscrowLensEscrow.InvalidDeadline.selector);
        escrow.createEscrow{value: AMOUNT}(seller, DESC, uint64(block.timestamp - 1), DISPUTE_WINDOW);
    }

    function test_CreateEscrow_RevertsOnTinyDisputeWindow() public {
        vm.prank(buyer);
        vm.expectRevert(EscrowLensEscrow.InvalidDisputeWindow.selector);
        escrow.createEscrow{value: AMOUNT}(seller, DESC, uint64(block.timestamp + 1 days), 5 minutes);
    }

    // ---------------------------------------------------------------
    // Delivery / release
    // ---------------------------------------------------------------
    function test_MarkDelivered() public {
        vm.prank(seller);
        escrow.markDelivered(escrowId);
        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.Delivered));
    }

    function test_MarkDelivered_OnlySeller() public {
        vm.prank(buyer);
        vm.expectRevert(EscrowLensEscrow.NotSeller.selector);
        escrow.markDelivered(escrowId);
    }

    function test_ReleaseToSeller_PaysSeller() public {
        uint256 before = seller.balance;
        vm.prank(buyer);
        escrow.releaseToSeller(escrowId);
        assertEq(seller.balance, before + AMOUNT);
        assertEq(address(escrow).balance, 0);
        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.Settled));
    }

    function test_Release_OnlyBuyer() public {
        vm.prank(seller);
        vm.expectRevert(EscrowLensEscrow.NotBuyer.selector);
        escrow.releaseToSeller(escrowId);
    }

    // ---------------------------------------------------------------
    // Dispute + evidence
    // ---------------------------------------------------------------
    function test_OpenDispute_BindsEvidence() public {
        _openDisputedWithBothEvidence(escrowId);
        (,,,,,,,, bytes32 be, bytes32 se,,, ) = escrow.getEscrow(escrowId);
        assertEq(be, BUYER_EVIDENCE);
        assertEq(se, SELLER_EVIDENCE);
        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.Disputed));
        assertEq(escrow.combinedEvidenceHash(escrowId), keccak256(abi.encodePacked(BUYER_EVIDENCE, SELLER_EVIDENCE)));
    }

    function test_OpenDispute_OnlyParty() public {
        vm.prank(stranger);
        vm.expectRevert(EscrowLensEscrow.NotParty.selector);
        escrow.openDispute(escrowId, BUYER_EVIDENCE);
    }

    function test_OpenDispute_RevertsAfterDeadline() public {
        vm.warp(block.timestamp + DELIVERY_DEADLINE);
        vm.prank(buyer);
        vm.expectRevert(EscrowLensEscrow.DisputeWindowClosed.selector);
        escrow.openDispute(escrowId, BUYER_EVIDENCE);
    }

    function test_SubmitEvidence_UpdatesPartyHash() public {
        vm.prank(buyer);
        escrow.openDispute(escrowId, BUYER_EVIDENCE);
        bytes32 newHash = keccak256("buyer-evidence-v2-chat-log");
        vm.prank(buyer);
        escrow.submitEvidence(escrowId, newHash);
        (,,,,,,,, bytes32 be,,,, ) = escrow.getEscrow(escrowId);
        assertEq(be, newHash);
    }

    // ---------------------------------------------------------------
    // Ruling: signature verification
    // ---------------------------------------------------------------
    function test_SubmitRuling_Valid_SetsRulingPending() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.SPLIT, 3000, 2 hours, 0);
        escrow.submitRuling(r, _sign(r, ARBITER_PK));

        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.RulingPending));
        assertTrue(escrow.activeRulingHash(escrowId) != bytes32(0));
    }

    function test_SubmitRuling_InvalidSignature() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_SELLER, 0, 2 hours, 0);
        bytes memory forged = _sign(r, 0xB0B); // signed by the wrong key
        vm.expectRevert(EscrowLensEscrow.InvalidArbiterSignature.selector);
        escrow.submitRuling(r, forged);
    }

    function test_SubmitRuling_Expired() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_SELLER, 0, 1 hours, 0);
        bytes memory sig = _sign(r, ARBITER_PK);
        vm.warp(block.timestamp + 2 hours); // ruling now expired
        vm.expectRevert(EscrowLensEscrow.RulingExpired.selector);
        escrow.submitRuling(r, sig);
    }

    function test_SubmitRuling_ReplayRejectedOnSecondEscrow() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_BUYER, 0, 2 hours, 0);
        escrow.submitRuling(r, _sign(r, ARBITER_PK)); // escrow 1 -> RulingPending

        vm.warp(block.timestamp + 2 hours);
        uint256 id2 = _createEscrowFrom(buyer, seller);
        vm.prank(buyer);
        escrow.openDispute(id2, BUYER_EVIDENCE);
        vm.prank(seller);
        escrow.submitEvidence(id2, SELLER_EVIDENCE);

        // Resubmitting the SAME ruling struct (escrowId=1) must fail:
        // escrow 1 is no longer in Disputed.
        bytes memory replaySig = _sign(r, ARBITER_PK); // sign BEFORE expectRevert
        vm.expectRevert(EscrowLensEscrow.NotDisputed.selector);
        escrow.submitRuling(r, replaySig);
    }

    function test_SubmitRuling_WrongEscrowData() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_SELLER, 0, 2 hours, 0);
        r.amount = AMOUNT + 1 ether; // tampered amount
        bytes memory sig = _sign(r, ARBITER_PK);
        vm.expectRevert(EscrowLensEscrow.InvalidRulingData.selector);
        escrow.submitRuling(r, sig);
    }

    function test_SubmitRuling_WrongEvidenceHash() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_SELLER, 0, 2 hours, 0);
        r.evidenceHash = keccak256("tampered-evidence");
        bytes memory sig = _sign(r, ARBITER_PK);
        // Integrity checks run BEFORE signature checks: tampered evidence is
        // rejected on its own, regardless of signature validity.
        vm.expectRevert(EscrowLensEscrow.InvalidRulingData.selector);
        escrow.submitRuling(r, sig);
    }

    function test_SubmitRuling_WrongArbiterRejected() public {
        // A contract deployed with a DIFFERENT arbiter address.
        EscrowLensEscrow other = new EscrowLensEscrow(vm.addr(0xDEAD));
        vm.deal(buyer, 200 ether);
        vm.startPrank(buyer);
        uint256 id = other.createEscrow{value: AMOUNT}(
            seller, DESC, uint64(block.timestamp + DELIVERY_DEADLINE), DISPUTE_WINDOW
        );
        other.openDispute(id, BUYER_EVIDENCE);
        vm.stopPrank();
        vm.prank(seller);
        other.submitEvidence(id, SELLER_EVIDENCE);

        EscrowLensEscrow.Ruling memory r = _makeRuling(other, id, EscrowLensEscrow.RulingType.RELEASE_BUYER, 0, 2 hours, 0);
        // NOTE: digest is computed against `escrow` (arbiter 0xA11CE domain);
        // on `other` the recovered signer will not match its arbiter anyway.
        bytes memory sig = _sign(r, ARBITER_PK); // sign BEFORE expectRevert
        vm.expectRevert(EscrowLensEscrow.InvalidArbiterSignature.selector);
        other.submitRuling(r, sig);
    }

    function test_SubmitRuling_RecoverableWithinDisputeWindow() public {
        _openDisputedWithBothEvidence(escrowId);
        vm.warp(block.timestamp + DISPUTE_WINDOW); // just inside fallback window
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.SPLIT, 5000, 2 hours, 0);
        escrow.submitRuling(r, _sign(r, ARBITER_PK));
        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.RulingPending));
    }

    // ---------------------------------------------------------------
    // Dual approval + settlement
    // ---------------------------------------------------------------
    function test_DualApproval_ExecutesSplitRuling() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.SPLIT, 3000, 2 hours, 0);
        bytes memory sig = _sign(r, ARBITER_PK);

        // A neutral submitter (not a party) records the ruling: no approval counted.
        escrow.submitRuling(r, sig);
        assertFalse(escrow.rulingApproved(escrowId, buyer));

        uint256 buyerBefore = buyer.balance;
        uint256 sellerBefore = seller.balance;

        vm.prank(buyer);
        escrow.approveRuling(escrowId);
        assertTrue(escrow.rulingApproved(escrowId, buyer));
        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.RulingPending));

        vm.prank(seller);
        escrow.approveRuling(escrowId); // second approval settles

        uint256 expectedSeller = (AMOUNT * 3000) / 10_000;
        assertEq(seller.balance, sellerBefore + expectedSeller);
        assertEq(buyer.balance, buyerBefore + (AMOUNT - expectedSeller));
        assertEq(address(escrow).balance, 0);
        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.Settled));
    }

    function test_DualApproval_ReleasesToBuyer() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_BUYER, 0, 2 hours, 0);
        bytes memory sig = _sign(r, ARBITER_PK); // sign BEFORE arming prank
        vm.prank(buyer);
        escrow.submitRuling(r, sig); // buyer submits = buyer approves
        assertTrue(escrow.rulingApproved(escrowId, buyer));

        uint256 before = buyer.balance;
        vm.prank(seller);
        escrow.approveRuling(escrowId);
        assertEq(buyer.balance, before + AMOUNT);
        assertEq(uint8(_status(escrowId)), uint8(EscrowLensEscrow.Status.Settled));
    }

    function test_ApproveRuling_OnlyParty() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_BUYER, 0, 2 hours, 0);
        escrow.submitRuling(r, _sign(r, ARBITER_PK));
        vm.prank(stranger);
        vm.expectRevert(EscrowLensEscrow.NotParty.selector);
        escrow.approveRuling(escrowId);
    }

    function test_ApproveRuling_RevertAfterSettled() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_BUYER, 0, 2 hours, 0);
        bytes memory sig = _sign(r, ARBITER_PK); // sign BEFORE arming prank
        vm.prank(buyer);
        escrow.submitRuling(r, sig);
        vm.prank(seller);
        escrow.approveRuling(escrowId); // settles
        vm.prank(buyer);
        vm.expectRevert(EscrowLensEscrow.NotRulingPending.selector);
        escrow.approveRuling(escrowId);
    }

    function test_ApproveRuling_WindowCloses() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.RELEASE_BUYER, 0, 2 hours, 0);
        escrow.submitRuling(r, _sign(r, ARBITER_PK));
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        vm.prank(buyer);
        vm.expectRevert(EscrowLensEscrow.RulingApprovalWindowClosed.selector);
        escrow.approveRuling(escrowId);
    }

    // ---------------------------------------------------------------
    // Timeouts
    // ---------------------------------------------------------------
    function test_TimeoutReleasesToSeller() public {
        uint256 before = seller.balance;
        vm.warp(block.timestamp + DELIVERY_DEADLINE + 1);
        escrow.expire(escrowId); // permissionless
        assertEq(seller.balance, before + AMOUNT);
    }

    function test_Expire_RevertsBeforeDeadline() public {
        vm.expectRevert(EscrowLensEscrow.NotYetExpired.selector);
        escrow.expire(escrowId);
    }

    function test_DisputeFallback_RefundsBuyer() public {
        _openDisputedWithBothEvidence(escrowId);
        uint256 before = buyer.balance;
        vm.warp(block.timestamp + DISPUTE_WINDOW * 2 + 1);
        escrow.fallbackResolveDispute(escrowId);
        assertEq(buyer.balance, before + AMOUNT);
    }

    function test_RulingFallback_RefundsBuyerWhenNotApprovedInTime() public {
        _openDisputedWithBothEvidence(escrowId);
        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, escrowId, EscrowLensEscrow.RulingType.SPLIT, 7000, 2 hours, 0);
        escrow.submitRuling(r, _sign(r, ARBITER_PK));
        uint256 before = buyer.balance;
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        escrow.fallbackResolveRuling(escrowId);
        assertEq(buyer.balance, before + AMOUNT);
    }

    // ---------------------------------------------------------------
    // Reentrancy
    // ---------------------------------------------------------------
    function test_ReentrantSeller_CannotSettleTwice() public {
        // Seller is a malicious contract; its receive() re-enters approveRuling.
        ReentrantSeller attacker = new ReentrantSeller{value: 0}(escrow);
        vm.deal(buyer, 200 ether);
        uint256 id = _createEscrowFrom(buyer, address(attacker));
        vm.prank(buyer);
        escrow.openDispute(id, BUYER_EVIDENCE);
        vm.prank(address(attacker));
        escrow.submitEvidence(id, SELLER_EVIDENCE);

        EscrowLensEscrow.Ruling memory r = _makeRuling(escrow, id, EscrowLensEscrow.RulingType.RELEASE_SELLER, 0, 2 hours, 0);
        escrow.submitRuling(r, _sign(r, ARBITER_PK));

        // Attacker approves normally.
        vm.prank(address(attacker));
        escrow.approveRuling(id);
        // Buyer's final approval triggers the payout to the attacker, whose
        // receive() re-enters approveRuling -> the whole settlement reverts.
        vm.prank(buyer);
        vm.expectRevert();
        escrow.approveRuling(id);
        // Nothing settled, no funds lost (setUp escrow + this escrow both unspent).
        assertEq(address(escrow).balance, 2 * AMOUNT);
    }
}
