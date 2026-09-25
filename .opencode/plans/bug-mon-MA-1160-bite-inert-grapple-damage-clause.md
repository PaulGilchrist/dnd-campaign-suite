# BUG MA-1160 — Mimic Bite: UNARMED conditional_damage GRAPPLE-DOUBLE CLAUSE (FAIL(a)/DATA)

**Date:** 2026-09-25 · **Campaign:** test-campaign · **Row:** mimic actions[0] "Bite"
**Manifest:** MA-1160 (`conditions:["grappled"]`, actionType "attack+save", attackBonus 5, saveDc 0) → **FAIL(a)/DATA** on the damage clause (clause B). Clause A (advantage-if-grappled) = GM-adjudicated ADVISORY (no seam; §MA-0679 class).

## Expected (row quote)
> "Melee Attack Roll: +5 (with Advantage if the target is Grappled by the mimic), reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage—or 12 (2d8 + 3) Piercing damage if the target is Grappled by the mimic—plus 4 (1d8) Acid damage."

Two grapple-dependent clauses:
- **(A)** Advantage on the attack roll if target grappled by the mimic.
- **(B)** Primary damage 1d8 + 3 → **2d8 + 3** if target grappled.

## Disk truth (`public/data/monsters.json` mimic.actions[0]) — byte-checked 2026-09-25
ALL authored fields, verbatim:
```
attack_bonus: 5
damage_dice_primary: "1d8 + 3"
damage_dice_secondary: "1d8"
damage_type_primary: "Piercing"
damage_type_secondary: "Acid"
description: "Melee Attack Roll: +5 (with Advantage if the target is <strong>Grappled</strong> by the mimic), reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage—or 12 (2d8 + 3) Piercing damage if the target is Grappled by the mimic—plus 4 (1d8) Acid damage."
name: "Bite"
range: ""
reach: "5 ft."
recharge: ""
save_dc: 0
save_effect: ""
save_type: ""
```
**NO conditional/variant damage field of any kind: `conditional_damage` ABSENT · `damage_dice_two_handed` ABSENT · `damage_dice_ranged` ABSENT · `hit_conditions` ABSENT · `hit_target_effect` ABSENT · `hit_condition_roll` ABSENT · `target_prerequisite` ABSENT · `automation` ABSENT.** Manifest `conditions:["grappled"]` is prose-derived only (§449: raw action.conditions has ZERO attack-path consumers).

## Transport / seam analysis (decisive)
- **Clause B — LIVE SEAM, UNARMED → FAIL(a)/DATA (MA-0652 versatile / MA-1141 rider class):**
  conditional_damage seam is live and condition-text-agnostic:
  `buildChargeBonusOffer` (src/components/encounter/MonsterCardHelpers.js:597-613) reads `action.conditional_damage.{dice,modifier,damage_type,condition}` → forwarded on attack context `chargeBonusOffer` (src/hooks/combat/useLoggedDiceRollAttack.js:277) → HIT-popup grant/decline resolver `resolveChargeBonus` (src/components/encounter/MonsterCardModal.jsx:2200-2224) → `conditional_damage_granted/declined` logs (MonsterCardHelpers.js:767/778). Condition string is NOT auto-evaluated (chargeClauseFeet parses only feet, for the label) → GM adjudication, ownership ("by the mimic") honestly GM-enforceable at the offer.
  Byte-twins shipping: **Chimera Bite** `conditional_damage:{dice:"4d6",modifier:4,damage_type:"Piercing",condition:"advantage on the attack roll"}` (MA-0485 test lock src/components/encounter/MonsterCardModal.ma0485-chimera-bite-advantage.test.jsx:158-208) and **Aarakocra Skirmisher** MA-0007. Mimic row omits the field → offer NEVER renders (live-confirmed: zero offer chrome on every HIT popup; zero conditional_damage_granted/declined in log).
  No alternative grapple-reactive damage consumer exists: grep `grappled` **ZERO hits** in MonsterCardModal.jsx / MonsterAction.jsx / useLoggedDiceRollDamage.js / handlePlainDamage.js; MA-0655 enlarged dice-doubling is te `enlarged`-keyed, not grapple.
