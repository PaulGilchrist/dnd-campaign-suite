# BUG — MA-0245 Ancient Silver Dragon, actions[0] Multiattack — FAIL (replace-B leg)

**Date:** 2026-09-16 · **Campaign:** test-campaign · **Target:** ElderPaladin AC19 → HexWarlock (CON+0/DEX−1)

## Row under test
Multiattack: "three Rend attacks; replace one with (A) Paralyzing Breath or (B) Spellcasting Ice Knife (level 2 version)."

## PASS legs (exact)
- Multiattack = header TEXT row, GM-adjudicated model (MA-0223 parity) — accepted.
- Rend ×3 via `.mc-dice-link`: bonus +17 each (32/31/31 vs AC 19, 3 HITs); damage `2d8 + 10` Slashing (22/21/18) + 2d8 Cold secondary (7/8/8) in damageBreakdown — matches authored 19(2d8+10)+9(2d8) structure exactly.
- (A) Paralyzing Breath replace path LIVE: cone picker DC 24 CON; HexWarlock failed 19+0 vs 24; `condition applied "Incapacitated, Paralyzed"` log + change-data activeConditions ["incapacitated","paralyzed"] (damageless-save condition leg WORKS here — better than MV-14 fingerprint; conditions applied via cone-save producer). No recharge field authored on row (correct — no recharge to gate). Cosmetic MV-19 "Half damage on successful save" boilerplate on condition row.

## FAIL leg (B): Spellcasting → Ice Knife lv2 — cast affordance exists but ALL numbers inert
Live probe ×5 clicks: each produced
- popup **"DC Unknown — no success or failure"** (MA-0237 fingerprint)
- log pair: dragon own `save DEX` 2d20 + `HexWarlock save "Ice Knife"` `saveResult:null` — NO attack roll, NO damage roll, NO `ability_use` cast log, lastAttack `damageFormula:null, damageApplied:false`, zero hp_change.
- lv2 dice (app spells.json lv2 = `1d10 plus 2d6`) NEVER rolled; prose `+15 to hit` NEVER rolled; DC 23 never applied.

### Root cause (DATA, two independent gaps — either fix revives path)
1. **5e spells.json Ice Knife has NO `attack_type` field.** `isSpellAttackSpell` (MonsterCardHelpers.js:246) only trusts `attack_type`; `findMonsterSpell` (MonsterCardModal.jsx:658) resolves 5e FIRST. The 2024 sibling HAS `attack_type:'ranged'` — it would route through MA-0033 spell-attack seam (`monsterSpellAttackBonus` prose +15, lv2 formula via `spellCastLevelFromSpellcasting` — "(level 2 version)" IS present and parseable). Instead the 5e entry falls to `executeMonsterSaveSpellCast` → block save using the SPELL's dc (DEX) but DC comes from the Spellcasting row, which authors DC 23 in PROSE ONLY (no numeric `save_dc`) → "DC Unknown" → damage silently abandoned (exact MA-0237 prose-only-DC family; Ancient Gold authors numeric `save_dc` and its save-leg is live).
2. Ancillary weirdness: attacker-side dragon own DEX save log per click (save-listener artifact) pollutes evidence.

### Fix suggestions
- Add `"attack_type": "ranged"` to 5e Ice Knife (matches its "Make a ranged spell attack" text and the 2024 entry) → routes to attack seam with +15 prose bonus and lv2 formula `1d10 plus 2d6`.
- And/or add numeric `save_dc: 23` to the Spellcasting row for save-leg spells (MA-0237 precedent).

## Verdict
**FAIL** — 3× Rend + (A) exact/live, but replace-path (B) never resolves its authored level-2 numbers on any attempt (zero damage, zero attack roll, unknown DC, no cast log). FAIL class: prose-only-DC + missing attack_type (MA-0237 + MA-0033 data routing).
