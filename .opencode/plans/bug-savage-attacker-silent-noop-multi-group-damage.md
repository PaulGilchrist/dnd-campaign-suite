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