- **Clause A — NO SEAM AT ALL → GM-adjudicated ADVISORY (§MA-0679 class; MA-0442 "adv-if-grappled compound-inert 0/16", MA-0444 "grapple-adv prose zero producer, PC-Grappler-gated channel only"):**
  Target-condition advantage table `countTargetConditionAdvantage` (src/services/automation/contextBuilder-sync.js:185-195) covers blinded/charmed/paralyzed/petrified/stunned/unconscious/restrained/dazed/slow — grappled deliberately absent (RAW-correct baseline). Grapple-advantage producer = `countGrapplerAdvantage` (:198-205) gated on `playerStats.saveModifiers` (PC Grappler feat lane only). Monster advantage arrives only via te riders (`next_attack_advantage`, `bolster_advantage` MonsterCardModal.jsx:1191-1201, vex) — zero grappled-target producer for monster attacks; "grappled BY THE MIMIC" requires owner-tracking which is unbuilt app-wide (§69 grapple-family state machine unbuilt, targetEffectDefinitions.js:1182). Live popup chrome offers manual Advantage/Disadvantage buttons (GM mitigation, pressed 0×; all 9 attacks logged `mode:"normal"`, `advantageReason:null`).

## Live E2E (Playwright, test-campaign, 2026-09-25)
Header verified `test-campaign`. EB join 1× Mimic + 1× Bandit (cs: Mimic 1 idx mimic hp58, Bandit 1 idx bandit hp11→AC12). §454 TRUSTED keyboard HP rig Bandit 1 → 999 server-verified BEFORE arming (§148/§447); target armed on Mimic 1 own tracker row → `cs.creatures['Mimic 1'].targetName:"Bandit 1"` server-verified (§452).
- **Row chip audit:** Bite row = exactly ONE `span.mc-dice-link` "+5"; DC chips **0** (`.mc-dice-link-save` selector count 0); row-scoped advantage/toggle affordances **0** (`[role=switch]/[role=radiogroup]/[role=tablist]/checkbox` = 0). Cosmetic "()" range artifact (§445 twin).
- **Fires (9 attacks, honest d20):** nat7 hit / nat14 hit / nat7 hit / nat20 **CRIT** / nat9 hit / nat18 hit / nat10 hit / **nat5+5=10 vs AC12 ✗ honest MISS (zero damage, zero hp_change)** / nat14 hit (grappled probe). Popup totals = nat+5 exact every press (§452 leading-total). Zero-fire absorbed presses (§442) occurred — log-delta ledger after every click, refired.
- **Per-hit damage (7+1 entries):** ONE damage log entry per hit, formula **"1d8 + 3"** Piercing + secondary **"1d8"** Acid riding the SAME entry via secondaryFormula/secondaryRolls/secondaryTotal/secondaryFinalDamage (§454) — e.g. {formula:"1d8 + 3",total:5,secondaryFormula:"1d8",secondaryTotal:4}. **fd+secFD == |hpΔ| every hit**: 9+15+11+15+13+7+14 = 84; Bandit 999→915 byte-exact chain (§442).
- **Crit §32:** nat20 popup "CRITICAL HIT! — DAMAGE DICE DOUBLED"; damage `formula:"1d8*2+3 (5)" total 13` (dice doubled, flat +3 undoubled ✓); secondary doubled too — `secondaryRolls:[1]` secTotal 2 (rollExpressionDoubled handlePlainDamage.js:87-88; secF text stays "1d8" cosmetic).
- **rangeReason:** `null` on every attack — gridless advisory (MA-0679/MA-0689 class), not a defect.
- **GRAPPLE-STATE PROBE (MA-0687 Add/Apply seam):** Bandit 1 initiative-card "Add" → `.ea-overlay` Conditions tab → **Grappled → Apply**. Grants LAND: change-data `Bandit 1.activeConditions:["grappled"]` + `activeConditionMeta.grappled{dc:10,ability:"str"}` + log `condition applied Grappled` (cs GET omitted activeConditions key — §447 read cd/log, decisive).
  **Fire Bite vs grappled Bandit 1 → nat14+5=19 HIT, `mode:"normal"`, `advantageReason:null`, NO conditional offer on popup, damage STAYS `formula:"1d8 + 3" fd:5` + `secFD:8` — damage does NOT become 2d8+3.** Clause B unarmed confirmed live with grapple state genuinely present. (GM mitigations: popup Advantage/Disadvantage manual buttons + hand-dice; both clauses remain GM-enforceable only.)

## Likely Location & Fix (`public/data/monsters.json` mimic.actions[0])
One-field DATA fix, Chimera MA-0485 byte-shape:
```
"conditional_damage": { "dice": "2d8", "modifier": 3, "damage_type": "Piercing",
  "condition": "the target is Grappled by the mimic" }
```
(or delta-shape `dice:"1d8"` if adopting additive-delta convention — Chimera ships the full-replacement-dice shape; resolver applies base Done + clause roll, so document the chosen convention when authoring). Clause A requires NO disk field — stays GM-adjudicated at the popup until a grapple-owner state machine exists (accepted residual).

## Cleanup
Admin panel UI "Clear Change Data" + "Clear Campaign Log" (confirm dialogs accepted): post-GET proof log=[] (0), change-data={}, combatSummary `{value:null}`; +14s quiet no-resurrection.
