# Ego UI verification

Verified locally on 13 October 2026. Mock mode; no real funds or mainnet transactions.

## Automated

- `npm run build`: production compilation, TypeScript and prerendering pass on Next.js 16.4.0.
- `npm test`: 15 tests pass across API/money and hold-button regression suites.
- `npm audit`: zero vulnerabilities after updating the test tooling.
- Manifest returns HTTP 200 with standalone display, start URL `/`, and valid 192/512px icon responses.
- Impeccable mechanical detector: `[]` findings for routes/components.

## Browser walkthrough

390px mobile and 1440px desktop wallet renders inspected; no horizontal overflow at 390px. Original coin geometry, self-hosted fonts, OSM attribution and uncertainty circles visible.

| Flow | Evidence |
|---|---|
| Wallet | Fake 12.5 USDC starting balance, send/receive, nearby banner, collected campaign cards |
| Map | Three initial nearby circles/list entries; claimed drops disappear; reporting hides a location |
| Hunt | Simulated position starts at 502 m; ten 50 m steps reduce to 2 m; exact marker appears only in range |
| Claim | Keyboard hold submits after 1.2 seconds; a 200 ms hold cancels; invalid code yields expected error and can be corrected |
| Found | Map 1 USDC, code 2 USDC, event QR 1 USDC and puzzle 3 USDC claims all reached confirmed receipt/collectible screens |
| Entry | QR manual code accepted; complete event link can be pasted before IDs resolve; case-insensitive puzzle answer accepted |
| Create | Three 1-USDC code drops funded, deposit confirmed and individual share links generated; Enter key places map drop at centre |
| Send/receive | Demo 1-USDC transfer completed; real generated address QR displayed with explicit fake-address warning |

## Independent review

Finish reviewer inspected nine route/viewport captures and source. Three findings were corrected: pre-resolution QR fallback, hold cancellation on focus/disabled transitions, keyboard-accessible map placement. Verdict pass marked all three resolved and recommended shipping at mock-prototype scope. Documentation records the implemented visual system.

## Limits and integration notes

Live camera scanning, GPS and compass sensors need a real HTTPS mobile-device test. No wallet SDK, live checking-server integration, Vercel deployment or mainnet transaction was performed. Home-screen install metadata was checked; installation itself was not performed. No offline claiming is promised.

Shared interface updated externally during implementation: report endpoint and app-measured confirmation timing are adopted. The app does not edit INTERFACE.md. Campaign detail's `drops` array versus Campaign's numeric `drops` remains an interface ambiguity; see README.md.

Review captures are local, gitignored under `.impeccable/review/`.
