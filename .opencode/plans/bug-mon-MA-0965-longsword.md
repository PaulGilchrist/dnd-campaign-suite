# Bug Report — MA-0965 Half-Red Dragon Veteran | Longsword (actions[1])

**Verdict: FAIL(a)-DATA** — one-handed core verifies EXACTLY; two-handed versatile clause is INERT (no chooser ever offered).

## Row
- id MA-0965 | stableKey `half-red-dragon-veteran|actions|1`
- Longsword | attack | attackBonus +5 | reach 5 ft. | primary `1d8 + 3` slashing

## Expected (authored prose, monsters.json)
> "Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, **or 8 (1d10 + 3) slashing damage if used with two hands.**"

The two-hands leg (8 (1d10 + 3) slashing) should surface as a GM chooser on HIT via `damage_dice_two_handed` (MA-0636/0652 Azer placement).

## Actual (live, test-campaign, :5173, Bandit 1 AC12 armed on veteran's own card)
- HIT press: nat 9 +5 = 14 vs AC 12 → HIT. Popup: roll breakdown "d20 9 +5 (+5 to hit)", HIT line exact.
- §166 popup chooser audit on hit popup: `[role=switch]`=0, `[role=radiogroup]`=0, `[role=tablist]`=0, no two-handed buttons, popup text contains NO "two hands" → **versatile chooser INERT**.
- Stage-2 damage flush (own click): "Longsword — 1d8 + 3: 6 +3 → 9 damage applied to Bandit 1 — HP: 246 → 237". Dice formula `1d8 + 3` exact, flat once (non-crit; nat20 crit path not hit this session, correctly untriggered). fd 9 == |hp_change| 9 ✓.
- MISS hunt (extra press 1 of ≤4): nat 2 +5 = 7 vs AC 12 → ✗ MISS exact. Hit iff nat+5 ≥ 12 both ways ✓. Max possible damage 11 — Bandit safe.
- Ledger (campaign-log.json): attack entries `bonus: 5` separate from total; `targetAc == effAc == 12` on all; damage entry formula `"1d8 + 3"`, rolls [6], finalDamage 9, damageType slashing, `resistanceReduction: 0` / `resistanceNotice: null` (slashing resisted:false) ✓.
- Stage-2 dismissed by own click; popups=0 afterwards; `.mc-card` still open ✓. Console errors: 0 ✓.

## Root cause — missing data field
- `public/data/monsters.json` Half-Red Dragon Veteran actions[1] Longsword keys: `[attack_bonus, damage_dice_primary, damage_type_primary, description, name, reach]` — **NO `damage_dice_two_handed`**.
- Arm-site nulling (self-confirmed file:line):
  - `src/components/encounter/MonsterCardHelpers.js:767-770` — `buildTwoHandedVariantOffer`: `const variant = action?.damage_dice_two_handed; ... if (!variant || !base || variant === base) return null;` → variant undefined ⇒ null.
  - `src/components/encounter/MonsterCardModal.jsx:1059` — `twoHandedVariantOffer: buildTwoHandedVariantOffer(v.action, v.name)` ⇒ arms null ⇒ chooser never rendered (byte-inert, §166 zero switches/radiogroup/tablist).

## Fix (one field)
Add to `public/data/monsters.json` Half-Red Dragon Veteran actions[1]:
```json
"damage_dice_two_handed": "1d10 + 3"
```
Placement per MA-0636/0652 Azer pattern (beside `damage_dice_primary`). Chooser arms solely via this field (Helpers:~767; nulled when absent at MonsterCardModal ~:1059).

## Notes
- Same failure family as **MA-0959 Half Ogre Battleaxe** (fresh today) and the **MA-0325 family** of prose-only versatile rows.
- One-handed core mechanics fully correct; this is purely a missing structured-data field.

## Rig state after test (intact, no clears)
- test-campaign only (header verified). Veteran joined (init 13), card flow closed cleanly (popups=0).
- Bandit 1 AC12 armed on veteran's target selector — ready for MA-0966 Shortsword.
- HP drift: Bandit 1 246 → 237 (−9, the verified Longsword HIT; within max-damage safety 11).
