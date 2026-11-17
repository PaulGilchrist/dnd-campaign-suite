# Monster stat-modal header: name/type block floats far right of the new avatar (space-between distribution)

## Summary
The new header avatar in the monster stat modal (`8ebbffb8f`) added a fourth flex child to `.mc-header`, which lays out with `justify-content: space-between`. With four non-growing children the leftover ~171 px of the 642 px header is distributed as three equal gaps, so the monster name + type line now starts ~66 px to the right of the avatar (only 14 px of that is the deliberate `margin-right`) instead of hugging it, reading as a broken, disjointed header.

## Steps to reproduce
1. `npm run dev`, GM tab on `http://localhost:5173`, in **test-campaign**.
2. Encounters → search "Goblin" → Select → `Join Encounter`.
3. On the Initiative view, click the Goblin card's avatar to open the full stat block (`.mc-overlay`).
4. Observe the header: circle avatar flush left, then a large dead gap, then "Goblin / Small humanoid (goblinoid), neutral evil" floating toward the centre, with the Target select and × stranded at the right edge.

## Expected behavior
Name/type sits immediately right of the avatar (the designed 14 px gutter); the arm + close stay right-aligned — the same tight header the modal had before the avatar lane shipped.

## Actual behavior (live-measured 2026-11-16, HEAD 8ebbffb8f)
- `.mc-header` computed `justify-content: space-between`, no `gap`; card width 682, header content box 642.
- Children widths: `.mc-header-avatar` 60 (+14 margin), `.mc-header-info` 222, `.mc-header-arm` 165, `.mc-close` 24 → total 471, leaving ~171 px distributed evenly between ALL adjacent children.
- Measured avatar-right-edge → name-left-edge gap = **66 px** (≈3× the intended 14 px gutter); screenshot `qa-shots/yg-mc-header-offset.png` shows the name block visually detached from its avatar.

## Likely location
Confident: `src/components/encounter/MonsterCardModal.css` `.mc-header { display:flex; justify-content: space-between; }` combined with `MonsterCardHeader` in `src/components/encounter/MonsterCardBody.jsx` gaining the new `.mc-header-avatar` child (and the earlier `49a6c4716` `.mc-header-arm` child) — no child has `flex: 1`, so space-between spreads everything.

## Suggested fix
Make the title block absorb the slack: `.mc-header-info { flex: 1 1 auto; }` (or `margin-right: auto`), so the avatar+name group stays left-coherent while the arm and close keep right alignment. Verify with both arm faces (EB preview has no arm select — 2-child header) and with a long monster name (info must still wrap/shrink, `flex-shrink` already 1). Add a layout pin: gap `.mc-name.left − .mc-header-avatar.right` ≤ ~16 px.

## Severity
Minor UX issue — purely cosmetic, nothing misfunctions, but it visibly degrades every monster stat block opened by every GM/visitor-controller.
