# Ego

**A USDC wallet with fun ways to get paid, built on Arc.**

Ego turns programmable money into things people actually enjoy:

- **Prizes and bounties.** An organiser locks prize money on Arc once and lists the winners' emails. Each winner claims with their email, with no wallet or crypto needed up front. Anything unclaimed goes back to the organiser automatically.
- **Money Drops.** Someone hides USDC across public places for a set time window. People hunt it on a map with a compass, and claim it when they're within 30 m.
- **Codes, event QR codes and puzzles.** Giveaways people claim with a code, a scan at a venue, or the answer to a riddle.
- **A real wallet** for what you win: send, receive, and (next) swap and earn.

Live app: **https://ego-app-six.vercel.app** · API: https://ego-server.vercel.app · Arc mainnet, chain 5042

"Ego" means *money* in Igbo. The first test city is Enugu, Nigeria, but Ego works anywhere.

## Why Arc

| Ego needs | Arc gives |
|---|---|
| Prize money that's provably there before anyone claims it | USDC locked in a contract on-chain, visible on the explorer |
| Instant, believable payouts | Sub-second deterministic finality (our mainnet test: about 1.8 s from tap to receipt, network round trips included) |
| Claims for people with no crypto | Gas is paid in USDC, so Ego's relayer pays a fraction of a cent per claim for the winner |
| Predictable costs for organisers | Low, dollar-denominated fees |

## How it works

```
 Organiser wallet ──approve + createCampaign──▶  EgoDrops contract (Arc mainnet)
                                                     ▲            │ claim(): pays USDC + mints a collectible
 Ego app (Next.js PWA)                               │            ▼
   ├─ Hide money / Pay winners / Codes ──▶ Ego API ──┤      Finder / winner wallet
   └─ Hunt / Prizes / Codes ─── proof ──▶ (Vercel)   │
                                          ├─ checks the proof (location ≤ 30 m, code, answer, verified email)
                                          ├─ signs an EIP-712 claim approval (short-lived)
                                          └─ relayer submits claim() and pays gas
```

- **Contract `EgoDrops`**: [`0x141291cf2992a3ad4069d04a0702de78b68524b7`](https://explorer.arc.io/address/0x141291cf2992a3ad4069d04a0702de78b68524b7). It holds each campaign's USDC and pays a claim only with a valid signature from the Ego signer, once per drop (and once per wallet if the creator chooses). After the end time, `refund()` can only send the unclaimed balance back to the creator. Each claim also mints an ERC-1155 collectible. The owner can rotate the signer, but has **no function that moves campaign money**.
- **API** (`/server`): Vercel functions with Upstash Redis. It checks proofs, signs approvals, relays claims, sends email codes, and keeps an inbox of prizes per email.
- **App** (`/app`): a Next.js installable web app with a real-time three.js 3D coin, a compass hunt, the claim scene, and browser-wallet connection on Arc via viem.

## Security model (honest version)

- **Audited contract.** Written and reviewed with Circle's Arc Studio: 40 Foundry tests (unit, fuzz and invariant) plus Slither. Findings are in [`contracts/studio/docs/egodrops-security-review.md`](contracts/studio/docs/egodrops-security-review.md). The collectible mint can never block a USDC payout.
- **Secrets stay server-side.** Exact drop locations, codes and puzzle answers never go on-chain or to the app before a successful check. Prize recipients are stored only as SHA-256 fingerprints of their emails; plain emails are kept briefly, only to send the "you won" message.
- **Email ownership** is proven with a 6-digit code: rate-limited, 5 tries, expires in 10 minutes. The result is an HMAC-signed session.
- **Location limits.** GPS can be spoofed on a rooted phone, so map claims are only as strong as the device's location. Mitigations: claims need ≤ 30 m distance and ≤ 50 m accuracy, rate limits apply, public drops are capped at **5 USDC**, distances are rounded, and exact spots appear only within 30 m. Bigger money goes through email-verified prizes (capped at 10,000 USDC each).
- **Safety.** Drops are only for public places in daylight. Anyone can report a location, which hides the drop.

## Run it locally

```bash
# app (demo mode works with no backend)
cd app && npm install && npm run dev

# server (needs .env.local; see server/.env.example)
cd server && npm install && npm test && npx vercel dev

# contract tests (Foundry)
cd contracts/studio && forge test
```

Checks: `npm test` and `npx next build` in `/app`; `npm test` and `npx tsc --noEmit` in `/server`.

## Credits

The map hunt's UX was inspired by the "Money Drops" concept video by Matteo ([@matteodotsui](https://x.com/matteodotsui)). Ego's code, 3D coin and visuals are original. Map data © OpenStreetMap contributors.
