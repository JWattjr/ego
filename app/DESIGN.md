---
name: Ego
description: Calm mobile-first USDC discovery in Enugu.
colors:
  blue: "#1760dd"
  blue-hover: "#0d4fc5"
  blue-light: "#edf3ff"
  blue-light-hover: "#dfeaff"
  ink: "#142b43"
  muted: "#526779"
  paper: "#f6f8fb"
  white: "#fff"
  line: "#dce4ed"
  sage: "#eaf4ed"
  green: "#275e43"
  red: "#9e303b"
  error-surface: "#fff0f1"
  input-border: "#bccbdc"
  placeholder: "#62778c"
  demo-ink: "#245292"
  collectible-map: "#e8effd"
  collectible-code: "#e8f3ed"
  collectible-qr: "#eef0ff"
  collectible-puzzle: "#f6efdf"
typography:
  display:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "39px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  subheading:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"DM Sans", sans-serif'
    fontSize: "16px"
    lineHeight: 1.6
  label:
    fontFamily: '"DM Sans", sans-serif'
    fontSize: "13px"
    fontWeight: 600
  button:
    fontFamily: '"DM Sans", sans-serif'
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  money:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "46px"
    fontWeight: 700
    letterSpacing: "-0.04em"
rounded:
  compact: "8px"
  control: "12px"
  surface: "16px"
  dialog: "20px"
  sheet: "24px 24px 0 0"
  pill: "100px"
  circle: "50%"
spacing:
  compact: "8px"
  control-gap: "10px"
  action-gap: "12px"
  grid-gap: "14px"
  inset: "16px"
  card-inset: "20px"
  page-inset: "24px"
  form-gap: "22px"
  section: "36px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
  button-secondary:
    backgroundColor: "{colors.blue-light}"
    textColor: "{colors.blue}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.blue-light-hover}"
  button-text:
    textColor: "{colors.blue}"
    padding: "6px 0"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 15px"
  collectible-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.surface}"
  safety-card:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.green}"
    rounded: "{rounded.surface}"
    padding: "18px"
  demo-chip:
    backgroundColor: "{colors.blue-light}"
    textColor: "{colors.demo-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 9px"
  bottom-navigation:
    backgroundColor: "{colors.white}"
    textColor: "{colors.muted}"
    padding: "12px 12px calc(12px + env(safe-area-inset-bottom))"
  coin:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.circle}"
    size: "80px"
---

# Design System: Ego

## Overview

**Creative North Star: "A clear city-walk companion"**

Ego uses a clean, light, calm, premium visual world with generous spacing and an original blue coin motif. Chalk-white surfaces, deep ink typography and cobalt money cues make a small mobile utility feel composed and approachable. Quiet sage surfaces frame safety and confirmed outcomes.

Wallet-first is a confirmed product decision. The coin is a reusable original geometric signature across the wallet, drop discovery and collectible artwork. Illustrative balances, creators and collectibles remain visibly identified as demo content; visual polish must not imply live funds.

**Key Characteristics:**

- Light tonal surfaces with restrained depth.
- Manrope headings and money paired with DM Sans body and controls.
- Generous mobile spacing and persistent thumb-reachable navigation.
- Original blue coin geometry, circular uncertainty and quiet sage safety cues.

This record extracts the implementation in `app/globals.css`, `app/layout.tsx`, `components` and the App Router routes. Frontmatter is normative for the included primitives; the sidecar records motion, breakpoints and component previews. Its tonal ramps are synthesized preview aids, not implemented color tokens. No new visual direction is introduced.

## Colors

Cobalt carries action and money, while cool paper, white and deep ink provide the calm foundation.

### Primary

- **Cobalt blue:** primary actions, active navigation, coin art, numeric emphasis and focus outlines.
- **Deeper cobalt:** enabled primary-button hover.
- **Pale cobalt wash:** secondary buttons, nearby invitation, selected drop types and demo context; its stronger wash is the secondary-button hover.
- **Demo blue ink:** readable demo labels and explanatory panels.

### Neutral

- **Deep ink:** headings, principal body content and dark camera canvas.
- **Quiet slate:** supporting copy, inactive navigation and metadata.
- **Cool paper:** page background and navigation hover.
- **White:** fields, collectible cards, QR paper, sheets and dialogs.
- **Soft line:** list separators, navigation edge and neutral control borders.
- **Field border / placeholder:** the stronger field-specific neutral pair.

