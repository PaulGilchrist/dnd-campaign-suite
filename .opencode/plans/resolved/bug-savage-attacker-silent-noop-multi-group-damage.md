# Bug: Savage Attacker button on sheet-lane damage popups is a silent no-op whenever the formula is multi-group (any sneak-attack damage)

## Summary
The 2024 sheet-lane damage popup offers a "Savage Attacker" button for feat holders. On any attack
whose damage formula is multi-group — every sneak-attack popup looks like
`1d6+3 [slashing] + 9d6 [Sneak Attack]` — clicking the button does **nothing observable**: no reroll
result row, no Keep-First/Keep-Reroll choice UI, no log entry, no HP delta, no console error. The
component-side guard in `DiceRollResult.handlers.js` compares the die count of the FIRST formula
group against the WHOLE roll pool (`numDice !== rolls.length → return`), which can never match for
a multi-group popup (1 ≠ 10), and the early return carries zero feedback.

## Steps to reproduce
1. In test-campaign, sanctioned EF rig (2024 Rogue/Arcane Trickster lv20 — the canonical fixture
   already has the Savage Attacker feat in `feats[]`; playbook §7 grant recipe), victim ElderPaladin
   with HP headroom, `targetName` armed on the EF board row.
2. Sheet-press Scimitar → HIT → drain the rider overlays (DS chooser Cancel or resolve, Charge
   Cancel, Shield Bash Roll Save/Done) until the STAGE-2 damage popup shows
   `Scimitar | N | 1d6+3 [slashing] + 9d6 [Sneak Attack]: r1, r2, … | … damage applied …` with
   buttons [Savage Attacker] [Done].
3. Click "Savage Attacker" (single click, then observe; repeated clicks behave the same).

## Expected behavior
The component rerolls the damage dice, shows the "Savage Attacker: orig → rerolled — choose which
total to keep" row with Keep First / Keep Reroll buttons, writes the `ability_use` "Savage Attacker"
audit row, and sets the per-round latch — i.e. the behavior its own sibling code paths implement.

## Actual behavior (live 2026-11-07, run DJ)
Two damage-popup faces (crit `1d6*2+3 + 9d6*2` with a 10-roll pool, and non-crit
`1d6+3 + 9d6` with a 10-roll pool): ~10 Savage button clicks total produced ZERO observable delta —
campaign log length byte-identical (no `ability_use` Savage row anywhere in the 62-row session log),
EP HP unchanged across the clicks (206 → 206), popup text unchanged, no new overlay, no console
error. Adjacent control: "Done" on the same popup works (closes + applies). The feat-holder check is
clean (EF `feats[]` contains "Savage Attacker") — so this is an inert control, not a permission gate.

## Likely location (confident — arithmetic on the live popup fields + code read)
`src/components/char-sheet/DiceRollResult.handlers.js` → `handleSavageAttacker` (~line 158):
```
const diceMatch = formula.match(/(\d+)d(\d+)/);   // first group only: "1d6" → numDice 1
...
if (numDice !== rolls.length || dieSize <= 0) return;   // rolls = WHOLE pool (10 dice) → always returns
```
With sneak the popup `formula` starts with the base group (1d6 / 1d6*2) while `rolls` carries the
base+sneak pool, so the guard trips on every sneak popup and the return is silent. The downstream
pair (`CharSheet.handlers.js handleSavageAttacker` + `SavageAttackerResult` choice UI) is fully
implemented and never gets reached. Note also a design question the fix will hit: Savage Attacker
is RAW the WEAPON damage dice only — decide whether the reroll should cover just the first group
(match `(\d+)d(\d+)` group count vs the base-group slice of rolls) or intentionally the whole pool.

## Suggested fix
Make the guard group-aware: parse the first dice group and compare against the number of rolls that
belong to that group (or track per-group roll arrays on the popup payload — the crit ledger already
marks groups with `*2`, so group boundaries exist in the data). At minimum, when the guard rejects,
give feedback (hide the button when `when()` can't satisfy the guard, or toast "cannot reroll this
damage") instead of a silent return. Add a component ledger for the sneak multi-group popup shape.

## Severity
Broken feature. A feat whose sole benefit is this reroll renders an always-offered button that never
works on the rogue's signature damage (sneak attacks) — and it fails with zero feedback, so the GM
can't tell whether it was spent. Blast radius: every sheet-lane melee popup with a secondary damage
group (sneak riders, any `X [a] + Y [b]` formula).

## Resolution
FIXED 2026-11-07 (fix-verify run). The diagnosis in "Likely location" was confirmed exactly:
`DiceRollResult.handlers.js → handleSavageAttacker` matched only the FIRST dice group
(`formula.match(/(\d+)d(\d+)/)` → `numDice`) and compared it against the WHOLE roll pool
(`numDice !== rolls.length → return`), which can never match a multi-group popup — and the early
return carried zero feedback.

**RAW scope decision (bug-file design question):** canonical feat text in BOTH rulesets' data says
the feat rerolls **the weapon's damage dice only** — `public/data/feats.json:563` ("you can reroll
the weapon's damage dice and use either total") and `public/data/2024/feats.json:2424` ("roll the
weapon's damage dice twice and use either roll"). Bonus groups (Sneak Attack, riders) are NOT part
of the reroll. The single-group path already rerolls exactly the formula's dice, so the fix keeps
that shape and extends it group-aware: the **first** formula group = the weapon group.

**Fix** (`src/components/char-sheet/DiceRollResult.handlers.js handleSavageAttacker`):
- Build a per-die size census over ALL formula dice groups (same `matchAll(/(\d+)d(\d+)/gi)` idiom
  as the sibling `handlePuncture` in the same file) and guard the pool against the TOTAL census —
  mismatch now refuses **loudly** (`console.error`, per the no-silent-fallbacks convention) instead
  of a silent return.
- Reroll only the first `(\d+)d(\d+)` group's rolls (pool is in formula order: weapon dice first —
  verified live: pool `[3, 4, 5…]` under `1d6+3 [slashing] + 10d6 [Sneak Attack]`). Crit `*2`
  markers are display-only (pool carries a single set), so they need no special handling —
  identical to the pre-existing single-group crit behavior.
