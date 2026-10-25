# Zones half-cover stamp SUBTRACTS 2 from target AC instead of adding (RAW sign inversion)

## Summary
With Enforcement `zones` ON, an intervening creature token correctly triggers the §8.3 half-cover adjudication, but the cover modifier is applied as **−2 to the target's AC** (`HALF_COVER_AC = -2` added to AC). D&D RAW (5e and 2024): half cover grants the target **+2 AC** (and +2 Dex saves). The enforcement therefore *helps the attacker* by a net 4 ft-equivalent swing, and was observed flipping a shot that should MISS into a HIT.

## Steps to reproduce
Start from: `test-campaign`, enforcement master ON with only `Zones` checked, Battle Arena active. Baseline tokens: FeyRanger (9,8), EvasiveFighter (1,8), placed NPC token renamed "NPC 1" at (15,8); initiative board contains NPC 1 (bare +NPC, ac:10/hp:10); FeyRanger's Initiative-card target select (`[data-testid="target-select"]` on the card whose 2nd innerText line is `FeyRanger`) armed to NPC 1.

1. On the map, drag EvasiveFighter's token from (1,8) to (12,8) — directly on the straight line FeyRanger→NPC 1. Wait ~12s for the map PUT to flush (GET `/api/campaigns/test-campaign/maps/battle-arena` shows EF at gridX 12).
2. Open FeyRanger's character sheet → Actions → click the Longbow `+8` attack cell (the `div.clickable` inside `.attacks`).
3. Read the hit popup line `✓ HIT / ✗ MISS (total vs AC N)` and dismiss the Stalker's Flurry chooser with Cancel (this sheet lane opens it on a hit; damage commits only after the chooser resolves).
4. Repeat the shot a couple of times; also GET `/api/campaigns/test-campaign/log` and read the `roll` entries + `enforcement_cover` entries, and `/change-data` → `lastAttack`.

Observed (2026-10-25 run, 3/3 shots while interposed):
- Log `roll` entry: `{"rolls":[1,18],"total":1,"bonus":8,"targetAc":8,"effectiveAc":8,"hit":true}` for the AC-10 NPC 1.
- Popup: `✓ HIT (9 vs AC 8)`; `lastAttack.targetAc: 8`.
- `enforcement_cover` description: `Half cover (−2 AC): EvasiveFighter interposes at (12,8) ...`

5. Control: drag EF back to (1,8), wait for flush, shoot again → popup shows `vs AC 10` (stamp null-wiped by the clear-line leg — that half works).

## Expected behavior
Half cover should RAISE the target's AC: popup `vs AC 12` (`targetAc: 12`). The repro shot `total 9` must resolve as a MISS (9 < 12); the enforcement cannot make covered targets easier to hit than exposed ones.

## Actual behavior
Target AC is stamped and resolved as 10 − 2 = **8** (`targetAc:8, effectiveAc:8, hit:true`). Every shot against a half-covered target gains the attacker +2 instead of paying −2 (net 4-point swing vs RAW). A shot that RAW-misses by 3 was logged as a HIT and its damage applied (hp_change −7 to NPC 1 in-session).

Secondary observation (needs owner adjudication, not asserted as a second defect): the same nat-1 roll logged `isNatural1:true, hit:true` while the popup rendered the cosmetic "Critical Miss!" line — nat-1 auto-miss appears unmodeled in the hit resolver app-wide; grep of `DiceRollResult.computed.js:153` shows `showFumble` is display-only.

## Likely location
High confidence (code is byte-explicit):
- `src/services/combat/coverService.js:30` — `export const HALF_COVER_AC = -2;` (stamped as `ac` at :77; log text and doc comments carry the same "−2 AC" framing).
- `src/hooks/combat/targetAcComputation.js:44` — `targetAc += cover.ac;` (adds the negative).

The app's OTHER cover lanes model the bonus with the correct sign: `MonsterCardModal.jsx` returns `coverAcBonus: 2` and `DiceRollResult.computed.js:45` does `props.targetAc + (props.coverAcBonus || 0)`. So the zones enforcement lane is internally inconsistent with the established convention.

## Suggested fix
Flip the producer constant to `+2` and update the copy that bakes in the wrong direction:
```js
// coverService.js
export const HALF_COVER_AC = 2; // half cover grants the target +2 AC (PHB 2024 ch.9)
```
and change the `enforcement_cover` description to `Half cover (+2 AC): …` plus the comment blocks in coverService.js/targetAcComputation.js. Check existing tests pinning `-2`/the "−2 AC" string (coverService/`targetAcComputation`/the L5 §8.3 suites) and update expectations. No reader change needed — `targetAc += cover.ac` is correct for a positive bonus. Consider also folding the nat-1 question into the same ticket only if the owner confirms auto-miss should be enforced.

## Severity
Data integrity risk — a live rules-enforcement lane inverts a core defense rule and flips hit/miss outcomes (with applied damage) whenever `zones` is engaged. Scope is gated behind opt-in enforcement, but the numbers written to the campaign log/lastAttack are machine truth other systems read.
