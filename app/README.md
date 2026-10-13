# Ego mobile web app

This folder is a standalone Next.js App Router / TypeScript / Tailwind application. Set **Root Directory = `app`** in Vercel. No files outside this folder are owned by the UI.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

## Routes

- `/`: wallet, send/receive links, nearby banner, collectibles.
- `/map`: OpenStreetMap/react-leaflet approximate circles and drop sheet.
- `/hunt/[dropId]?campaignId=...`: GPS watch, distance, warmer/colder, compass, exact spot within 30 m and hold-to-claim.
- `/found/[dropId]`: receipt, remaining drops, collectible and explorer link.
- `/enter/code`, `/enter/qr`, `/enter/puzzle`: proof entry with shared claim sequence. Real links include campaignId/dropId; QR links also carry the code.
- `/create`: split, condition, public location/code/riddle, expiry, deposit, confirmation and share.
- `/wallet/send`, `/wallet/receive`: send form and real generated address QR.

## Server switch

All checking-server calls are in `lib/api.ts`. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_USE_MOCKS=false` and optionally `NEXT_PUBLIC_API_BASE_URL` to the checking-server origin. Rebuild after changing public environment variables. There are no invented wallet endpoints. Location reports use the endpoint added by the server owner in the updated interface. A cross-origin server must allow the app origin and credentials.

`DropPublic` and `Campaign` exactly mirror section 2 of `../INTERFACE.md`; the interface is unchanged. Its campaign-detail return type is written `Campaign & { drops: DropPublic[] }`, but `Campaign.drops` is a number. JSON cannot contain both under one key. The app isolates this ambiguity as `Omit<Campaign, "drops"> & { drops: DropPublic[] }` for GET detail, deriving the count from its array. POST confirmation still returns Campaign with a numeric count. Server owner should confirm that interpretation before integration.

Every amount is a decimal string of six-decimal USDC base units. Integer splitting uses BigInt and preserves every base unit. Fixture campaign/drop IDs are bytes32 hex strings. Never treat Arc native gas units as ERC-20 USDC units.

## Mock walkthrough

Fake wallet starts with 12.5 USDC. All balances, creators, places and receipts are demonstration data; actual locations must be reviewed for public access and safety before launch. Mock state persists on this browser. Demo code: `EGOENUGU`; event QR: `POLO2026`; puzzle answer: `tomorrow`.

For desk testing use `npm run dev`, select a map drop and choose **Start simulated walk**, then **Walk 50 m closer**. The simulator is gated by development mode AND USE_MOCKS; it is absent from production builds and never sends simulated coordinates to the real server. Exact spots stay absent from public mock responses outside 30 m. The mock module necessarily contains fictional proof fixtures; those are not real location/code secrets. Remove mock fixtures from a production real-server build if secrecy of unused demonstration data is required.

Hold claim with pointer or Space/Enter for 1.2 seconds; release cancels. Authorization, wallet submission and receipt checking are distinct steps. Receipt retries reuse the submitted transaction. Confirmation time is measured by the app from submission to receipt; the checking-server response contains only explorerUrl. Mock transaction hashes are illustrative, so live explorer links show no real receipt.

## Integration points

`TODO(wallet)` marks balance/collectibles, claim submission, approve/deposit and send. No wallet SDK is installed. With mocks off, these functions stop explicitly rather than pretending to send funds. Connect Circle user-controlled wallets on ARC and Gas Station at these points.

Location reporting immediately hides the drop on this device. With mocks off, reports call POST /api/drops/:dropId/report and hide the drop only after the server accepts the report. Privacy rules are driven by the checking server, not client GPS. GPS spoofing prevention, daylight checks, rate limits and accurate receipt verification remain server responsibilities.

Camera, orientation, geolocation and clipboard permissions are requested only by user action. QR camera requires HTTPS or localhost; manual entry remains available. A compass arrow requires an absolute heading; otherwise the map and clue remain usable. Outside 30 m its direction targets only the approximate area.

## Home-screen installation

Next.js serves `/manifest.webmanifest`, with standalone display and original 192/512px icons plus an Apple touch icon. Install through the browser's Add to Home Screen / Install App menu on HTTPS. No service worker or offline transaction claim is implemented; claiming requires a connection. Leaflet displays mandatory OpenStreetMap attribution.
