# NPC with dice-formatted HP ("9 (2d8)") can never join Initiative — stat gate parses NaN

## Summary
Campaign NPCs whose `hitPoints` is stored in the D&D canonical dice format (e.g. `"9 (2d8)"`) — the exact format the NPC Stats tab itself displays and persists — fail the `npcHasStatBlock` gate because `Number("9 (2d8)")` is `NaN`. The "Add X to Initiative" chip (NPCs page) and the Sessions "To Initiative" link chip stay disabled forever with a *false* tooltip telling the GM to "Fill in AC and HP" — data that is already filled in.

## Steps to reproduce
1. In `test-campaign`, open the **NPCs** page. Marta Copperkettle exists on disk with `armorClass: 11`, `hitPoints: "9 (2d8)"` (GET `/api/campaigns/test-campaign/npcs`).
2. Observe her row: the `Add Marta Copperkettle to Initiative` button is **disabled**, tooltip: *"Fill in Marta Copperkettle's AC and HP (Stats tab) before adding to Initiative"* — although AC and HP are both present.
3. Click her row → **Stats** tab: AC input shows `11`, HP text input shows `9 (2d8)`.
4. Change the HP field to plain `9` and **Save**. Disk GET shows `hitPoints: "9"`.
5. Observe the row chip: now **enabled**.

## Expected behavior
An NPC with AC 11 and HP "9 (2d8)" is combat-ready — the dice roll *is* 9. The gate should parse the leading number (or the form should store numeric HP + separate hit dice), and the chip should be enabled.

## Actual behavior
`npcHasStatBlock` (see likely location) computes `Number.isFinite(Number("9 (2d8)"))` → `false` → gate never opens, and the tooltip misleads the GM into thinking fields are empty. Verified live: disabled with `"9 (2d8)"`, enabled after rewriting to `"9"` (same session, 2026-10-24).

## Likely location
- `src/services/encounters/npcStatBlockUtils.js:13-15` — `Number.isFinite(Number(npc.hitPoints)) && Number(npc.hitPoints) > 0` (confident; the two-leg live differential isolates this predicate).
- Consumers affected: `src/components/npcs/NPCListItem.jsx` (row chip), `src/components/sessions/Sessions.jsx:43,204` (Sessions link gate), `src/components/initiative/Initiative.jsx:263`.
- The NPC Stats tab form (free-text HP input that seeded `"9 (2d8)"` into `npcs.json`) is the producer of the failing shape.

## Suggested fix
Parse the leading integer out of the HP string before the finite check, e.g.
`const hp = Number(String(npc.hitPoints).match(/^\s*\d+/)?.[0]); return typeof npc.armorClass === 'number' && Number.isFinite(hp) && hp > 0;`
— or normalize `hitPoints` to numeric at NPC-save time (keeping the dice expression in a separate `hitDice` field, as `npcToMonsterFormat` already consumes `hit_dice` separately). Update the guard matrix in `npcStatBlockUtils.test.js:65` to cover `"9 (2d8)"`.

## Severity
Broken feature — the documented lane for adding campaign NPCs to initiative (and the Sessions planner shortcut riding it) is unreachable for any NPC saved with the standard dice-notation HP, and the UI blames empty fields that aren't empty.

## Resolution
**FIXED 2026-10-24.** Root cause confirmed as guessed: `npcHasStatBlock` ran `Number(npc.hitPoints)` over the canonical block notation `"9 (2d8)"` → NaN → gate never opened. One refinement over the original diagnosis: simply opening the gate was NOT enough — `addNPCToInitiative` wrote `maxHp/currentHp: Number(npc.hitPoints)` straight into combatSummary, so a gate-only fix would have joined Marta with **NaN HP** on the tracker. Fixed the gate AND the join consumer together.

Chose the bug file's "parse the leading number" option over save-time normalization: monsters.json stores numeric HP (which is why the EB lane never tripped), the NPC form legitimately persists dice notation, and a single read-time resolver covers all existing disk data without requiring every GM to re-save. Mirrors the established parse-or-null sibling patterns (`parseMaxHp` in prayerOfHealingService, AC leading-digit parse in `cleanNPCData`'s `'16 ac'`→16 arm). Bare dice expressions like `"6d8+2"` (no resolved total) remain gated — the existing `dice-expression HP → false` contract is preserved byte-for-byte.

Files changed:
- `src/services/encounters/npcStatBlockUtils.js` — new exported `resolveNPCHitPoints(hitPoints)`: numbers pass through, `"N"`/`"N (dice)"` (canonical block form, spaces optional) resolve to N, anything else NaN; `npcHasStatBlock` consumes it.
- `src/services/npcs/npcCombatService.js` — `addNPCToInitiative` pushes `maxHp`/`currentHp` from `resolveNPCHitPoints(npc.hitPoints)` (never NaN into the tracker).
- `src/services/encounters/npcStatBlockUtils.test.js` — guard matrix extended with `"9 (2d8)"`, `"9(2d8)"`, `' 9 (2d8 + 1) '` → true, `"0 (0d8)"`/`"9 apples"` → false; new `resolveNPCHitPoints` table (16 arms incl. zero-is-data, bare dice → NaN, non-string → NaN).
- `src/services/npcs/npcCombatService.test.js` — partial `vi.mock` extended via `importActual` (real resolver rides the join test); new arm pins dice-HP join lands `maxHp: 9, currentHp: 9` numeric.

Dual-ruleset check: no 2024 twin of this module (NPC combat-readiness lane is ruleset-agnostic) — nothing mirrored.

Verification:
- **Live repro (pre-fix):** NPCs page chip `Add Marta Copperkettle to Initiative` disabled, title "Fill in Marta Copperkettle's AC and HP (Stats tab)…" with disk `"9 (2d8)"` + AC 11 intact; Sessions editor `To Initiative` chip likewise disabled + false tooltip. Repro steps 4–5 (rewrite HP to plain `"9"`) were NOT executed to avoid mutating disk — the post-fix proof below is stronger (passes on the pristine dice value).
- **Live re-verify (post-fix):** chip enabled with correct tooltip, stat badge renders; clicked chip → no-weapons confirm declined (add anyway, unarmed) → combatSummary creature row `{ac: 11, maxHp: 9, currentHp: 9, initiative: "15"}` via change-data GET (numeric, no NaN); initiative roll logged (`roll | Marta Copperkettle | initiative | total 15`); Sessions editor chip enabled `title "Add Marta Copperkettle to initiative"`; NPC editor "Save & Add to Initiative" (third `npcHasStatBlock` consumer) now renders.
- **Sanity (gate still bites):** temp NPC `ZZ Gate Sanity NPC` (AC 12, HP empty) → chip disabled with truthful tooltip; deleted after check.
- **Tests:** `npcStatBlockUtils.test.js` + `npcCombatService.test.js` 133 pass; touched folders (`services/encounters`, `services/npcs`, `components/npcs`, `components/sessions`) 1365 pass; `components/initiative` 427 pass; `npm run lint` exit 0, zero warnings.
- **Cleanup:** temp NPC deleted, repro session deleted, Admin cleared change-data (cs incl. Marta's test join) + campaign log; `npcs.json` byte-identical to original (`"9 (2d8)"` untouched — never rewritten).
