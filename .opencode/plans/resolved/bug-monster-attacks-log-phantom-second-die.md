# Every monster-card attack roll logs a phantom second d20 — `rolls:[a,b]` with `mode:"normal"` (total = first die) on OA presses AND plain presses, GM and visitor tabs alike

## Summary

The monster-card attack lane appends a second d20 to every attack roll and persists it in the `roll` log row even when NO advantage/disadvantage source exists: the row reads `rolls:[a,b], mode:"normal"` with `total` = the FIRST die and the second die silently ignored (the DM-facing popup shows only one die). This violates the ledger law every audit this season has pinned ("mode is the ONLY adv/dis truth; `rolls:[a,b]` = 2d20 pool") — a `normal`-mode row must carry exactly one die. Reproduced on Opportunity-Attack chip presses (both tabs, prone/clean/Speedy movers) and on a PLAIN Bite chip press with zero markers armed.

## Steps to reproduce

1. In test-campaign, EB-join a Wolf (or any monster). No markers, no conditions, enforcement irrelevant.
2. On the GM tab (localhost:5173, Initiative): arm the Wolf card target-select → ElderPaladin; open the Wolf stat-block; press the Bite `[data-kind=attack]` chip.
3. `GET /api/campaigns/test-campaign/log` → newest `roll` row (`rollType:"attack"`): `rolls:[15,16], mode:"normal", total:15` — two dice for a normal-mode attack; the popup displayed only "d20 15 +4".
4. OA faces (same shape, more evidence): curl-seed `pendingOAs` `{Wolf:{defender:'Wolf',mover:'ElderPaladin',promptId:'…'}}`, press the `oa` chip with the mover fully clean → `rolls:[4,6] mode:"normal" total:4`; with the mover PRONE → `rolls:[15,15] mode:"normal"` (see notes); from a delegated LAN-visitor tab → `rolls:[18,11]` / `[15,10]` / `[18,17]` all `mode:"normal"` total = first die.
5. Contrast: sheet-lane PC normal attacks log a single die (canonical rows all season, e.g. DF/DG ledgers).

Live-proved 2026-11-10 (run GB): six monster-attack roll rows, ALL with the extra die; zero conditions, zero markers on the plain face.

## Expected behavior

A `mode:"normal"` attack roll must log exactly one d20 (`rolls:[n]`). A second die should appear only when an advantage/disadvantage source exists, and then with an honest `mode` + provenance chip (the Speedy face below is the correct-shape example: `rolls:[14,1] mode:"disadvantage"` + "Disadv (EvasiveFighter has Agile Movement (Speedy)…)" chip + matching `ability_use`-style attribution row).

## Actual behavior

The extra die is rolled and recorded on every monster-card attack press. Because `total` keeps tracking the FIRST die, gameplay math is (apparently) unaffected — but the shared log/audit truth is wrong for every monster attack, and any future ledger check that infers adv/dis from `rolls.length` (§82 law) is poisoned. Popup hygiene is fine (shows one die on normal).

## NOTES for the fixer (adjacent findings from the same evidence matrix)

- **Prone-target advantage on the monster lane was UN-RIDDEN, not proven missing** (GB correction): the prone-control OA logged `mode:"normal"`, but the face was honestly inert — the monster-lane target-conditions feed is `extractConditionKeys(target)` (the combatSummary row, `MonsterCardModal.jsx:2642`), and my rig stamped `activeConditions` into the TARGET'S RUNTIME BUCKET, which that lane never reads. A valid adv face needs the condition on the target's cs row (or a PC-sheet press, whose lane does read runtime conditions — prone-adv there is witnessed in the sheet lane). The Speedy "disadvantage-WINS" observation was therefore adv=0 + dis=1 and is CORRECT: `getNetAttackMode` (`conditionEffects.js`) nets equal counts to `'normal'` (RAW), and `applySpeedyOaPenalty` only ever adds count, never forces the mode. The GA unit-pinned net-NORMAL cancel law stands — its live face just needs a cancel-capable adv source (cs-row prone/restrained on the mover, or the target's `targetAdvantageIfWithin5ft` path exercised through a range the OA lane feeds — note `OA_TRIGGER_SPATIAL_STATE` freezes range inputs, so verify what `attackRange` value reaches `combineAttackModes` on the OA path; if it's undefined, within-5-ft adv sources can never fold on OAs).

## Likely location

`src/components/encounter/MonsterCardModal.jsx` / its roll-options builder (`buildAttackRollOptions`-family) and/or the roller call in `useLoggedDiceRoll*`: the 2d20 pool size looks hard-wired for the monster lane (or an `advantageCount` default of 1 that the mode-netting zeroes without shrinking the pool), while `total` takes `rolls[0]` for non-disadvantage modes. The GM-vs-visitor parity of the defect (all faces) rules out the delegation lane — this is the shared monster-card press path.

## Suggested fix

