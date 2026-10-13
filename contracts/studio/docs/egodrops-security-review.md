# EgoDrops Security Review

**Contract:** `contracts/EgoDrops.sol`  
**Review level:** max (Critical + High + Medium + Low)  
**Date:** 2026-10-13

---

## Summary

Both the rule-corpus review and the functional review came back **clean** with no material findings. Slither found 4 items; 1 was fixed (Informational), 3 remain as Low-severity inherent design constraints. The contract-tester surfaced 1 suspected bug (dead-code check order), which was fixed and all 37 tests pass.

---

## Review Findings

### Rule-corpus review
**Result:** No material findings.

### Functional / adversary review
**Result:** No material findings.

**Assumptions noted:**
- The deployment passes Arc USDC (`0x3600000000000000000000000000000000000000`) as the `usdc_` constructor argument; correctness depends on deploy-time configuration (which was done correctly).
- The project accepts owner-controlled signer rotation (`setSigner`) as the intended trust model.

---

## Slither Static Analysis

| # | Severity | Check | Description | Disposition |
|---|---|---|---|---|
| 1 | Low (Medium confidence) | `timestamp` | `createCampaign` uses `block.timestamp` to validate `endsAt` | Inherent — no fix possible |
| 2 | Low (Medium confidence) | `timestamp` | `claim` uses `block.timestamp` to check deadline and `endsAt` | Inherent — no fix possible |
| 3 | Low (Medium confidence) | `timestamp` | `refund` uses `block.timestamp` to check `endsAt` | Inherent — no fix possible |
| 4 | Informational (High confidence) | `unindexed-event-address` | `SignerChanged(address,address)` had no indexed parameters | **Fixed** — both addresses now `indexed` |

**Note on timestamp findings:** Arc Testnet (and Arc Mainnet) use sub-second finality. Validator `block.timestamp` manipulation is bounded to a few seconds — far less than any meaningful campaign duration (hours/days). These are accepted design constraints.

---

## Test Results

37/37 tests pass. Coverage includes:

| Category | Tests | Result |
|---|---|---|
| Happy path claim + ERC-1155 mint | 2 | PASS |
| Signature replay (same dropId) | 1 | PASS |
| Wrong signer | 1 | PASS |
| Tampered `to` address | 1 | PASS |
| Tampered `amount` | 1 | PASS |
| Expired deadline | 1 | PASS |
| Claim after `endsAt` | 2 | PASS |
| `onePerWallet=true` blocks second claim | 1 | PASS |
| `onePerWallet=false` allows second claim | 1 | PASS |
| Overdraw beyond deposit | 1 | PASS |
| Refund before `endsAt` | 1 | PASS |
| Refund pays creator only, correct amount | 2 | PASS |
| Double refund blocked | 1 | PASS |
| Claim after refund blocked | 1 | PASS |
| `setSigner` by non-owner blocked | 1 | PASS |
| Old signer rejected after rotation | 1 | PASS |
| New signer accepted after rotation | 1 | PASS |
| Constructor validation | 3 | PASS |
| Campaign creation validation | 4 | PASS |
| `setURI` by non-owner blocked | 1 | PASS |
| Fuzz: total paid ≤ deposited (256 runs) | 1 | PASS |
| Invariant: claimed ≤ deposited (128k calls) | 1 | PASS |
| Invariant: contract USDC balance correct (128k calls) | 1 | PASS |

### Bug fixed during testing

**Issue:** In `claim()`, the `CampaignRefunded` check came after the `CampaignEnded` check. Since `refund()` is only callable after `endsAt`, any refunded campaign is always past `endsAt`. The result was that `CampaignRefunded` was dead code — claims on refunded campaigns always reverted with `CampaignEnded` instead.

**Fix:** Swapped the two checks so `campaign.refunded` is tested before `block.timestamp >= campaign.endsAt`.

---

## Deployment

| Field | Value |
|---|---|
| Chain | Arc Testnet |
| Address | `0x3cae4443c78bd6c260bd709e70e0c65ecba39cb7` |
| Tx hash | `0xa95905cce916bca1f34a72420202f781cfdd84c91b3910479884402508513dd5` |
| Explorer | https://explorer.testnet.arc.io/address/0x3cae4443c78bd6c260bd709e70e0c65ecba39cb7 |
| USDC | `0x3600000000000000000000000000000000000000` (Arc Testnet) |
| Initial signer | `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42` (platform deployer — rotate via `setSigner` before use) |

---

## Audit Provenance

| Subagent | Dispatched | Files audited | Corpus rules cited |
|---|---|---|---|
| solidity-auditor | yes | 1 | none |
| functional-auditor | yes | 1 | — |

---

## Post-fix review (balanced, 2026-10-13)

**Change:** `_mint(to, uint256(campaignId), 1, "")` replaced with `_update(address(0), to, ids, values)` to bypass the ERC-1155 receiver acceptance check.

**Rule-corpus review:** No material findings.

**Functional review:** No material findings. Confirmed: `_update` still emits `TransferSingle`; `ReentrancyGuard` blocks any `_update` override hook from re-entering; USDC transfer remains before the mint.

**New tests (40/40 pass):**
- Claim to a contract with no receiver hooks: succeeds, USDC received, badge minted.
- Claim to a contract whose `onERC1155Received` reverts: succeeds (hook never called).
- Claim to a re-entrant receiver: outer claim succeeds, second drop never touched.

---

> **Note:** This max-depth review is best-effort against Arc Studio's internal rule corpus. It is NOT a substitute for a paid third-party audit before mainnet deployment.
