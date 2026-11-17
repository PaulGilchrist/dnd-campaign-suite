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
