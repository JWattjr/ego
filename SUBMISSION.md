# Arc Microgrants submission: Ego

**Live deployment:** https://ego-app-six.vercel.app
**Repo:** https://github.com/JWattjr/ego
**Contract (Arc mainnet):** https://explorer.arc.io/address/0x141291cf2992a3ad4069d04a0702de78b68524b7

## Short description
Ego is a USDC wallet with fun ways to get paid, built on Arc. Organisers lock hackathon prizes and bounties on Arc, and winners claim them with just their email: no wallet or crypto needed, and Ego pays the gas. People can also hide USDC across public places as timed "Money Drops" that others hunt on a map with a compass, or share prize codes, event QR codes and puzzles. Every payout settles on Arc in about a second and comes with a collectible. Unclaimed money goes back to its owner automatically.

## What it uses Arc for
- **Programmable escrow:** the `EgoDrops` contract locks each campaign's USDC on Arc mainnet and releases it only with a short-lived EIP-712 approval from Ego's checking server. That approval covers proof of location, a code, a puzzle answer or a verified email. Unclaimed funds can only return to the creator.
- **USDC gas and sub-second finality:** Ego's relayer submits claims and pays the tiny USDC fee, so brand-new users with an empty wallet can receive money instantly. The app shows the real confirmation time.
- **Arc tooling:** the contract was written, tested (40 tests) and audited with Circle's Arc Studio.

## Why it's worth taking further
Every hackathon, bounty program and event needs to pay winners, and today that means collecting addresses, chasing people who don't have wallets, and sending transfers by hand. Ego makes "you won" a 30-second claim, and turns every winner into an Arc wallet user. Arc's own programs could pay their winners this way. Next: funded open bounties, timed Money Drop events, missions for physical events, and Swap and Earn (Circle Earn Kit) in the wallet.

## 60-second demo script
1. **Home (5 s):** the wallet with its live 3D coin, and "Prizes waiting for you".
2. **Pay winners (15 s):** lock 1 USDC for a winner's email, confirm in the wallet, and open the contract on the explorer.
3. **Claim (15 s):** Prizes → enter email → enter the 6-digit code → hold to claim → "You won 1 USDC · confirmed in 0.x s".
4. **Hide money (15 s):** tiers, tap two areas on the map, set a time window → hide.
5. **Hunt (10 s):** map → Start the hunt → compass → the claim scene with the coin dropping in.
