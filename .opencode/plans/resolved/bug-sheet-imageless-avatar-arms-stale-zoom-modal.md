# Bug: Pressing the sheet's image-less avatar "button" arms a hidden zoom-modal flag that self-opens on the NEXT image-bearing character

## Summary
On a character sheet whose avatar has no image, the avatar still renders as `role=button tabIndex=0` and its activation handler sets `showAvatarModal = true` — but the render guard (`showAvatarModal && playerStats.imagePath`) honestly shows nothing. The armed flag survives the sidebar character switch (CharSummary keeps its local state), so opening any character that DOES have an `imagePath` pops the avatar-zoom modal spontaneously, with no user gesture on that sheet.

## Steps to reproduce
1. On localhost (`npm run dev` pair), in `test-campaign`, open the **AasimarTest** character sheet (sidebar) — its `imagePath` is `""`, so the avatar renders as the initials disc `div.avatar-wrapper.avatar-initial[role=button][tabindex=0]`.
2. Focus the avatar and press **Enter**. Observe: nothing opens (zero popup — but the state flag is now armed).
3. Click **ElderPaladin** in the sidebar (this fixture has `imagePath: images/ElderPaladin.png`).
4. Observe: the `AvatarModal` zoom overlay opens BY ITSELF showing `…/test-campaign/images/ElderPaladin.png` (naturalWidth 494) — no click was made on the ElderPaladin sheet.
5. Escape closes it; a second A→E switch does NOT re-open (the dismiss consumed the flag) — the popup is once-per-armed-press.

Control probes (live, run AB 2026-11-17): switch A→E with the avatar focused but NO key pressed → overlay stays closed; press a non-activating key (`x`) instead → closed. Activation press is the cause.

## Expected behavior
An advertised button that does nothing on an image-less avatar is already poor affordance hygiene (compare `NpcAvatar`, which only renders `role/tabIndex` when `onClick` is actually wired — commit 963f569d9), and its side-effect must not leak into a DIFFERENT character's sheet. Either gate `onClick={() => setShowAvatarModal(true)}` behind `playerStats.imagePath` (no button tier when nothing can zoom), or reset `showAvatarModal` when `playerStats` changes characters.

## Actual behavior
The Enter press fires `onClick` unconditionally (`CharSummary.jsx:679`: `<AvatarImage … onClick={() => setShowAvatarModal(true)} />`), the modal render is guarded at `:747` (`{showAvatarModal && playerStats.imagePath && …}`), and nothing clears the flag on character change — so the next sheet with an image mounts with `showAvatarModal` already true and the portal-less overlay (`.avatar-modal-overlay`, z-index 1000, full-viewport) immediately veils the whole page until dismissed.

## Likely location
Confident: `src/components/char-sheet/char-summary/CharSummary.jsx` — `showAvatarModal` state (line ~519), unconditional `onClick` on `AvatarImage` (~679), and the `showAvatarModal && playerStats.imagePath` render guard (~747). The initial-branch keydown that fires it is `src/components/common/AvatarImage.jsx:15`.

## Suggested fix
Cheapest: pass `onClick={playerStats.imagePath ? () => setShowAvatarModal(true) : undefined}` so the initial disc renders no button tier and arms nothing (mirrors the NpcAvatar conditional-tier idiom). Optionally also add a `useEffect` resetting `showAvatarModal` when `playerStats.name` changes, to defend any future multi-guard modals. `AvatarModal.test.jsx` / `CharSummary-*-test.jsx` family can pin the gated face.

## Severity
Minor UX issue — no data is touched and the popup is dismissable, but a spontaneous full-viewport modal when switching characters is a genuine UI-state-integrity face and the image-less avatar is a dead button until it fires.

## Resolution (fix run, 2026-11-17)

**Status: FIXED.** The diagnosis in this file was confirmed exactly against the live code.

### What was actually wrong
As guessed: `CharSummary.jsx` passed `onClick={() => setShowAvatarModal(true)}` to `AvatarImage`
unconditionally, so image-less avatars advertised `role=button tabIndex=0` (via AvatarImage's own
tier) yet the modal render is double-guarded `showAvatarModal && playerStats.imagePath` — the press
armed the flag with zero visible effect, and nothing cleared it on character change (CharSummary
keeps its local state across sidebar switches), so the next image-bearing sheet self-opened the
full-viewport zoom.

### Fix (both suggested layers applied — each closes a distinct leak)
`src/components/char-sheet/char-summary/CharSummary.jsx`:
1. Gated the button tier: `onClick={playerStats.imagePath ? () => setShowAvatarModal(true) : undefined}`
   (~line 685) — mirrors the established conditional-tier idiom already used by the sibling consumers
   `NPCFormModal.jsx:151` and `MonsterCardBody.jsx:205` (`avatarPath ? … : undefined`). An image-less
   disc now renders no button tier and arms nothing.
2. Added a `React.useEffect` resetting `showAvatarModal` when `playerStats.name` changes (~line 520) —
   closes the residual leak the onClick gate alone can't: opening a zoom and switching characters
   (e.g. via keyboard Tab to the sidebar behind the scrim) used to leave the flag armed on hide.

No server, rules, or dual-ruleset surface touched (shared component; 5e and 2024 sheets ride the same file).

### Verification
- **Live repro pre-fix (:5173, HEAD unchanged):** AasimarTest avatar `role=button tabindex=0` → Enter →
  zero overlay (armed) → ElderPaladin switch → `.avatar-modal-overlay` self-opened on
  `images/ElderPaladin.png` (naturalWidth 494). Exact bug-file face reproduced.
- **Live re-verify post-fix:** AasimarTest avatar now `role=null tabindex=null focusable=false`; Enter
  press leaves overlay closed; A→E switch stays closed (zero self-open).
- **Adjacent sanity:** ElderPaladin avatar keeps `role=button tabindex=0`; Enter opens the zoom
  (naturalWidth 494); Escape closes with focus restored to `avatar-wrapper`; A→E round trip after
  dismiss stays closed. Console: 0 errors.
- **New regression test:** `src/components/char-sheet/char-summary/CharSummary-AvatarZoomArming.test.jsx`
  (3 tests: no-tier/arms-nothing on image-less, tier+zoom on image-bearing, open zoom never survives a
  same-instance character switch to the next image-bearing sheet). Red/green proven: against the
  pre-fix code 2/3 fail (both broken faces), post-fix 3/3 pass.
- **Folder runs:** `src/components/char-sheet/char-summary/` 55 files / 699 tests pass;
  `src/components/common/` 68 files / 710 tests pass. `npm run lint` clean (zero warnings).
- **Exit hygiene (test-campaign):** tab closed, closed-tab two-pass headless admin clears —
  change-data `{}`, log `[]`; `AasimarTest.json` md5 `3bfe7eca…` and `ElderPaladin.json` md5 `6e4341e4…`
  byte-exact to the AB baseline pins (opened read-only).

