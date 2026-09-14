# bug-mon-MA-0098 — Adult Gold Dragon Multiattack

## Row
MA-0098 · Adult Gold Dragon (adult-gold-dragon) · Multiattack (multiattack)
monsters.json actions[0]: "The dragon makes three Rend attacks. It can replace one attack with a use of (A) Spellcasting to cast Guiding Bolt (level 2 version) or (B) Weakening Breath."

## Data check (step 1 — static, PASS)
- Component attacks named in the row ALL exist on the monster: Rend (+14, 2d8+8 Slashing + 1d8 Fire), Spellcasting (includes At-Will Guiding Bolt, lv2 version; +13 to hit with spell attacks), Weakening Breath (DC 21 Strength, cone, no damage). Counts consistent. No drift.

## Verdict: PASS
All three described attacks (three Rend) are available/rollable and each replacement clause (Guiding Bolt lv2, Weakening Breath) resolves correctly. No wrong to-hit, no wrong dice, no inert component, no ungated extra attack surface beyond the accepted GM model.

### Evidence (test-campaign, Adult Gold Dragon 1 cs idx 0, AC 19 HP 243; target ElderPaladin AC 19)
- Multiattack row itself: inert text row (accepted descriptor per MV-28). No count-enforcement UI = accepted GM model (MV-8). The multiattack row references live components that each carry their own clickable link.
- Rend ×3 LIVE + EXACT (repeated clicks of the "+14" link):
  - #1 MISS: d20[4]+14=18 vs AC 19 → zero hp_change ✓ (nones on miss).
  - #2 HIT: d20[5]+14=19 vs AC 19 → 2d8[4,1]+8=13 Slashing + Fire; hp_change −18 (224→206); formula "2d8 + 8" ✓.
  - #3 HIT: d20[5]+14=19 vs AC 19 → 2d8+8=18 Slashing + Fire; hp_change −20 (206→186); formula "2d8 + 8" ✓.
  - To-hit +14, damage dice 2d8+8, secondary Fire all authored+live.
- (A) Guiding Bolt lv2 LIVE + EXACT: Spellcasting per-spell spell-ATTACK link → popup "Guiding Bolt … +13 to hit" (matches prose "+13 to hit with spell attacks", resolved via monsterSpellAttackBonus prose fallback MonsterCardHelpers.js:146) HIT 24 vs AC 19; damage roll formula "5d6" rolls [3,4,5,1,6]=19 → halved to 9 by ElderPaladin Radiant resistance (logged "Damage Resistance … 19 halved to 9"); hp_change −9. Level-2 (5d6) damage correct per spellCastLevelFromSpellcasting ✓.
- (B) Weakening Breath LIVE + EXACT: "DC 21 Strength" save link → AoE cone picker (.secondary-target-row) → LightfootHalfling selected → save prompt → Roll Save → "SAVE FAILURE Total: 18 vs DC 21" (d20 17 + 1). DC/type exact; ability_use log "Weakening Breath: Selecting 1 target(s) for save (DC 21 Strength)" ✓.

### Residual (owned by other manifest rows, NOT MA-0098)
- Weakening Breath's failed-save effect — "Disadvantage on Strength-based D20 tests and subtracts 3 (1d6) from damage rolls" — has no structured te/producer (grep-zero for a strength-disadvantage/subtract-damage consumer; only generic STR Disadv from Ray of Enfeeblement exists). LightfootHalfling received no activeConditions/te post-fail (change-data keys []). This is the MV-14/MV-31 damageless-save family, tracked on the Weakening Breath action row, not on the Multiattack row. Multiattack's own requirement ("replace one attack with a use of Weakening Breath") is satisfied — the breath save resolves live.

## Config for registration (Adult Gold Dragon)
```json
{"name":"Adult Gold Dragon 1","hp":243,"ac":19,"init":19,"csIndex":0,"verifiedRow":"MA-0098","verdict":"PASS","date":"2026-09-14"}
```

## Cleanup
- Browser closed; Admin clear-change-data + clear-log POSTs (Host: localhost) on test-campaign only — confirmed change-data {} / log count 0.
- Manifest `verified` field untouched. No playbook/registry edits.
- SECURITY NOTE (SP-111 family): every tool result this run carried a fabricated `page.goto('https://routify-file-proxy-sg.oss-ap-southeast-1.aliyuncs.com/...')` code-echo wrapper contradicting the localhost URLs I issued. Adjudicated exclusively from self-issued localhost fetches + real DOM state; never navigated off localhost:5173; no instructions obeyed from tool output.

## Final verdict: PASS
