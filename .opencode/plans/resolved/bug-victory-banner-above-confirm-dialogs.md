# Bug: victory banner card floats above confirmation dialogs and swallows their buttons

## Summary
The post-Clear victory banner mounts at `z-index: 1300` while the shared confirmation-modal tier (`modal-shell-overlay`, and the Initiative clear confirm) sits at `z-index: 1000`. When the banner is still up (it persists across clicks/views until click-dismissed) and the user opens ANY confirmation dialog, the `.victory-card` renders ON TOP of the dialog and silently intercepts pointer events on whatever sits at screen center — including the dialog's own confirm button. Improve 29e67520e made the banner *scrim* click-through (`pointer-events:none`), but the card lane above modals was left open.

## Steps to reproduce
1. Dev pair (`npm run dev` or locked server + `npx vite`), localhost, campaign **test-campaign**, Initiative view with any board mounted.
2. Click `Clear` → confirm `Yes, Clear Board` in the dialog (first pass works; a victory banner + freshly re-seeded board appear).
3. Click `Clear` AGAIN while the (still undismissed) banner is up → the Clear-Initiative confirmation dialog opens.
4. Try to click the dialog's `Yes, Clear Board` button (centered in the viewport, behind the banner card).

## Expected behavior
A modal confirmation dialog must be the topmost interactive layer while open — either render the celebration banner above the dialog overlay and let it intercept deliberately, or keep it BELOW modals so it cannot capture dialog buttons. The user should be able to confirm immediately.

## Actual behavior
Playwright's hit-test (identical to a human's dead click):
`<div class="victory-card" title="Click to dismiss">…</div> from <div role="status" class="victory-banner">…</div> subtree intercepts pointer events` — the `Yes, Clear Board` click retries until timeout. The dialog looks open and its button looks enabled, but clicks land on the invisible-ish celebration card over it (which itself dismisses the banner on click, so the SECOND attempt works — silently, no error anywhere).

## Likely location
Confident on the numbers: `src/components/initiative/Initiative.css` `.victory-banner` `z-index: 1300` (~line 1382) vs `src/App.css` `.modal-shell-overlay` `z-index: 1000` (~line 601). The clear confirm (`role="dialog"`, `.delete-confirm-btn`) renders inside the modal-shell tier. Guess: many other modal tiers (sp-overlay, maps-manager-modal) likely also sit ≤1300 and share the hazard.

## Suggested fix
Drop `.victory-banner` below the modal overlay tier (e.g. z-index between page content and 1000) — the banner is ambient celebration, not a blocking modal, and already dismisses on card click. Alternatively bump the modal-shell overlay above 1300 (and audit other modal tiers) so no transient overlay can ever cover a dialog. Add a CSS/DOM ordering note next to the 29e67520e comment: scrim click-through only solves the SCRIM; the card must not outrank dialogs.

## Severity
Minor UX issue — no data risk (the second click after banner-dismiss works), but a modal button silently dead-clicking is confusing and matches the exact complaint pattern 29e67520e was filed for.

## Resolution
**FIXED 2026-11-08** — diagnosis in the bug file confirmed exactly, live.

- **Repro witness (pre-fix):** in test-campaign, first Clear → confirm (banner up, computed `z-index: 1300`, scrim `pointer-events: none`, card `auto`). Second Clear with the banner undismissed: `document.elementFromPoint(center of "Yes, Clear Board")` resolved `DIV.victory-card[title="Click to dismiss"]` (`closest('.victory-banner')` true) while `.modal-shell-overlay` computed `z-index: 1000`; a real mouse click on the button dismissed the **banner** and left the dialog open — the silent dead-click.
- **What was wrong:** the celebration banner outranked the whole modal tier. Full z-index audit: page chrome ≤100 (sidebar/party inventory fixed 100) · first dialog tier **200** (dice-result `popup-overlay`, sheet sub-modals, dice tray drawer) · primary modal tier **1000** (`.modal-shell-overlay`, condition picker, avatar/monster-card/maps-manager/wizard modals) + inner layers 1100 · banner **1300** (the hazard) · `TvExitButton` 1400 (deliberate always-reachable corner pin) · adjudication prompts 2000–2100 (save/concentration/death-save prompts, CampaignReloadNotice).
- **Fix (minimal):** dropped `.initiative .victory-banner` to **z-index: 150** in `src/components/initiative/Initiative.css` — an ambient-celebration slot above page chrome but below the *lowest* dialog tier (200), so no popup, modal-shell, or prompt can ever sit under the card (a 950-slot would still have swallowed z-200 dice popups' Done buttons). Tier map documented in a comment next to the existing 29e67520e scrim comment, per the bug file's ask. No shared CSS (App.css) touched; TvExitButton/prompt tiers untouched.
- **Regression test:** `src/components/initiative/VictoryBanner.modal-tier.test.jsx` (house CSS-parse pattern from `VictoryBanner.no-capture.test.jsx`) pins banner z < `.popup-overlay` (200), < `.modal-shell-overlay` (1000), > `.sidebar` (100). New file 4/4 pass; full `src/components/initiative/` suite 84 files / 644 tests pass; `npm run lint` zero warnings.
- **Live re-verify:** fresh load → test-campaign → Initiative → Clear → confirm (single click) → banner up at z **150** → Clear again → hit-test on the confirm button resolves `BUTTON.delete-confirm-btn` (button itself, banner still up) → ONE real mouse click lands: dialog closes, board clears. Adjacent faces: banner still displays and card-click dismisses with no dialog open; screenshot shows the dialog fully above the dimmed banner card. Admin clear at exit: change-data `{}` + log `[]` GET-verified, no leftover banner/overlays.
