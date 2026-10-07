# Bug SP-074 — Mage Armor (2024): armor prerequisite + ends-on-donning unenforced

**Verdict: FAIL** (legs 1–3 PASS live; legs 4–5 wrong/unimplemented)
**Date:** 2026-10-06 · **Campaign:** test-campaign · **Caster:** DivinationWizard (Wizard lv20, 2024) · **Target:** HexWarlock (Human, DEX 9/−1, unarmored)

## Canonical (public/data/2024/spells.json `mage-armor`)
> "You touch a willing creature who isn't wearing armor. Until the spell ends, the target's base AC becomes 13 plus its Dexterity modifier. The spell ends early if the target dons armor."

(app prose is a faithful variant of the PHB-2024 canonical quote; automation `{type:"mage_armor", target:"willing_creature", duration:"8 hours"}` authored)

## What works (live-proven)
1. **Cast lane:** Wizard sheet spell row → cast popup ("Slots Remaining: 4") → Cast Spell → SecondaryTargetModal target radios → "Cast Mage Armor" → `applyMageArmor` (mageArmorHandler.js:52).
2. **Base AC swap:** HexWarlock AC cell `Armor Class: 9` (10 + −1) → `Armor Class: 12 (13 + -1 Dex)` post-cast. Exact +3 delta, base 10→13, no other stacked mods. CharSummary.jsx:50 `mageArmorActive` lane.
3. **Buff stamp:** `change-data HexWarlock.activeBuffs = [{name:"Mage Armor", effect:"mage_armor", baseAc:13, duration:"8 hours", sourceCharacter:"DivinationWizard"}]`; `concentration` absent (non-concentration) ✓. Log `ability_use` "DivinationWizard cast Mage Armor on HexWarlock…" ✓.
4. **Slots:** `spell_slots_level_1` 4→3→2 (−1 per cast) ✓.

## Defects
### D1 — Armor prerequisite not gated (casts onto armored targets; LOWERS their AC)
- Grep: no `mage_armor` armor check in `spellGates.js` `gateMageArmor` (:417–424, targets = ALL `cs.creatures`), none in `mageArmorHandler.js`, none in `TargetSpellPopups.jsx` :436 picker, none in `charSummaryCalc.js:225` handler, none in `rules-armorClass.js` (zero `mage_armor` references).
- LIVE: cast on **ElderPaladin** (equipped Scale Mail + Shield, sheet AC 19). No refusal; `ElderPaladin.activeBuffs` stamped Mage Armor; sheet AC became **"Armor Class: 16 (13 + 3 Dex)"** — a −3 downgrade vs his armored 19. RAW: must be refused.

### D2 — "Spell ends if the target dons armor" not implemented
- Grep: zero code removes the `mage_armor` buff on armor equip (no consumer in server routes, changeData, char-sheet, or useInitiativeEffects buff paths; rest rules only PRESERVE it — clearAllExpirationEffects.js:14, restRules-shortRest.js:313).
- LIVE: equipped "Leather" on HexWarlock via Edit wizard step 16 (trusted fill+Tab+Save; disk `equipped:["Leather"]`). After reload: buff still in `activeBuffs`, sheet still `Armor Class: 12 (13 + -1 Dex)`. RAW: spell must end → AC 10 (Leather 11 + −1).

### D3 (known-gap family §38) — 8-hour clock absent
- `mageArmorHandler.js` writes no expiration; `expirationQueue.js:21` stamps `expiryRounds ?? Infinity`. Duration enforced only by short-rest preserve / long-rest clear heuristic, not an 8-hour clock.

## AC popup inconsistency (cosmetic)
- AC-cell contribution popup still prints the base formula `Armor Class (9) = Unarmored AC (10) + Dexterity Bonus (-1)` while the cell shows 12 — mage armor override lives only in CharSummary display lane, not `rules-armorClass.js`.

## Suggested fix surface
- Gate in `spellGates.js` `gateMageArmor`: filter targets to `!isWearingArmor(cs/runtime equipped)` (equipment names BARE — "Leather"); refusal log `mage_armor_refused`.
- Donning-end leg: on equipment save (inventory wizard handler), strip `effect:'mage_armor'` from that char's `activeBuffs` + log.
- AC popup: thread mage_armor into `computeBaseArmorClass` contributions so popup and cell agree.

## Cleanup (verified)
- HexWarlock `equipped` reverted `["Leather"] → []` via wizard, GET-verified.
- Admin clear change-data + log: POSTs returned success; GET `/change-data` `{}`, GET `/log` `[]`. Dev server up on :5173/:80.