In the monster press lane, derive pool size FROM the netted mode (normal ⇒ 1 die) instead of always rolling 2 and picking die[0]; keep the disadvantage/advantage pool paths byte-identical. Then re-ride: plain press ⇒ `rolls:[n] mode:"normal"`; prone press ⇒ decide prone-adv gap separately; Speedy+adv ⇒ pin whatever combine law the owner ratifies. Add a ledger regression: every logged monster attack satisfies `mode==='normal' ? rolls.length===1 : rolls.length===2`.

## Severity

Data integrity (audit truth) — every monster attack row in every campaign log is misshapen; no immediate HP math corruption observed (total always took the intended die), but it silently defeats range/adv/dis ledger validation and this season's §82 audit doctrine.

## Resolution

**FIXED 2026-11-10.**

### What was actually wrong (differs from the "Likely location")

Not a monster-lane-only hard-wire: `computeD20Roll` (`src/hooks/combat/d20RollComputation.js`) unconditionally pre-rolls two d20s (`r1`, `r2`) for EVERY roll, and the shared row builder `buildRollLogEntry` (`src/hooks/combat/useLoggedDiceRollAttack.js`) persisted `rolls: [r1, r2]` verbatim regardless of the resolved mode. **The filed sheet-lane contrast was stale against this HEAD** — live repro proved a plain PC-sheet Longsword press ALSO logged `rolls:[20,17] mode:"normal" total:20`. Every row through the shared lane (attack/save/check/skill/initiative, both GM and visitor tabs) carried the phantom die on normal. Second defect of the same species: `rollNpcInitiative` (`src/services/encounters/encounterToInitiative.js`) rolled a phantom second die into its EB-join initiative row, which is hard-wired `mode:'normal'` (live witness pre-fix: Wolf join row `rolls:[5,15] mode:"normal"`).

### Fix

- `useLoggedDiceRollAttack.js`: `buildRollLogEntry` now derives the row's dice FROM the resolved mode via `buildRollLedgerDice(ctx)` — `normal` ⇒ exactly one die (Halfling-Lucky reroll rows record the rerolled value, mirroring the popup); `advantage`/`disadvantage` ⇒ the honest `[r1, r2]` pool, byte-identical to before. The popup payload (`buildPopupData`) KEEPS the full 2-die pool on normal presses: the popup's GM Advantage/Disadvantage toggle resolves via `computeFinalRoll(mode, safeRolls)` and needs the second die (and the roll-time Lucky / Feats-of-Chaos folds consume `r2` before the mode is final) — trimming it there would have broken the toggle. Runtime `lastAttack.d20Rolls` is likewise unchanged (not a ledger surface).
- `encounterToInitiative.js`: `rollNpcInitiative` rolls ONE d20 and logs `rolls:[r1]` — the join row has no adv/dis source at all.

### Verification

Live re-run of the original repro in test-campaign (post-fix), all rows from `GET /log`:

- EB-join initiative row: `rolls:[5] mode:"normal"` ✅ (was `[5,15]`)
- Plain Bite chip, zero markers: `rolls:[11] mode:"normal" total:11` ✅ — popup prints only "d20 11 +4"
- OA chip (curl-seeded `pendingOAs`, mover clean): `rolls:[16] mode:"normal" total:16`, marker drained-to-absent ✅
- Genuine disadvantage (cs-row `conditions:[{key:'restrained'}]` on the Wolf): `rolls:[2,19] mode:"disadvantage" total:2` + "Disadv (conditions)" chip ✅
- Genuine advantage (restrained on the ElderPaladin cs-row target): `rolls:[8,17] mode:"advantage" total:17` + "Adv (conditions)" chip ✅
- PC sheet lane — normal: `rolls:[13] mode:"normal"` ✅; disadvantage (runtime prone): `rolls:[1,11] mode:"disadvantage" total:1` ✅ (adv/dis pools still 2d20 with honest mode on both lanes)

Tests: new regression `src/hooks/combat/useLoggedDiceRollAttack.ledger-dice.test.js` (7 pins: normal one-die, adv/dis pool kept, roll-time Lucky flip, Restore-Balance cancel → one die, Lucky reroll single die, popup pool retained) + updated pins in `useLoggedDiceRollAttack.test.js` (the two tests that had locked the phantom shape) and `encounterToInitiative.test.js` (single-die initiative rows + one rollD20 call per NPC). `npx vitest run` full suite: **3184 files / 34449 passed, 0 failed**; `npm run lint` clean; `no-timers-guard` OK. Exit ritual: closed-tab two-pass admin clears GET-verified `{}`/`[]`.

### Files changed

- `src/hooks/combat/useLoggedDiceRollAttack.js` (fix)
- `src/services/encounters/encounterToInitiative.js` (join-initiative sibling)
- `src/hooks/combat/useLoggedDiceRollAttack.ledger-dice.test.js` (new)
- `src/hooks/combat/useLoggedDiceRollAttack.test.js` (pins updated)
- `src/services/encounters/encounterToInitiative.test.js` (pins updated)

The NOTES face (prone-adv un-ridden, `attackRange` into `combineAttackModes` on OAs) is untouched by this fix and remains descent PT#4 work.