- The choice UI (`SavageAttackerResult` row + Keep First/Keep Reroll) compares/rerolls the WEAPON
  dice only; the state keeps the FULL merged pools so the downstream `handleSavageAttackerChoice`
  delta is weapon-vs-weapon (bonus dice cancel) and the popup keeps showing every die after the
  swap. The click audit payload carries the rerolled weapon dice so the `ability_use` row is
  RAW-honest (`rolled 1 (1) then rerolled 4 (4)`).
- No downstream changes needed — `CharSheet.handlers.js handleSavageAttacker`/`handleSavageAttackerChoice`
  + the per-round latch were already fully implemented, just unreached. Lane is ruleset-agnostic
  (shared component), so the 5e/2024 twins both ride the same fix.

**Regression test:** `src/components/char-sheet/DiceRollResult.handlers.savageAttacker.test.js` —
6 new ledgers: multi-group sneak reroll offers the choice on weapon totals and keeps bonus rolls;
multi-dice weapon groups reroll fully; per-die sizes come from the formula (d8 weapon ≠ d6);
crit `*2` single-set face; keep-choice forwards the full merged pool; pool/formula mismatch is
refused with a console.error (locks the no-more-silent-rejection contract). All 11 pre-existing
single-group ledgers pass byte-unchanged (single-group behavior identical).

**Verification:**
- Live repro (pre-fix): sanctioned EF Rogue/AT-lv20 rig + 3-creature gridless board; stage-2 sneak
  popup `1d6+3 [slashing] + 10d6 [Sneak Attack]` (11-roll pool) — 3 Savage clicks = zero delta, no
  log row, no console error (confirmed exactly as filed). Adjacent control: single-group popup's
  Savage button DID work pre-fix (choice row + both `ability_use` rows + HP delta) — proving the
  guard arithmetic was the whole bug.
- Live re-verify (post-fix, HMR): same sneak popup face → click shows
  "Savage Attacker: 1 → 4 — choose which total to keep (1 or 4)" + Keep buttons; Keep Reroll →
  popup total 38 → 41, merged rolls shown (`4, 2, 2, 3, 6…` sneak dice intact), HP 182 → 179, log
  gains `ability_use "Savage Attacker"` use-row + kept-row (+3 damage) and an `hp_change` delta −3.
  Adjacent faces: single-group CRIT popup (`1d6*2+3`) rerolls its one die and auto-keeps honestly
  ("kept original total 5"); next hit the same round correctly shows NO Savage button (latch).
- `npx vitest run src/components/char-sheet/` → 563 files / 5401 tests passed. `npm run lint` →
  zero warnings. `node .opencode/plans/no-timers-guard.mjs` → OK.
- Cleanup: EF disk fixture restored md5 `0df29ff3…` byte-exact (API GET re-proves Fighter/Battle
  Master/18 + backpack [Shortsword]); change-data `{}` + log `[]` GET-verified after API admin
  clears with the tab closed; no other campaign touched (lock active).

## Summary (fixed)
Savage Attacker on sheet-lane multi-group damage popups (any sneak-attack hit) was a silent no-op:
the component guard compared the FIRST formula group's dice count against the whole base+sneak roll
pool, so it always early-returned without feedback. The guard is now group-aware — it censuses all
formula dice groups against the pool (mismatch logs a `console.error` instead of vanishing) and
rerolls only the WEAPON group, matching canonical RAW feat text in both rulesets' `feats.json`
("the weapon's damage dice"). Bonus-group dice are preserved, the Keep First/Keep Reroll choice UI,
`ability_use` audit rows, HP delta settlement, and the per-round latch all now work on sneak-attack
popups. Verified live + 6 new unit ledgers; single-group behavior byte-identical.