### Semantic and artwork roles

- **Sage / forest:** safety panels and confirmation receipts. These are status roles, not a second promotional accent.
- **Rose error / pale rose:** alert text and its surface.
- **Collectible map, code, QR and puzzle surfaces:** distinguish drop artwork with pale blue, sage, lilac and warm paper. They do not replace cobalt as the action color.

**The Money Cue Rule.** Keep cobalt attached to actions, value and the original coin; preserve sage for safety and confirmation.

## Typography

**Display Font:** self-hosted Manrope, sans-serif fallback.
**Body Font:** self-hosted DM Sans, sans-serif fallback.

The layout imports DM Sans weights 400, 500 and 600 and Manrope weights 600 and 700 from local Fontsource packages. Headings are balanced; money and distances use tabular numerals.

### Hierarchy

- **Display:** wallet greeting; grows to 46px on desktop and contracts to 34px at the narrow breakpoint.
- **Headline:** standard page heading; desktop page headings become 40px. The confirmed-find heading uses 40px mobile / 48px desktop.
- **Title:** section heading. Sheet headings use a deliberate 26px override.
- **Subheading:** compact card headings; collectible titles use 15px or 20px in the large variant.
- **Body:** root size and page description; paragraphs use the body leading. Supporting copy intentionally varies from 11–15px. Page descriptions are limited to 42ch.
- **Label:** form labels. Compact metadata and navigation use 10–13px; do not apply a 16px minimum to all metadata.
- **Button:** principal controls; text actions use 14px and compact hunt controls use 12px.
- **Money:** wallet value; becomes 56px desktop and 40px at the narrow breakpoint. Radar distance uses 52px, while drop rows use 20px.

**The Readable Field Rule.** Preserve 16px field text and tabular numerals for monetary and distance readings.

## Layout

The mobile-first frame fills at least 100dvh and centers within 1440px. Standard pages have a 620px maximum width, 24px horizontal insets, and 128px bottom clearance for the fixed navigation. Form, create and entry pages use 580px; the map uses 850px. These are outer container widths, including padding.

At 900px and above, the frame becomes a 300px context rail plus flexible content. Page insets become 40px; the wallet container becomes 660px, forms/create/entry/hunt/found become 640px, and map pages become 1000px. The top bar grows from 82px to 96px. Navigation remains fixed within the content column and switches its links from vertical icon-label stacks to horizontal rows. The map grows from 350px to 420px.

At 360px and below, horizontal insets become 18px, greeting/value/coin sizes shrink, map tools wrap, and the drop-kind grid becomes one column. Amount columns remain two columns with a tighter 10px gap. Wallet actions, hunt actions and collectibles use two-column grids; forms stack with 22px gaps.

Spacing is contextual rather than a strict seven-step scale: common gaps are 8–16px, card insets 16–24px, section starts 36px, and form gaps 22px. Preserve safe-area padding in mobile bottom navigation and sheets.

**The Pocket Width Rule.** Keep form and wallet content constrained; use the desktop rail to add context without stretching mobile controls.

## Elevation & Depth

Depth comes primarily from white and pale tonal surfaces rather than floating-card shadows. The coin has an inset dark-blue edge that makes its circular geometry tactile. Map legends have a small ambient shadow. Modal separation is a translucent ink scrim; ordinary cards remain flat.

### Shadow Vocabulary

- **Coin edge:** inset -5px -7px 0 rgba(0, 38, 115, 0.13); large and small variants use proportional offsets.
- **Map legend:** 0 2px 8px #142b4314.
- **Overlay scrim:** #142b4340, used behind sheets and dialogs.

**The Quiet Depth Rule.** Use tonal grouping for ordinary surfaces; reserve inset depth for the coin and ambient shadow for map overlays.

## Shapes

Surfaces are softly curved (16px), fields and principal controls tighter (12px), compact tabs and point selectors smaller (8px). Centered dialogs use 20px corners; the mobile sheet has a 24px top curve and square bottom, becoming a centered 20px panel on desktop. Pills are confined to small status/receipt controls. Coins, orbit lines, radar rings and uncertainty legends repeat a circular silhouette. Cards and camera/map frames clip their artwork.

