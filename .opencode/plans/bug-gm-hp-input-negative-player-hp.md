# GM HP input on a PC card persists negative current HP and leaves an inconsistent dead state

## Summary
The Initiative GM HP clamp (d40e6d917) covers the monster lane only. On a PLAYER card, committing a negative value (e.g. −50) persists straight into the character bucket as `currentHitPoints: -50`, writes an `hp_change` row stamped `threshold:'dead'` yet `isUnconscious:false`, and triggers no downed/death-save handling. Even committing exactly 0 logs `threshold:'dead'` with `isUnconscious:false` for a player. The row contradicts itself, and the card visually marks the PC unconscious (`creature-unconscious` renders from `currentHp <= 0`) while nothing downstream treats the PC as down.

## Steps to reproduce
Starting state: test-campaign, localhost tab on the Initiative view, some PC at full HP (e.g. AasimarTest, max 143).

1. On the AasimarTest card, fill `input[aria-label="AasimarTest current HP"]` with `-50` and press Enter.
2. Read the input echo; then `GET /api/campaigns/test-campaign/AasimarTest` (unwrap one level) and check `currentHitPoints`.
3. `GET /api/campaigns/test-campaign/log` and read the last `hp_change` row for AasimarTest.
4. CONTROL A (monster lane, same tab): fill the Goblin's HP input with `-3` + Enter → echo snaps to `0` (clamped).
5. CONTROL B (player lane valid value): fill `50` + Enter → normal row, `threshold` null.
6. Then commit exactly `0` on the PC and re-read the row + any death-save modal.
7. Restore the PC's HP (fill max + Enter).

## Expected behavior
Consistent with the monster lane's floor (which mirrors applyDamage's death floor): the player commit should clamp at 0 — or, if negatives are deliberately allowed as a GM shorthand, the dead state must be coherent: `isUnconscious:true`, card/consumers agree, and the PC death-save lane engages (it appears after damage KO, MA-1977 style).

## Actual behavior
- Input echo stays `-50`; bucket persists `currentHitPoints: -50` (the sheet/runtime HP truth).
- Row written: `{targetName:'AasimarTest', sourceName:'GM HP override', delta:-193, currentHp:-50, maxHp:143, isUnconscious:false, threshold:'dead'}` — "dead" threshold but not flagged unconscious.
- No death-save modal appears on any tab (checked `.dsp-modal`/`.dsp-overlay`, both tabs, for −50 and for exactly 0).
- Committing `0` on the PC behaves the same (`threshold:'dead'`, `isUnconscious:false`).
- Monster control clamps −3→0 correctly; the asymmetry is PC-lane-only.
- Cross-tab: the −50 value live-mirrors to the second tab's input (so the corrupt value propagates through SSE).

## Likely location
Confident (code corroborates the live behavior): `src/components/initiative/createCreatureHandlers.js` — line ~128 `const newValue = isPlayer ? committedHp : clampMonsterCommit(creature, committedHp, isMaxEdit)` exempts players from the ENTIRE [0, max] clamp (comment says the exemption is for temp-HP max overshoot), and line ~83 `isUnconscious: !isPlayer && newHp <= 0` hard-excludes player overrides from the flag while `resolveOverrideThreshold` (line ~56) still stamps `dead` for `newHp <= 0`. `CreatureCard.jsx:619` independently treats `currentHp <= 0` as unconscious for styling, so the UI and audit disagree. The server `/combatSummary` POST staying free-write is documented-by-design (GM escape hatch), so the fix belongs in the UI commit lane.

## Suggested fix
In `handleCreatureHpChange` (createCreatureHandlers.js), keep the player lane unclamped at the TOP (temp HP overshoot stays legit) but floor the commit at 0 for players too: `isPlayer ? Math.max(0, committedHp) : clampMonsterCommit(...)`. If owner wants to keep negatives reachable, at minimum make the dead-state coherent: `isUnconscious: newHp <= 0` (drop the `!isPlayer`), and route the PC through whatever sets the card/board down state (and consider opening the death-save modal like the damage lane does). Check the sheet's HP display path (`currentHitPoints` consumers) for anything that mis-renders negatives, and re-pin `initiative.test.jsx` HP-commit pins.

## Severity
Data integrity risk — a mistyped minus sign silently writes impossible negative HP into the canonical runtime HP key, marks the row dead without flagging the creature, and bypasses the death-save adjudication the whole combat pipeline depends on.
