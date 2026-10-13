# Ego — shared interface

Ego is fun ways to move money on Arc: USDC is locked in an escrow contract and released when someone meets a condition. The conditions are being at a place, entering a code, scanning an event QR code, or solving a puzzle.

This file is the contract between the three parts. Change it only by agreement.

| Part | Owner | Folder |
|---|---|---|
| Escrow contract | Claude Code (written and audited with Arc Studio) | `/contracts` |
| Checking server (API) | Claude Code | `/server` |
| Mobile web app | Codex | `/app` |

Chain: **Arc mainnet** (chain id `5042`, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`).
USDC on Arc: ERC-20 interface at `0x3600000000000000000000000000000000000000`, **6 decimals**. Verify this against the Arc docs before deploying. Arc's native gas balance uses 18 decimals; never mix the two up.
All money amounts in this file are **USDC base units (6 decimals)** as decimal strings, e.g. `"1000000"` = 1 USDC.

---

## 1. Contract: `EgoDrops`

```solidity
// Creator locks USDC for a campaign. endsAt = unix seconds; after it, unclaimed USDC can go back to the creator only.
function createCampaign(bytes32 campaignId, uint128 amount, uint64 endsAt, bool onePerWallet) external;

// Anyone may submit (the claimer's own wallet via Gas Station, or a relayer).
// Valid only with an EIP-712 signature from the Ego signer over:
//   Claim(bytes32 campaignId, bytes32 dropId, uint128 amount, address to, uint64 deadline)
// Reverts if: signature invalid or expired, campaign ended, drop already claimed,
// wallet already claimed in a onePerWallet campaign, or not enough left in the campaign.
// Pays `amount` USDC to `to` and mints one collectible (ERC-1155, tokenId = uint256(campaignId)) to `to`.
function claim(bytes32 campaignId, bytes32 dropId, uint128 amount, address to, uint64 deadline, bytes calldata sig) external;

// After endsAt: sends (deposited - claimed) to the campaign creator. Anyone may call; the money only ever goes to the creator.
function refund(bytes32 campaignId) external;

function campaigns(bytes32 campaignId) external view returns (address creator, uint128 deposited, uint128 claimed, uint64 endsAt, bool onePerWallet, bool refunded);
function dropClaimed(bytes32 campaignId, bytes32 dropId) external view returns (bool);

event CampaignCreated(bytes32 indexed campaignId, address indexed creator, uint128 amount, uint64 endsAt);
event Claimed(bytes32 indexed campaignId, bytes32 indexed dropId, address indexed to, uint128 amount);
event Refunded(bytes32 indexed campaignId, address indexed creator, uint128 amount);
```

Admin: the owner can rotate the signer address and set the collectible metadata URI. **The owner has no function that moves campaign money.**

---

## 2. Server API (`/server`, JSON over HTTPS)

Exact drop locations, codes and puzzle answers live only on the server. They are never on-chain and never sent to the app before a successful check.

### Types
```ts
type DropKind = "map" | "code" | "qr" | "puzzle";

type DropPublic = {
  campaignId: string;      // 0x… bytes32
  dropId: string;          // 0x… bytes32
  kind: DropKind;
  amount: string;          // USDC base units
  title: string;           // e.g. "Polo Park drop"
  hint?: string;           // puzzle text or clue
  creatorName: string;
  endsAt: number;          // unix seconds
  claimed: boolean;
  // map drops only:
  approx?: { lat: number; lng: number; radiusM: number }; // fuzzed ~150 m circle
  distanceM?: number;      // from the caller's position, if lat/lng was sent
  exact?: { lat: number; lng: number };                   // only when the caller is within 30 m
};

type Campaign = {
  campaignId: string; title: string; creatorName: string; creator: string; // creator wallet
  total: string; remaining: string; endsAt: number; onePerWallet: boolean;
  drops: number; dropsLeft: number; createTx?: string;
};
```

### Endpoints
| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/drops/nearby` | `?lat=&lng=` | `DropPublic[]` (map drops within ~5 km) |
| `GET /api/campaigns/:campaignId` | — | `Campaign & { drops: DropPublic[] }` |
| `POST /api/campaigns` | `{ title, creatorName, endsAt, onePerWallet, drops: [{ kind, amount, title, hint?, lat?, lng?, code?, answer? }] }` | `{ campaignId, total, deposit: { to, amount } }` (the creator then calls `createCampaign` on-chain) |
| `POST /api/campaigns/:campaignId/confirm` | `{ txHash }` | `Campaign` (the server checks the on-chain deposit, then activates the drops) |
| `POST /api/claims` | `{ campaignId, dropId, to, proof }` where `proof` is `{ lat, lng, accuracyM }` for map, `{ code }` for code/qr, `{ answer }` for puzzle | `{ amount, deadline, sig }`. Errors: `too_far`, `wrong_code`, `already_claimed`, `campaign_ended`, `rate_limited` |
| `POST /api/claims/:dropId/submitted` | `{ txHash }` | `{ confirmedMs, explorerUrl }`, where `confirmedMs` is measured from the Arc receipt (for the "Confirmed in 0.4 s" screen) |

Errors are `{ error: string, message: string }` with HTTP 4xx.

---

## 3. App flows (Codex)

1. **Home / wallet**: balance, send, receive (QR), collectibles, a "drop nearby" banner.
2. **Map**: nearby drops as fuzzed circles → drop sheet → "Start the hunt".
3. **Hunt**: distance + warmer/colder + direction; the exact spot appears within 30 m.
4. **Claim**: hold to claim → `POST /api/claims` → submit `claim()` from the user's wallet → `POST …/submitted`.
5. **Found**: "You found 1 USDC · from {creator} · confirmed in {confirmedMs} · {dropsLeft} still hidden" + collectible card + explorer link.
6. **Code / QR / puzzle**: enter code, scan QR, or answer a riddle → same claim flow.
7. **Create**: amount, split into drops, kind, place drops on the map or generate codes, end time → deposit → share link or codes.

Wallets: Circle user-controlled wallets (email login) on `ARC`, with gas sponsored by Gas Station. Until those are wired up, build against fake data that matches the types above exactly.

Safety rules shown in the app: drops are small ($1–$5), daytime only, public places only, and no exact spot is shown until you're within 30 m. A "report this location" button removes a drop.
