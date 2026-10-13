// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract EgoDrops is ERC1155, EIP712, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(bytes32 campaignId,bytes32 dropId,uint128 amount,address to,uint64 deadline)");

    struct Campaign {
        address creator;
        uint128 deposited;
        uint128 claimed;
        uint64 endsAt;
        bool onePerWallet;
        bool refunded;
    }

    IERC20 public immutable usdc;
    address private _signer;

    mapping(bytes32 => Campaign) public campaigns;
    mapping(bytes32 => mapping(bytes32 => bool)) public dropClaimed;
    mapping(bytes32 => mapping(address => bool)) private _walletClaimed;

    event CampaignCreated(bytes32 indexed campaignId, address indexed creator, uint128 amount, uint64 endsAt);
    event Claimed(bytes32 indexed campaignId, bytes32 indexed dropId, address indexed to, uint128 amount);
    event Refunded(bytes32 indexed campaignId, address indexed creator, uint128 amount);
    event SignerChanged(address indexed oldSigner, address indexed newSigner);

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

    constructor(address usdc_, address signer_, string memory uri_)
        ERC1155(uri_)
        EIP712("EgoDrops", "1")
        Ownable(msg.sender)
    {
        if (signer_ == address(0) || usdc_ == address(0)) revert ZeroAddress();

        usdc = IERC20(usdc_);
        _signer = signer_;
    }

    function createCampaign(bytes32 campaignId, uint128 amount, uint64 endsAt, bool onePerWallet) external {
        if (campaigns[campaignId].creator != address(0)) revert CampaignAlreadyExists();
        if (amount == 0) revert InvalidAmount();
        if (endsAt <= block.timestamp) revert InvalidEndsAt();

        campaigns[campaignId] = Campaign({
            creator: msg.sender,
            deposited: amount,
            claimed: 0,
            endsAt: endsAt,
            onePerWallet: onePerWallet,
            refunded: false
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit CampaignCreated(campaignId, msg.sender, amount, endsAt);
    }

    function claim(bytes32 campaignId, bytes32 dropId, uint128 amount, address to, uint64 deadline, bytes calldata sig)
        external
        nonReentrant
    {
        if (to == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert SignatureExpired();

        Campaign storage campaign = campaigns[campaignId];
        if (campaign.creator == address(0)) revert CampaignNotFound();
        if (campaign.refunded) revert CampaignRefunded();
        if (block.timestamp >= campaign.endsAt) revert CampaignEnded();
        if (dropClaimed[campaignId][dropId]) revert DropAlreadyClaimed();
        if (campaign.onePerWallet && _walletClaimed[campaignId][to]) revert WalletAlreadyClaimed();
        if (campaign.claimed + amount > campaign.deposited) revert InsufficientFunds();

        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, campaignId, dropId, amount, to, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(digest, sig);
        if (recoveredSigner != _signer) revert InvalidSignature();

        dropClaimed[campaignId][dropId] = true;
        if (campaign.onePerWallet) {
            _walletClaimed[campaignId][to] = true;
        }
        campaign.claimed += amount;

        usdc.safeTransfer(to, amount);

        // Mint the collectible WITHOUT the ERC-1155 receiver acceptance check so
        // that a non-receiver contract address for `to` never blocks the USDC payout.
        // OZ v5 _update does no callback; _mint/_updateWithAcceptanceCheck does.
        uint256[] memory ids = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        ids[0] = uint256(campaignId);
        values[0] = 1;
        _update(address(0), to, ids, values);

        emit Claimed(campaignId, dropId, to, amount);
    }

    function refund(bytes32 campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        if (campaign.creator == address(0)) revert CampaignNotFound();
        if (block.timestamp < campaign.endsAt) revert CampaignNotEnded();
        if (campaign.refunded) revert AlreadyRefunded();

        uint128 amount = campaign.deposited - campaign.claimed;
        campaign.refunded = true;

        usdc.safeTransfer(campaign.creator, amount);

        emit Refunded(campaignId, campaign.creator, amount);
    }

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();

        address oldSigner = _signer;
        _signer = newSigner;

        emit SignerChanged(oldSigner, newSigner);
    }

    function setURI(string calldata newUri) external onlyOwner {
        _setURI(newUri);
    }

    function signer() external view returns (address) {
        return _signer;
    }
}
