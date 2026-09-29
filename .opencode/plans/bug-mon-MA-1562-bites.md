# MA-1562 — Swarm of Piranhas "Bites" — VERDICT: FAIL(a) / DATA

## Row
```json
{"id":"MA-1562","monster":"Swarm of Piranhas","monsterIndex":"swarm-of-piranhas","actionName":"Bites","actionType":"attack","attackBonus":5,"damageDicePrimary":"2d4 + 3","damageTypePrimary":"Piercing","reach":"5 ft.","description":"Melee Attack Roll: +5 (with Advantage if the target doesn't have all its Hit Points), reach 5 ft. Hit: 8 (2d4 + 3) Piercing damage, or 5 (1d4 + 3) Piercing damage if the swarm is Bloodied."}
```

## Components verdict
1. **Base +5 / 2d4 + 3 Piercing — PASS (live exact).**
2. **Bloodied variant 1d4 + 3 — inert (FAIL(a)/DATA).** Prose-only; no `conditional_damage` on the manifest action → `buildChargeBonusOffer` (`src/components/encounter/MonsterCardHelpers.js:664-666`, `const cd = action?.conditional_damage; if (!cd?.dice) return null;`) returns null forever → bloodied press pays base with zero delta. Twin of MA-1552/1553/1555/1557/1558/1559 swarm fingerprint.
3. **Auto-Advantage-if-target-not-full-HP — advisory-inert (§70-advisory class gap, as expected).** No consumer anywhere parses the "(with Advantage if the target doesn't have all its Hit Points)" clause (grep: only match is a test asserting parenthetical non-dice notes are ignored — `MonsterCardHelpers.flat-hit-damage.test.js:24`). Popup offers **manual** Advantage/Disadvantage toggles only; **never auto-armed** regardless of target HP state. Recorded honestly: 0 auto-advantage; single d20 (`mode: "normal"`) on every press including vs a damaged target.

## Static evidence
- `public/data/monsters.json` swarm-of-piranhas Bites keys: `name, description, attack_bonus (5), reach ("5 ft."), damage_dice_primary ("2d4 + 3"), damage_type_primary ("Piercing")` — **NO `conditional_damage`**. Both conditional clauses (Bloodied half-damage AND auto-advantage-if-target-not-full) live only in `description` prose.

## E2E evidence (localhost:5173, test-campaign, Playwright)
- Header verified `test-campaign`. EB exact "Swarm of Piranhas" + "Bandit" (Selected Monsters (2)) → Join. Swarm 28/28 AC 13 init 5; Bandit 1 AC 12. Swarm Target combobox = "Bandit 1" (change-data `creatures[1].targetName = "Bandit 1"`). GM HP input: Bandit current raised (note: max-HP edit mutates a stale copy in `MaxHpInput`→`handleCreatureHpChange` delta==0 early-return, `createCreatureHandlers.js:24-52` — cosmetic, out of row scope; managed via current-HP restores).
- **Step 1 — healthy swarm vs full-HP Bandit:**
  - Press 1: d20 9 +5 = `✓ HIT (14 vs AC 12)` → damage popup `2d4 + 3: 2, 1 +3` → **6 Piercing, 11→5** exact. Single d20, no auto-adv.
  - Press 2 (restored 11/11): d20 8 +5 = `✓ HIT (13 vs AC 12)` → `2d4 + 3: 1, 1 +3` → **5 applied** exact (`hp_change −5`).
  - Press 8 — **MISS captured**: d20 nat 1 → `CRITICAL MISS! ✗ MISS (6 vs AC 12)` — clean: no damage popup, no hp_change, no offer chip.
  - Log: all 8 attack rolls `mode: "normal"` (single d20 each); damage formulas all `2d4 + 3` totals 6/5/8/8/11/8/9 — every HIT pays base 2d4+3 exact.
- **Step 2 — Bandit damaged (6/11, not full HP):** press d20 7 +5 = `✓ HIT (12 vs AC 12)`. Popup chrome: **single d20** "d20 7 +5", manual "Advantage"/"Disadvantage" toggles present but UNARMED — no second die, no auto-Arm. Damage `2d4 + 3: 4, 1 +3` = 8 → Bandit down (revived via GM HP). Zero auto-advantage: manual-only confirmed.
- **Step 3 — bloodied swarm (GM HP 14/28 = floor(28/2) bloodied threshold):** press d20 8 +5 = `✓ HIT (13 vs AC 12)` → popup chrome **base formula only** `2d4 + 3: 4, 1 +3` → 8 applied 11→3. No "Bloodied:" offer chip, no accept/decline controls. Full-log scan: `conditional_damage_granted` / `conditional_damage_declined` entries **0**; advantage-flagged attacks **0**. Half-HP state inert.
- Cleanup done: Initiative cleared (confirm accepted), Admin → Clear Change Data (keys **[]**) + Clear Campaign Log (**0 entries**).

## Fix
Add the Bloodied half-damage variant as `conditional_damage` on swarm-of-piranhas Bites in `public/data/monsters.json` (MA-0007 byte-shape, after `damage_type_primary`):

```json
"conditional_damage": { "dice": "1d4 + 3", "damage_type": "Piercing", "condition": "Bloodied" }
```

Expected post-fix: bloodied HIT popup offers `Bloodied: +1d4+3 Piercing?`; accept rolls 1d4 + 3 Piercing + logs `conditional_damage_granted`; decline logs `conditional_damage_declined` base-only; healthy/miss presses unchanged.

## Notes — auto-advantage clause advisory gap
The "(with Advantage if the target doesn't have all its Hit Points)" clause remains **advisory-only**: no rules-engine consumer evaluates target-full-HP → advantage, and no prose parser exists for it. GM must manually click the popup's Advantage toggle. A structured mechanism (e.g. `conditional_advantage: { condition: "target_not_full_hp" }` + popup auto-arm consumer) would be required to automate it; recorded here as the known §70-advisory gap for this row.
