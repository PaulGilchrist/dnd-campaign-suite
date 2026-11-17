# Visitor monster-avatar zoom is trapped in the initiative card — misplaced image, unreachable Close

## Summary
On a non-localhost (LAN/visitor) tab, clicking a monster avatar in the Initiative tracker opens the new full-size `AvatarModal`, but the modal mounts **inside** the `.creature-card` subtree. The card's base CSS `transform: scale(1.0)` makes the card a containing block and stacking context for `position: fixed` descendants, so the "full-screen" overlay is anchored to the card's box instead of the viewport: the dark backdrop never covers the top-left of the screen, the image is off-centre and painted behind the neighbouring cards, and the × close button lands underneath the card row — there is **no visible way to close the popup** (only an undocumented Escape keypress works). Two user-reported symptoms, one root cause.

## Steps to reproduce
1. `npm run dev` (lock may include test-campaign), GM tab on `http://localhost:5173`, in **test-campaign**.
2. Encounters → search "Goblin" → tick `input.monster-checkbox[aria-label="Select Goblin"]` → `Join Encounter` (board now has a Goblin with a bestiary image).
3. Open a second, isolated browser context tab and navigate to the LAN URL `http://<host-ip>:5173/` (so the Host header is non-localhost → honest visitor). Select `test-campaign`; the pruned sidebar (Initiative/Inventory/Log/Map/Music/Rules) confirms visitor status. Go to Initiative.
4. Click the Goblin card's avatar (`.creature-card … .creature-avatar`).
5. Observe: the zoom image is not centred, the dark backdrop covers only the area right/below the goblin card, and adjacent initiative cards paint OVER the image. Try to close: click where the tiny × renders — nothing happens; click the dark area — nothing happens. Only pressing Escape closes it.

## Expected behavior
The avatar zoom is a viewport-level full-screen popup (as it behaves on the GM lane inside `.mc-card`, and as it does from the character sheet): backdrop dims the screen, image centred, × button on top and clickable.

## Actual behavior (live-proved 2026-11-16, LAN-context tab, HEAD 8ebbffb8f)
- Goblin `.creature-card` computed `transform: matrix(1, 0, 0, 1, 0, 0)` (the base rule `transform: scale(1.0)`), `position: relative`, `opacity: 0.9`.
- `[data-testid="avatar-modal-overlay"]` `getBoundingClientRect()` = **x:378, y:354, w:1548, h:997** on a 1728×997 viewport — anchored to the card, not the viewport (the overlay's own CSS `top:0; left:180px` resolves against the card box).
- Image rect [753, 453, 798×798] — off-centre, sits UNDER the neighbouring creature cards.
- `.avatar-modal-close` rect [1517, 413, 34×28]; `document.elementFromPoint(closeCenter)` → `DIV.creature-avatar` (a card, not the button). Playwright `locator('.avatar-modal-close').click()` times out ("element … intercepts pointer events" family) and the popup stays open.
- Backdrop click: does not close (AvatarModal has no backdrop lane at all — pre-existing, but fatal combined with the occluded ×).
- Escape: DOES close (the document-level keydown listener is unaffected by containment) — an invisible affordance; a mouse-only visitor is effectively stuck.
- Screenshot captured: dark region starts mid-screen, giant goblin face bleeding behind the initiative card row, × stranded over an adjacent card.
- GM lane is NOT affected: clicking the avatar opens the stat modal, whose `MonsterAvatarZoom` mounts inside `.mc-card` (no transform/filter/zoom ancestors — grep of `MonsterCardModal.css` shows only `text-transform`), and the full dismissal matrix there passed.
- CONTROL PROBE (same LAN tab, same build): after the GM assigns control (`select[aria-label="Assign who controls Goblin"]` → AasimarTest), the visitor's avatar click correctly routes to the delegated stat modal (delegation lane of `8ebbffb8f` intact), and the zoom opened from THAT surface is healthy: overlay rect **[180, 0, 1548, 997]** (viewport-minus-sidebar, as designed), `elementFromPoint(× centre)` → `avatar-modal-close` (clickable), Escape closes the zoom while the stat modal stays. The defect is specific to the card-subtree mount.

## Likely location
Confident:
- `src/components/initiative/CreatureCard.jsx` → `CardAvatar`: the new visitor branch renders `<AvatarModal>` as a sibling inside the card fragment (mounts inside `.creature-card`).
- `src/components/initiative/Initiative.css` → `.initiative .creature-card { transform: scale(1.0); opacity: 0.9; }` — a non-`none` transform + opacity < 1 both create containing block + stacking context; z-index:1000 on the overlay cannot escape the card's stacking context, so later-sibling cards paint above it and `.creature-card.active` (scale 1.3, z-index 10) is even worse.

## Suggested fix
Render the visitor `AvatarModal` out of the card subtree — React `createPortal(…, document.body)` at the `CardAvatar` mount site is the minimal change (mirrors how `GmStatBlockModal` lives high in `Initiative.jsx`). Alternatives: hoist the `showImageModal` flag to Initiative and mount one shared `AvatarModal` there; or portal inside `AvatarModal` itself (fixes any future host with a transformed ancestor, but touches the char-sheet lane — re-test that consumer). Bonus hardening while in there: give `AvatarModal` a backdrop-click dismiss lane (currently ×/Escape only) so a misplacement can never mean "no way to close".
Regression pin: LAN-context tab, click monster avatar → assert overlay rect == viewport-sized (x≈180,y=0 after the left offset), `elementFromPoint(× centre)` resolves to `.avatar-modal-close`, click closes.

## Severity
Broken feature — the headline purpose of `8ebbffb8f` (read-only tabs get a viewable full-size avatar) renders mangled on exactly the tabs it was built for, with no clickable dismissal.
