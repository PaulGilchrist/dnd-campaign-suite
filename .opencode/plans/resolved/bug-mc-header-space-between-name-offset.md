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

## Resolution
FIXED 2026-11-16 (fix run). Diagnosis confirmed verbatim: `.mc-header` is
`display:flex; justify-content:space-between` and after `8ebbffb8f` gained the
avatar it had four non-growing children, so the leftover ~171 px spread into
three equal gaps. Live repro before the fix (test-campaign on :5173, Goblin
board card avatar click): avatar right 694 → `.mc-name` left 759.8 = **65.8 px**
gap; computed `justify-content: space-between`, no `gap`, info/arm both
`flex: 0 1 auto`.

Fix (root cause, one rule): `src/components/encounter/MonsterCardModal.css`
gained

```css
.mc-header-info { flex: 1; min-width: 0; margin-right: 14px; }
```

The info block now absorbs the slack so the avatar+name group stays left-
coherent with its designed 14 px gutter while arm + close stay right-aligned.
`flex: 1` + `min-width: 0` is the repo's established header-row idiom
(Settlements.css service/npc rows, CampaignBuilder row-main, Map.css) — no new
architecture. The `margin-right: 14px` mirrors the avatar gutter so the arm
(arm face) or close (EB-preview face) never sits flush on the name text once
space-between has no slack left to distribute.

Files:
- `src/components/encounter/MonsterCardModal.css` (new `.mc-header-info` rule)
- `src/components/encounter/MonsterCardModal.header-layout.test.jsx` (NEW —
  regression pin; jsdom does no layout, so it pins the exact normalized CSS
  declarations the layout depends on, mirroring the sibling CSS-pinning
  convention in `CreatureBadge.test.jsx` / `VictoryBanner.no-capture.test.jsx`)

Verification (all live on :5173, test-campaign, arm face via Initiative avatar
click after EB Join):
- Post-fix measured rects: avatar right 694 → name left 708 = **14.0 px** gap;
  close right 1274 = header right 1294 − 20 padding → flush right; arm→info
  gutter 14 px, arm and close right-aligned.
- EB-preview face (Encounters → search Goblin → row `View details for Goblin`
  button → 3-child header, no arm): gap also **14.0 px**, close flush right.
- Long-name stress (DOM text swap only, zero writes): long unbreakable+multi-
  word name wraps to multiple lines inside the info box
  (`scrollWidth === clientWidth`, no horizontal overflow), close stays flush
  right.
- Adjacent behavior intact: arm mousedown inside `.mc-header-arm` does not
  close the modal (stopPropagation holds); `.mc-close` closes.
- Tests: new file 5/5 pass; `npx vitest run src/components/encounter/MonsterCard`
  → 290 files / 1592 tests pass; `npm run lint` clean (zero warnings).
- Exit hygiene: closed-tab two-pass headless clears GET-verified change-data
  `{}` + log `[]` + overlays `[]`.

Playbook-worthy pitfall observed: a `page.evaluate(() => el.click())` dispatch
on the Initiative `.creature-avatar` does NOT open the stat modal (0
`.mc-overlay`); a trusted `page.mouse.click` at the avatar's rect centre does.
Playwright-mcp rides of this lane must use trusted clicks on the card avatar.