## Components

### Buttons

Primary and secondary controls are confident, softly curved and compact: minimum 52px height, 14px 20px padding and a 10px icon gap. Enabled hover deepens their assigned color; pressed controls move down 1px. Background and transform transitions last 0.16s. Disabled buttons use 0.48 opacity and a not-allowed cursor. Text actions have a 44px minimum height and underline on hover; circular icon buttons are 44px square and receive a pale-blue hover.

Keyboard focus uses a 3px cobalt outline with 4px offset globally. Fields override the offset to 2px.

### Chips

The network/demo pill uses 11px semibold text and 6px 9px padding. The persistent demo variant says “Demo · fake USDC.” Sage receipts use 12px type and 8px 12px padding. Drop-kind selectors are rectangular controls, with blue border and wash when selected; compact point selectors invert to cobalt and white when selected.

### Cards / Containers

Collectible cards use white, clipped 16px corners, 160px artwork and 16px copy insets. The large variant uses 220px artwork and 20px copy insets. Safety cards use sage and forest, with 18px padding or 16px in the compact variant. Nearby invitations use pale cobalt and 20px 16px padding. Share cards use white with 20px padding. List rows use separators rather than enclosing boxes.

### Inputs / Fields

Fields use white, a stronger neutral 1px border, 12px corners, 14px 15px padding, minimum 52px height and 16px text. Labels stack with 9px gaps; textareas resize vertically and start at 110px high. Amount fields place the USDC suffix within a shared bordered surface. Checkboxes remain native with a cobalt accent. Errors appear in a separate rose alert with optional retry action; there is no implemented field-specific invalid-border or disabled-field visual variant to invent.

### Navigation

The four persistent destinations are Wallet, Explore, Find and Drop. Inactive links use slate; active links use cobalt and `aria-current="page"`. Links have a 46px minimum height and pale-paper hover. Entry tabs use a pale neutral track, white selected surface and cobalt selected text. Mobile navigation respects the bottom safe area.

### Coin and collectibles

The original CSS coin uses a blue disc, white inner orbit, dollar glyph and blue notches. Normal/small/large sizes are 80/42/120px; wallet and rail placements override size. The decorative coin is hidden from assistive technology. Confirmed find presentation applies a 0.7s turn with cubic-bezier(0.16, 1, 0.3, 1); claim success precedes the celebration.

### Hold, feedback and overlays

Hold-to-claim is a full-width 58px control with translucent white progress. It requires an uninterrupted 1.2-second hold by pointer, Space or Enter; release, cancellation, focus loss, window blur and hidden-page state cancel progress. Busy text reads “Confirming your find…” and disables the button. Progress is functional JavaScript feedback, not a CSS animation.

Loading uses a blue breathing dot (1.2s ease-in-out) with a status region; errors use alerts. Hunt status remains announced, and location/orientation/camera actions are explicit controls. Map uncertainty appears as circles; exact location is conditional on the distance check. Dialogs and sheets have named modal semantics and focus management.

The reduced-motion media query removes CSS animations, transitions and smooth scrolling globally. It leaves the coin's static tilt and functional hold progress intact. Compass rotation is otherwise a 0.2s ease-out transition.

## Do's and Don'ts

### Do:

- **Do** retain the clean light surfaces, generous mobile spacing and original blue coin geometry.
- **Do** pair self-hosted Manrope headings and money with DM Sans body and controls.
- **Do** preserve visible focus, labelled fields, live feedback and safe-area clearance.
- **Do** keep demo identification visible and celebration contingent on confirmed claim state.
- **Do** keep safety and recovery information adjacent to location-based actions.
- **Do** preserve reduced-motion CSS and cancelable hold behavior.

### Don't:

- **Don't** copy another app's coin artwork or visual identity.
- **Don't** stretch phone forms to fill desktop space.
- **Don't** introduce heavy floating shadows on ordinary cards.
- **Don't** represent illustrative balances or collectibles as live funds.
- **Don't** animate the decorative coin when reduced motion is requested.


User-supplied visual/motion reference: see [DESIGN-REFERENCE.md](./DESIGN-REFERENCE.md). It records the provided 23-second concept clip separately from the implemented tokens above.
