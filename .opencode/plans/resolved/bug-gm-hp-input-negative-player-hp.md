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

## Summary
GM HP card input on a PLAYER lane persisted negative commits into `currentHitPoints`, logged a self-contradicting `hp_change` row (`threshold:'dead'` yet `isUnconscious:false`), and never engaged the death-save lane. Now the player commit floors at 0 (mirroring applyDamage's death floor), the row is coherent (`isUnconscious: newHp <= 0` for both lanes), and an alive→down GM override resets the death-save counters and opens the death-save prompt on every tab — the same adjudication the damage-lane KO performs.

## Resolution
**FIXED.** Reproduced live first: −50 on AasimarTest echoed −50, bucket persisted `currentHitPoints:-50`, row `{delta:-193, currentHp:-50, threshold:'dead', isUnconscious:false}`, card rendered `creature-unconscious`, zero `.dsp-overlay` on either −50 or a healthy→0 commit. The bug file's diagnosis was confirmed against code and the fix follows its primary suggestion (clamp at 0) PLUS the coherence requirements.

Root cause (both confirmed and completed):
- `createCreatureHandlers.js` line ~128 exempted players from the ENTIRE clamp → now `isPlayer ? Math.max(0, committedHp) : clampMonsterCommit(...)` — ceiling stays unclamped (temp-HP overshoot is legitimate sheet state), floor mirrors `applyDamage` :473/:491 `Math.max(0, oldHp − damage)`.
- `logManualHpOverride` line ~83 `isUnconscious: !isPlayer && newHp <= 0` → `isUnconscious: newHp <= 0`, byte-mirroring `logDamageApplication` (`applyDamage` :1252, no player exclusion).
- NEW gap closed beyond the file's guess: the GM override lane never engaged the death-save adjudication. `writePlayerHp` now mirrors the damage lane's alive→down crossing (`handlePlayerZeroHpAndConcentration` + `logDamageApplication` :1258 reset): on `oldHp > 0 && newValue <= 0` it resets `deathSaves`/`deathFailures` and `sendDeathSavePrompt(campaignName, {promptId: utils.guid(), targetName})` — the exact sibling pattern (13 senders across the codebase). The symmetric revive-across-0 clear already existed in `writePlayerHp`.
- Display/echo lane (the file missed this half): `CreatureHp.jsx` `CurrentHpInput.onBlur` only rewrote the input value for monsters, so the −50 echo lingered. Player lane now floors negatives at 0 and echoes 0 (monster `[0, effectiveMax]` clamp byte-unchanged).

Files changed:
- `src/components/initiative/createCreatureHandlers.js` (floor + coherent row + death-save prompt on drop)
- `src/components/initiative/CreatureHp.jsx` (player echo floors at 0)
- `src/components/initiative/createCreatureHandlers.gm-hp-death-floor.test.js` (NEW regression, 7 tests: floor, dead-row coherence, prompt engages on alive→0 (incl. exactly 0), down→down silent never re-prompts, revive clears, monster control has NO prompt)
- `src/components/initiative/createCreatureHandlers.hp-clamp.test.js` (re-pinned the "player lane untouched" negative pass-through pin to the floored contract; added `sendDeathSavePrompt` mock key)
- `src/components/initiative/CreatureHp.test.jsx` (re-pinned player blur: 99 still passes through, −5 → commit 0 + echo "0")

Dual-ruleset: `createCreatureHandlers.js`/`CreatureHp.jsx` are ruleset-agnostic UI lanes (both `applyDamage` twins already floor at 0) — no 2024 twin change needed.

Verification:
- Unit: new test 7/7; `npx vitest run src/components/initiative` 66 files / 528 tests green; `npm run lint` zero warnings; `no-timers-guard` OK.
- Live re-run of the repro in test-campaign (:5173, header verified): −50 commit → echo snaps `0`, bucket `currentHitPoints: 0`, `deathSaves:[false,false,false]`, row `{delta:-143, currentHp:0, threshold:'dead', isUnconscious:true}`, `.dsp-modal` opens naming "AasimarTest must make a Death Saving Throw". Restore to 143 revived and the queued prompt voided on Roll (no counter writes), modal closed. Control B (50): plain row, threshold `bloodied` (correct 143→50 crossing), `isUnconscious:false`, no modal. Control A (EB-joined Goblin −3): echo 0, cs `currentHp:0`, row `isUnconscious:true` + threshold dead, NO death-save prompt (monster death model intact).
- Cleanup: tab closed, admin clear-change-data + clear-log, GET-verified two-pass: change-data `{}`, log `[]`, combatSummary null, zero HP stamps residue; server log shows only the boot-time migrate-image-paths lock line (pre-existing), zero denials from this run.
