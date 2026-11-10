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
