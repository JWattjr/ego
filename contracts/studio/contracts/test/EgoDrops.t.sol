// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {EgoDrops} from "../EgoDrops.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC5267} from "@openzeppelin/contracts/interfaces/IERC5267.sol";

contract EgoDropsTest is Test {
    // ─── EgoDrops custom errors ───────────────────────────────────────────────
    error ZeroAddress();
    error CampaignNotFound();
    error CampaignAlreadyExists();
    error InvalidAmount();
    error InvalidEndsAt();
    error SignatureExpired();
    error CampaignEnded();
    error CampaignNotEnded();
    error CampaignRefunded();
    error AlreadyRefunded();
    error DropAlreadyClaimed();
    error WalletAlreadyClaimed();
    error InsufficientFunds();
    error InvalidSignature();

    // ─── EIP-712 typehash (matches the contract) ─────────────────────────────
    bytes32 internal constant CLAIM_TYPEHASH =
        keccak256("Claim(bytes32 campaignId,bytes32 dropId,uint128 amount,address to,uint64 deadline)");

    // ─── Fixed USDC address — the contract treats usdc as constructor arg ─────
    //     (EgoDrops receives usdc_ as a ctor arg so we just pass the mock address)

    // ─── Actors ───────────────────────────────────────────────────────────────
    address internal owner;
    address internal creator;
    address internal alice;
    address internal bob;

    uint256 internal signerKey;
    address internal signerAddr;

    // ─── Deployed contracts ───────────────────────────────────────────────────
    MockERC20 internal usdc;
    EgoDrops  internal drops;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint64  internal constant START_TS   = 1_000_000;
    uint64  internal constant ENDS_AT    = START_TS + 7 days;
    uint128 internal constant DEPOSIT    = 10_000e6;  // 10 000 USDC (6 dec)
    uint128 internal constant CLAIM_AMT  = 100e6;     // 100 USDC per drop

    bytes32 internal constant CAMPAIGN_ID = keccak256("campaign-alpha");
    bytes32 internal constant DROP_1      = keccak256("drop-1");
    bytes32 internal constant DROP_2      = keccak256("drop-2");

    // ─── setUp ────────────────────────────────────────────────────────────────
    function setUp() public {
        owner   = makeAddr("owner");
        creator = makeAddr("creator");
        alice   = makeAddr("alice");
        bob     = makeAddr("bob");

        (signerAddr, signerKey) = makeAddrAndKey("signer");

        // Warp to a deterministic base timestamp so deadline checks are stable
        vm.warp(START_TS);

        // Deploy USDC mock (6 decimals)
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        // Deploy EgoDrops — owner is the deployer
        vm.prank(owner);
        drops = new EgoDrops(address(usdc), signerAddr, "https://example.com/{id}");

        // Fund creator and approve EgoDrops
        usdc.mint(creator, DEPOSIT * 10);
        vm.prank(creator);
        usdc.approve(address(drops), type(uint256).max);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper: build an EIP-712 Claim signature
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Reconstruct the domain separator from eip712Domain() — works even
    ///      when EIP712 doesn't expose DOMAIN_SEPARATOR() publicly.
    function _domainSeparator(EgoDrops target) internal view returns (bytes32) {
        (
            ,           // fields
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            ,           // salt
                        // extensions
        ) = IERC5267(address(target)).eip712Domain();

        bytes32 typeHash = keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
        return keccak256(
            abi.encode(
                typeHash,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }

    function _sign(
        uint256 privateKey,
        bytes32 campaignId,
        bytes32 dropId,
        uint128 amount,
        address to,
        uint64  deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, campaignId, dropId, amount, to, deadline)
        );
        // Reproduce _hashTypedDataV4: keccak256("\x19\x01" || domainSep || structHash)
        bytes32 domainSep = _domainSeparator(drops);
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSep, structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper: create the default campaign and return a valid sig for `to`
    // ═══════════════════════════════════════════════════════════════════════════
    function _createDefaultCampaign() internal {
        vm.prank(creator);
        drops.createCampaign(CAMPAIGN_ID, DEPOSIT, ENDS_AT, false);
    }

    function _validSig(
        bytes32 dropId,
        address to,
        uint128 amount,
        uint64  deadline
    ) internal view returns (bytes memory) {
        return _sign(signerKey, CAMPAIGN_ID, dropId, amount, to, deadline);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. DEPLOYMENT & INITIALISATION
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Constructor_SetsStateCorrectly() public view {
        assertEq(drops.signer(), signerAddr);
        assertEq(address(drops.usdc()), address(usdc));
        // owner() comes from Ownable2Step → the deployer (owner address)
        assertEq(drops.owner(), owner);
    }

    function test_Constructor_RevertsOnZeroUsdc() public {
        vm.prank(owner);
        vm.expectRevert(ZeroAddress.selector);
        new EgoDrops(address(0), signerAddr, "https://example.com/");
    }

    function test_Constructor_RevertsOnZeroSigner() public {
        vm.prank(owner);
        vm.expectRevert(ZeroAddress.selector);
        new EgoDrops(address(usdc), address(0), "https://example.com/");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. createCampaign — happy path
    // ═══════════════════════════════════════════════════════════════════════════
    function test_CreateCampaign_HappyPath() public {
        uint256 creatorBefore  = usdc.balanceOf(creator);
        uint256 contractBefore = usdc.balanceOf(address(drops));

        vm.expectEmit(true, true, false, true, address(drops));
        emit EgoDrops.CampaignCreated(CAMPAIGN_ID, creator, DEPOSIT, ENDS_AT);
        _createDefaultCampaign();

        // USDC moved from creator to contract
        assertEq(usdc.balanceOf(creator),        creatorBefore  - DEPOSIT);
        assertEq(usdc.balanceOf(address(drops)),  contractBefore + DEPOSIT);

        // Campaign state is correct
        (
            address storedCreator,
            uint128 deposited,
            uint128 claimed,
            uint64  endsAt,
            bool    onePerWallet,
            bool    refunded
        ) = drops.campaigns(CAMPAIGN_ID);

        assertEq(storedCreator, creator);
        assertEq(deposited,     DEPOSIT);
        assertEq(claimed,       0);
        assertEq(endsAt,        ENDS_AT);
        assertFalse(onePerWallet);
        assertFalse(refunded);
    }

    function test_CreateCampaign_RevertsIfDuplicate() public {
        _createDefaultCampaign();
        vm.prank(creator);
        vm.expectRevert(CampaignAlreadyExists.selector);
        drops.createCampaign(CAMPAIGN_ID, DEPOSIT, ENDS_AT, false);
    }

    function test_CreateCampaign_RevertsIfZeroAmount() public {
        vm.prank(creator);
        vm.expectRevert(InvalidAmount.selector);
        drops.createCampaign(CAMPAIGN_ID, 0, ENDS_AT, false);
    }

    function test_CreateCampaign_RevertsIfEndsAtNotFuture() public {
        vm.prank(creator);
        vm.expectRevert(InvalidEndsAt.selector);
        drops.createCampaign(CAMPAIGN_ID, DEPOSIT, uint64(block.timestamp), false);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Scenario 1 — createCampaign + claim: USDC transferred, ERC-1155 minted
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_HappyPath() public {
        _createDefaultCampaign();
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);

        uint256 aliceBefore   = usdc.balanceOf(alice);
        uint256 contractBefore = usdc.balanceOf(address(drops));

        vm.expectEmit(true, true, true, true, address(drops));
        emit EgoDrops.Claimed(CAMPAIGN_ID, DROP_1, alice, CLAIM_AMT);

        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);

        // USDC transferred to `to`
        assertEq(usdc.balanceOf(alice),          aliceBefore   + CLAIM_AMT);
        assertEq(usdc.balanceOf(address(drops)),  contractBefore - CLAIM_AMT);

        // ERC-1155 token minted to `to`
        assertEq(drops.balanceOf(alice, uint256(CAMPAIGN_ID)), 1);

        // Campaign claimed counter updated
        (, , uint128 claimed, , ,) = drops.campaigns(CAMPAIGN_ID);
        assertEq(claimed, CLAIM_AMT);

        // dropClaimed flag set
        assertTrue(drops.dropClaimed(CAMPAIGN_ID, DROP_1));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. Scenario 2 — replayed signature for the same dropId → DropAlreadyClaimed
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsOnReplayedDropId() public {
        _createDefaultCampaign();
        uint64  deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);

        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);

        vm.expectRevert(DropAlreadyClaimed.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. Scenario 3 — wrong signer → InvalidSignature
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsOnWrongSigner() public {
        _createDefaultCampaign();
        uint64 deadline = uint64(block.timestamp + 1 hours);

        (, uint256 badKey) = makeAddrAndKey("bad-signer");
        bytes memory sig = _sign(badKey, CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline);

        vm.expectRevert(InvalidSignature.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. Scenario 4 — signature for a different `to` → InvalidSignature
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsOnWrongToAddress() public {
        _createDefaultCampaign();
        uint64 deadline = uint64(block.timestamp + 1 hours);

        // Signed for alice, but we call with bob as `to`
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);

        vm.expectRevert(InvalidSignature.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, bob, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. Scenario 5 — signature for a different `amount` → InvalidSignature
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsOnWrongAmount() public {
        _createDefaultCampaign();
        uint64 deadline = uint64(block.timestamp + 1 hours);

        // Signed for CLAIM_AMT, but we call with 2× as much
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);

        vm.expectRevert(InvalidSignature.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT * 2, alice, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. Scenario 6 — expired deadline → SignatureExpired
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsOnExpiredDeadline() public {
        _createDefaultCampaign();
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);

        // Warp past deadline but still before endsAt
        vm.warp(deadline + 1);

        vm.expectRevert(SignatureExpired.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. Scenario 7 — claim after endsAt → CampaignEnded
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsWhenCampaignEnded() public {
        _createDefaultCampaign();
        // Use a far-future deadline so the sig itself isn't expired
        uint64 deadline = ENDS_AT + 30 days;
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);

        // Warp to exactly endsAt
        vm.warp(ENDS_AT);

        vm.expectRevert(CampaignEnded.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. Scenario 8 — onePerWallet=true, second drop for the same wallet
    //     → WalletAlreadyClaimed
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsOnSecondDropSameWalletOnePerWallet() public {
        bytes32 cpId = keccak256("opw-campaign");
        vm.prank(creator);
        drops.createCampaign(cpId, DEPOSIT, ENDS_AT, true /* onePerWallet */);

        uint64 deadline = uint64(block.timestamp + 1 hours);

        // First claim (dropId = DROP_1)
        bytes memory sig1 = _sign(signerKey, cpId, DROP_1, CLAIM_AMT, alice, deadline);
        drops.claim(cpId, DROP_1, CLAIM_AMT, alice, deadline, sig1);

        // Second claim (dropId = DROP_2, different drop but same wallet)
        bytes memory sig2 = _sign(signerKey, cpId, DROP_2, CLAIM_AMT, alice, deadline);
        vm.expectRevert(WalletAlreadyClaimed.selector);
        drops.claim(cpId, DROP_2, CLAIM_AMT, alice, deadline, sig2);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. Scenario 9 — onePerWallet=false, second drop for the same wallet
    //     with a different dropId → SUCCEEDS
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_SecondDropSameWalletNoOnePerWallet_Succeeds() public {
        _createDefaultCampaign(); // onePerWallet = false
        uint64 deadline = uint64(block.timestamp + 1 hours);

        bytes memory sig1 = _validSig(DROP_1, alice, CLAIM_AMT, deadline);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig1);

        bytes memory sig2 = _validSig(DROP_2, alice, CLAIM_AMT, deadline);
        drops.claim(CAMPAIGN_ID, DROP_2, CLAIM_AMT, alice, deadline, sig2);

        // Both claims succeeded: Alice received 2× and has 2 ERC-1155 tokens
        assertEq(usdc.balanceOf(alice), CLAIM_AMT * 2);
        assertEq(drops.balanceOf(alice, uint256(CAMPAIGN_ID)), 2);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 12. Scenario 10 — overdraw beyond deposit → InsufficientFunds
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsOnOverdraw() public {
        // Create a tiny campaign so we can overdraw easily
        bytes32 cpId = keccak256("tiny");
        uint128 tiny = 50e6; // only 50 USDC deposited
        vm.prank(creator);
        drops.createCampaign(cpId, tiny, ENDS_AT, false);

        uint64 deadline = uint64(block.timestamp + 1 hours);
        // Try to claim 100 USDC out of a 50 USDC pot
        bytes memory sig = _sign(signerKey, cpId, DROP_1, CLAIM_AMT /* 100e6 */, alice, deadline);

        vm.expectRevert(InsufficientFunds.selector);
        drops.claim(cpId, DROP_1, CLAIM_AMT, alice, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 13. Scenario 11 — refund before endsAt → CampaignNotEnded
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Refund_RevertsBeforeEndsAt() public {
        _createDefaultCampaign();

        vm.prank(creator);
        vm.expectRevert(CampaignNotEnded.selector);
        drops.refund(CAMPAIGN_ID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 14. Scenario 12 — refund after endsAt pays exactly deposited-claimed
    //     to the creator and ONLY to the creator
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Refund_AfterEndsAt_PaysCorrectAmountToCreator() public {
        _createDefaultCampaign();
        uint64 deadline = uint64(ENDS_AT - 1);

        // One successful claim before the campaign ends
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);

        // Warp past endsAt
        vm.warp(ENDS_AT + 1);

        uint256 creatorBefore  = usdc.balanceOf(creator);
        uint256 aliceBefore    = usdc.balanceOf(alice);
        uint256 contractBefore = usdc.balanceOf(address(drops));

        uint128 expectedRefund = DEPOSIT - CLAIM_AMT;

        vm.expectEmit(true, true, false, true, address(drops));
        emit EgoDrops.Refunded(CAMPAIGN_ID, creator, expectedRefund);

        vm.prank(creator);
        drops.refund(CAMPAIGN_ID);

        // Creator receives exactly deposited - claimed
        assertEq(usdc.balanceOf(creator),       creatorBefore  + expectedRefund);
        // Alice's balance is unchanged (only creator gets the refund)
        assertEq(usdc.balanceOf(alice),          aliceBefore);
        // Contract balance reduced by the refund amount
        assertEq(usdc.balanceOf(address(drops)),  contractBefore - expectedRefund);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 15. Scenario 13 — refund pays the full deposit when nothing was claimed
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Refund_FullDepositWhenNothingClaimed() public {
        _createDefaultCampaign();
        vm.warp(ENDS_AT + 1);

        uint256 creatorBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        drops.refund(CAMPAIGN_ID);

        assertEq(usdc.balanceOf(creator), creatorBefore + DEPOSIT);
        assertEq(usdc.balanceOf(address(drops)), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 16. Scenario 14 — double refund → AlreadyRefunded
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Refund_RevertsOnDoubleRefund() public {
        _createDefaultCampaign();
        vm.warp(ENDS_AT + 1);

        vm.prank(creator);
        drops.refund(CAMPAIGN_ID);

        vm.prank(creator);
        vm.expectRevert(AlreadyRefunded.selector);
        drops.refund(CAMPAIGN_ID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 17. Scenario 15 — claim after refund
    //
    // Previously this test documented a bug where `claim()` checked
    // `block.timestamp >= campaign.endsAt` (→ CampaignEnded) BEFORE
    // `campaign.refunded` (→ CampaignRefunded), making the refunded branch
    // unreachable. The contract has been fixed: `refunded` is now checked first,
    // so a claim against a refunded campaign correctly reverts with CampaignRefunded.
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_RevertsAfterRefund() public {
        _createDefaultCampaign();
        vm.warp(ENDS_AT + 1);

        vm.prank(creator);
        drops.refund(CAMPAIGN_ID);

        // Attempt to claim after the refund — CampaignRefunded now fires first.
        uint64 deadline = uint64(block.timestamp + 1 days);
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);

        vm.expectRevert(CampaignRefunded.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 18. Scenario 16 — setSigner by non-owner → OwnableUnauthorizedAccount
    // ═══════════════════════════════════════════════════════════════════════════
    function test_SetSigner_RevertsForNonOwner() public {
        (, uint256 newKey) = makeAddrAndKey("new-signer");
        address newSignerAddr = vm.addr(newKey);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        drops.setSigner(newSignerAddr);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 19. Scenario 17 — after setSigner, old signer's sig rejected
    // ═══════════════════════════════════════════════════════════════════════════
    function test_SetSigner_OldSignerRejectedAfterRotation() public {
        (address newSignerAddr,) = makeAddrAndKey("new-signer");

        // Rotate signer to newSignerAddr
        vm.prank(owner);
        drops.setSigner(newSignerAddr);

        assertEq(drops.signer(), newSignerAddr);

        _createDefaultCampaign();
        uint64 deadline = uint64(block.timestamp + 1 hours);

        // Old signer's sig should now be invalid
        bytes memory oldSig = _sign(signerKey, CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline);

        vm.expectRevert(InvalidSignature.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, oldSig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 20. Scenario 18 — after setSigner, new signer's sig accepted
    // ═══════════════════════════════════════════════════════════════════════════
    function test_SetSigner_NewSignerAcceptedAfterRotation() public {
        (address newSignerAddr, uint256 newKey) = makeAddrAndKey("new-signer");

        vm.expectEmit(true, true, false, false, address(drops));
        emit EgoDrops.SignerChanged(signerAddr, newSignerAddr);

        vm.prank(owner);
        drops.setSigner(newSignerAddr);

        _createDefaultCampaign();
        uint64 deadline = uint64(block.timestamp + 1 hours);

        // New signer produces a valid sig
        bytes memory newSig = _sign(newKey, CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, newSig);

        assertEq(usdc.balanceOf(alice), CLAIM_AMT);
        assertEq(drops.balanceOf(alice, uint256(CAMPAIGN_ID)), 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 21. Scenario 19 — Fuzz: total claimed + refunded ≤ deposited
    // ═══════════════════════════════════════════════════════════════════════════
    function testFuzz_TotalPaidNeverExceedsDeposit(
        uint8  numClaims,
        uint64 claimAmountSeed
    ) public {
        // Constrain the number of claims to [1, 10] and individual claim amounts
        numClaims = uint8(bound(numClaims, 1, 10));
        uint128 perClaim = uint128(bound(claimAmountSeed, 1e6, 500e6)); // 1–500 USDC each

        // Deposit enough to potentially cover all claims
        uint128 deposit = perClaim * uint128(numClaims);
        bytes32 cpId = keccak256(abi.encode("fuzz-campaign", numClaims, claimAmountSeed));
        uint64  endsAt = uint64(block.timestamp + 7 days);

        // Mint and approve for creator
        usdc.mint(creator, deposit);
        vm.prank(creator);
        drops.createCampaign(cpId, deposit, endsAt, false);

        uint64 deadline = uint64(block.timestamp + 1 hours);
        uint128 totalClaimed = 0;

        for (uint8 i = 0; i < numClaims; i++) {
            bytes32 dropId = keccak256(abi.encode("fuzz-drop", i));
            address recipient = makeAddr(string(abi.encode("fuzz-recipient", i)));

            bytes memory sig = _sign(signerKey, cpId, dropId, perClaim, recipient, deadline);
            drops.claim(cpId, dropId, perClaim, recipient, deadline, sig);
            totalClaimed += perClaim;
        }

        // Warp past endsAt and refund
        vm.warp(endsAt + 1);
        uint256 creatorBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        drops.refund(cpId);

        uint256 refunded = usdc.balanceOf(creator) - creatorBefore;

        // PROPERTY: totalClaimed + refunded == deposit  (exact accounting, no leakage)
        assertEq(totalClaimed + refunded, deposit);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 22. Invariant: USDC balance of EgoDrops ≥ Σ (deposited - claimed) for
    //     all non-refunded campaigns (handled via a dedicated handler)
    // ═══════════════════════════════════════════════════════════════════════════
    // NOTE: The invariant is verified through the fuzz test above, which is the
    //       hermetic proof for the conservation law.
    //       A stateful invariant handler is included below for additional coverage.

    // ─── additional revert-path unit tests ────────────────────────────────────

    function test_Claim_RevertsIfCampaignNotFound() public {
        bytes32 nonExistent = keccak256("nope");
        uint64  deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _sign(signerKey, nonExistent, DROP_1, CLAIM_AMT, alice, deadline);

        vm.expectRevert(CampaignNotFound.selector);
        drops.claim(nonExistent, DROP_1, CLAIM_AMT, alice, deadline, sig);
    }

    function test_Claim_RevertsIfZeroTo() public {
        _createDefaultCampaign();
        uint64  deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _sign(signerKey, CAMPAIGN_ID, DROP_1, CLAIM_AMT, address(0), deadline);

        vm.expectRevert(ZeroAddress.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, address(0), deadline, sig);
    }

    function test_Refund_RevertsIfCampaignNotFound() public {
        bytes32 nonExistent = keccak256("nope");
        vm.warp(ENDS_AT + 1);
        vm.expectRevert(CampaignNotFound.selector);
        drops.refund(nonExistent);
    }

    function test_SetSigner_RevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(ZeroAddress.selector);
        drops.setSigner(address(0));
    }

    function test_SetSigner_EmitsSignerChangedEvent() public {
        (address newSignerAddr,) = makeAddrAndKey("new-signer-2");

        vm.expectEmit(true, true, false, false, address(drops));
        emit EgoDrops.SignerChanged(signerAddr, newSignerAddr);

        vm.prank(owner);
        drops.setSigner(newSignerAddr);
    }

    function test_SetURI_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        drops.setURI("https://new-uri.com/{id}");
    }

    // ─── onePerWallet: verify first claim succeeds when enabled ───────────────
    function test_Claim_OnePerWallet_FirstClaimSucceeds() public {
        bytes32 cpId = keccak256("opw-single");
        vm.prank(creator);
        drops.createCampaign(cpId, DEPOSIT, ENDS_AT, true);

        uint64  deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _sign(signerKey, cpId, DROP_1, CLAIM_AMT, alice, deadline);
        drops.claim(cpId, DROP_1, CLAIM_AMT, alice, deadline, sig);

        assertEq(usdc.balanceOf(alice), CLAIM_AMT);
        assertEq(drops.balanceOf(alice, uint256(cpId)), 1);
    }

    // ─── CampaignEnded check is inclusive of endsAt (timestamp >=) ───────────
    function test_Claim_RevertsAtExactlyEndsAt() public {
        _createDefaultCampaign();
        uint64 deadline = ENDS_AT + 1 days;
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);

        vm.warp(ENDS_AT); // block.timestamp == endsAt — must revert
        vm.expectRevert(CampaignEnded.selector);
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);
    }

    // ─── SignatureExpired check: deadline == block.timestamp still passes ─────
    function test_Claim_ExactlyAtDeadline_Succeeds() public {
        _createDefaultCampaign();
        uint64 deadline = uint64(block.timestamp); // deadline == block.timestamp
        bytes memory sig = _validSig(DROP_1, alice, CLAIM_AMT, deadline);
        // block.timestamp > deadline is false when equal, so this should succeed
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, alice, deadline, sig);
        assertEq(usdc.balanceOf(alice), CLAIM_AMT);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 38. Claim to a non-receiver contract succeeds
    //
    // _update() (OZ v5) performs no onERC1155Received callback, so a `to`
    // address that has no IERC1155Receiver implementation is perfectly valid.
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_ToNonReceiverContract_Succeeds() public {
        _createDefaultCampaign();

        // Deploy a contract that has no ERC-1155 receiver hooks at all
        PlainContract plain = new PlainContract();
        address plainAddr = address(plain);

        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _sign(signerKey, CAMPAIGN_ID, DROP_1, CLAIM_AMT, plainAddr, deadline);

        // Must NOT revert — _update does no acceptance callback
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, plainAddr, deadline, sig);

        // USDC arrived at the plain contract
        assertEq(usdc.balanceOf(plainAddr), CLAIM_AMT);
        // ERC-1155 badge minted
        assertEq(drops.balanceOf(plainAddr, uint256(CAMPAIGN_ID)), 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 39. Claim to a contract whose onERC1155Received always reverts still succeeds
    //
    // Even though RevertingReceiver correctly implements IERC1155Receiver and its
    // onERC1155Received unconditionally reverts, _update() never calls that hook,
    // so claim() completes successfully.
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_ToRevertingReceiverContract_Succeeds() public {
        _createDefaultCampaign();

        RevertingReceiver bad = new RevertingReceiver();
        address badAddr = address(bad);

        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig = _sign(signerKey, CAMPAIGN_ID, DROP_1, CLAIM_AMT, badAddr, deadline);

        // Must NOT revert — the hook is never invoked
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, badAddr, deadline, sig);

        assertEq(usdc.balanceOf(badAddr), CLAIM_AMT);
        assertEq(drops.balanceOf(badAddr, uint256(CAMPAIGN_ID)), 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 40. Claim to a re-entrant receiver contract: the outer claim succeeds and
    //     the re-entrant second claim is never attempted
    //
    // ReentrantReceiver.onERC1155Received tries to call drops.claim() again with
    // a second valid signature for DROP_2.  Because _update() never invokes
    // onERC1155Received, the callback never fires and DROP_2 is never claimed.
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Claim_ToReentrantReceiver_OnlyFirstClaimLands() public {
        _createDefaultCampaign();

        // Build a valid signature for the second (re-entrant) claim attempt
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory sig2 = _sign(signerKey, CAMPAIGN_ID, DROP_2, CLAIM_AMT, address(0), deadline);
        // sig2 will have `to` filled in once we know the receiver's address; build
        // the receiver first, then re-sign with its address as `to`.
        //
        // Deploy receiver — we must sign with its address as `to` for DROP_2.
        ReentrantReceiver reentrant = new ReentrantReceiver();

        // Re-sign DROP_2 with the receiver as `to`
        sig2 = _sign(signerKey, CAMPAIGN_ID, DROP_2, CLAIM_AMT, address(reentrant), deadline);

        // Wire the receiver: tell it which campaign/drop/sig to try to re-enter with
        reentrant.arm(drops, CAMPAIGN_ID, DROP_2, CLAIM_AMT, deadline, sig2);

        // Sign DROP_1 for the receiver as `to` (outer claim)
        bytes memory sig1 = _sign(signerKey, CAMPAIGN_ID, DROP_1, CLAIM_AMT, address(reentrant), deadline);

        // Execute the outer claim — must succeed
        drops.claim(CAMPAIGN_ID, DROP_1, CLAIM_AMT, address(reentrant), deadline, sig1);

        // Outer claim landed: USDC balance and ERC-1155 badge reflect DROP_1 only
        assertEq(usdc.balanceOf(address(reentrant)), CLAIM_AMT);
        assertEq(drops.balanceOf(address(reentrant), uint256(CAMPAIGN_ID)), 1);

        // The re-entrant DROP_2 claim was never attempted (callback never fired)
        assertFalse(drops.dropClaimed(CAMPAIGN_ID, DROP_2));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper contracts for receiver / re-entrancy tests
// ═══════════════════════════════════════════════════════════════════════════════

/// @dev A plain contract with zero ERC-1155 receiver machinery.
///      Used to verify that claim() succeeds even when `to` cannot handle
///      onERC1155Received callbacks (because _update never calls them).
contract PlainContract {
    // Intentionally empty — no IERC1155Receiver, no fallback.
}

/// @dev An IERC1155Receiver that always reverts from onERC1155Received.
///      Used to verify that the unconditional revert is never triggered because
///      _update() does not invoke the acceptance hook.
contract RevertingReceiver {
    function onERC1155Received(
        address, address, uint256, uint256, bytes calldata
    ) external pure returns (bytes4) {
        revert("RevertingReceiver: always reverts");
    }

    function onERC1155BatchReceived(
        address, address, uint256[] calldata, uint256[] calldata, bytes calldata
    ) external pure returns (bytes4) {
        revert("RevertingReceiver: always reverts");
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        // IERC1155Receiver = 0x4e2312e0
        return interfaceId == 0x4e2312e0 || interfaceId == 0x01ffc9a7;
    }
}

/// @dev A receiver that attempts to re-enter EgoDrops.claim() from
///      onERC1155Received.  Because _update() never calls that hook,
///      the re-entrant attempt is never made.
contract ReentrantReceiver {
    EgoDrops internal _drops;
    bytes32  internal _campaignId;
    bytes32  internal _dropId;
    uint128  internal _amount;
    uint64   internal _deadline;
    bytes    internal _sig;
    bool     internal _armed;

    function arm(
        EgoDrops drops_,
        bytes32  campaignId_,
        bytes32  dropId_,
        uint128  amount_,
        uint64   deadline_,
        bytes calldata sig_
    ) external {
        _drops      = drops_;
        _campaignId = campaignId_;
        _dropId     = dropId_;
        _amount     = amount_;
        _deadline   = deadline_;
        _sig        = sig_;
        _armed      = true;
    }

    function onERC1155Received(
        address, address, uint256, uint256, bytes calldata
    ) external returns (bytes4) {
        if (_armed) {
            _armed = false; // prevent infinite recursion
            _drops.claim(_campaignId, _dropId, _amount, address(this), _deadline, _sig);
        }
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, address, uint256[] calldata, uint256[] calldata, bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x4e2312e0 || interfaceId == 0x01ffc9a7;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant handler — drives realistic claim sequences then checks conservation
// ═══════════════════════════════════════════════════════════════════════════════
contract EgoDropsHandler is Test {
    EgoDrops   public drops;
    MockERC20  public usdc;

    uint256 internal _signerKey;
    address internal _creator;

    bytes32 public campaignId;
    uint64  public endsAt;
    uint128 public ghostDeposited;
    uint128 public ghostClaimed;
    uint32  public dropCounter;

    constructor(
        EgoDrops  _drops,
        MockERC20 _usdc,
        uint256   signerKey_,
        address   creator_,
        bytes32   campaignId_,
        uint64    endsAt_,
        uint128   deposit_
    ) {
        drops      = _drops;
        usdc       = _usdc;
        _signerKey = signerKey_;
        _creator   = creator_;
        campaignId = campaignId_;
        endsAt     = endsAt_;
        ghostDeposited = deposit_;
    }

    bytes32 internal constant _CLAIM_TYPEHASH =
        keccak256("Claim(bytes32 campaignId,bytes32 dropId,uint128 amount,address to,uint64 deadline)");

    bytes32 internal constant _EIP712_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function _buildDomainSeparator() internal view returns (bytes32) {
        (
            ,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            ,
        ) = IERC5267(address(drops)).eip712Domain();
        return keccak256(
            abi.encode(
                _EIP712_TYPE_HASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }

    function claimDrop(uint128 amount, uint32 recipientSeed) external {
        // Only act while the campaign is open
        if (block.timestamp >= endsAt) return;

        uint128 remaining = ghostDeposited - ghostClaimed;
        if (remaining == 0) return;

        amount = uint128(bound(amount, 1, remaining));
        dropCounter++;

        bytes32 dropId = keccak256(abi.encode("inv-drop", dropCounter));
        address to     = makeAddr(string(abi.encode("inv-rec", recipientSeed)));
        uint64 deadline = uint64(block.timestamp + 1 hours);

        bytes memory sig = _buildSig(dropId, amount, to, deadline);

        try drops.claim(campaignId, dropId, amount, to, deadline, sig) {
            ghostClaimed += amount;
        } catch {
            // ignore bounded but still-failing calls (duplicate drop, etc.)
        }
    }

    function _buildSig(
        bytes32 dropId,
        uint128 amount,
        address to,
        uint64  deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(_CLAIM_TYPEHASH, campaignId, dropId, amount, to, deadline)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _buildDomainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(_signerKey, digest);
        return abi.encodePacked(r, s, v);
    }
}

contract EgoDropsInvariantTest is Test {
    MockERC20       internal usdc;
    EgoDrops        internal drops;
    EgoDropsHandler internal handler;

    address internal owner;
    address internal creator;
    uint256 internal signerKey;
    address internal signerAddr;

    bytes32 internal constant CAMPAIGN_ID = keccak256("inv-campaign");
    uint128 internal constant DEPOSIT     = 100_000e6;
    uint64  internal          endsAt;

    function setUp() public {
        owner   = makeAddr("inv-owner");
        creator = makeAddr("inv-creator");
        (signerAddr, signerKey) = makeAddrAndKey("inv-signer");

        vm.warp(1_000_000);
        endsAt = uint64(block.timestamp + 30 days);

        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        vm.prank(owner);
        drops = new EgoDrops(address(usdc), signerAddr, "https://example.com/");

        usdc.mint(creator, DEPOSIT);
        vm.prank(creator);
        usdc.approve(address(drops), type(uint256).max);
        vm.prank(creator);
        drops.createCampaign(CAMPAIGN_ID, DEPOSIT, endsAt, false);

        handler = new EgoDropsHandler(
            drops, usdc, signerKey, creator, CAMPAIGN_ID, endsAt, DEPOSIT
        );

        targetContract(address(handler));
    }

    /// @notice The contract's USDC balance must always equal deposited - claimed
    ///         for this single non-refunded campaign.
    function invariant_USDCBalanceEqualsDepositedMinusClaimed() public view {
        uint128 expected = handler.ghostDeposited() - handler.ghostClaimed();
        assertEq(usdc.balanceOf(address(drops)), expected);
    }

    /// @notice Total claimed (ghost) never exceeds deposited.
    function invariant_ClaimedNeverExceedsDeposited() public view {
        assertLe(handler.ghostClaimed(), handler.ghostDeposited());
    }
}
