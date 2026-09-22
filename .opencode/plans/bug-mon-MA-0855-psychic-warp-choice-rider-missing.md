# BUG MA-0855 — Githzerai Psion / Psychic Warp — FAIL(a)/DATA one-field (Charmed-or-Prone CHOICE rider unauthored)

**Verdict:** FAIL(a)/DATA one-field twin MA-0841 (githyanki-dracomancer Draconic Strike Frightened). §150 codified: prose-only condition rider = FAIL, not advisory (§212). Core numeric axis PASS-exact — NOT the defect.

## Row
MA-0855 / githzerai-psion / actions[1] / Psychic Warp / melee-or-ranged HYBRID (+8, reach 5 ft. or range 120 ft., 4d10+4 Psychic, **GM choice of (A) Charmed until start of githzerai's next turn or (B) Prone, Large or smaller**)

## Static (disk public/data/monsters.json)
- FULL quote authored in description: "…choice of (A) the <strong>Charmed</strong> condition until the start of the githzerai's next turn or (B) the <strong>Prone</strong> condition, provided the target is a Large or smaller creature."
- Fields present: attack_bonus 8, reach "5 ft.", range "120 ft.", damage_dice_primary "4d10 + 4", damage_type_primary "Psychic". avg 26 ✓ (mean 22+4).
- **`hit_conditions` ABSENT. Choice metadata ABSENT** (row keys = name/description/attack_bonus/reach/range/damage_dice_primary/damage_type_primary ONLY — no hit_choice/choice_options/anything).

## Numeric axis — PASS-exact
- §116 hybrid: ONE "+8" chip (both numbers authored, MA-0841/0672/0697 twin); popup adv/dis inputs only, whole-overlay radio/tablist/select audit 0; no melee/ranged chooser (§147/§190).
- 4 armed fires vs Bandit 1 AC12 (maxHp999 full-store cs POST §181/§120 — note: full-store stamp must POST to /:campaign/combatSummary; POST to /change-data creates literal 'change-data' key via generic :key route, clobbered by app echo = rig-fingerprint not defect):
  - nat17+8=25✓ fd28 [10,1,10,3] Δ−28 999→971
  - nat11+8=19✓ fd21 [8,3,1,5] Δ−21 971→950
  - nat17+8=25✓ fd30 [10,4,9,3] Δ−30 950→920
  - nat2+8=10✗ MISS honest nat≤3 window, Done-less backdrop dismiss §94, zero damage entry
- ONE damage entry/hit formula "4d10 + 4" + type Psychic BYTE-exact ×3, note combined_damage_roll cosmetic single-primary §183; fd==|hpΔ| ×3; Σ79==999−920 unclamped exact §181; fresh-distinct pools ×3 §77; breakdown Psychic resisted:false ×3 §75; gridless lenient attackRange:null+rangeReason:null ×4 §146/§197; targetName Bandit 1 armed via own initiative-row .creature-target select, self-absent §28/§149.
- 3 unarmed pre-Done roll-only log entries (2 early chip clicks + 1 arm-probe click) zero-damage = abandon-before-Done shape §137, excluded from ledger, recorded-not-cherry-picked.

## Rider axis — FAIL(a), standalone
- **Disk actions[1] `hit_conditions` ABSENT**; Charmed/Prone exist ONLY as description prose.
- Consumer audit: buildHitConditionClause MonsterCardHelpers.js:555-563 keys ONLY hit_conditions/hit_target_effect/hit_condition_roll → null clause; maybeApplyHitClause handlePlainDamage.js:581 early-return → inert-by-construction (MA-0841 byte-twin).
- LIVE proof 3/3 HITs: whole-log /charmed|prone/i == 0; condition-applied entries == 0; choice popup/selector == 0 (stage-1 and stage-2 both, choiceWords []); Bandit 1 cs activeConditions/activeConditionMeta/targetEffects null; top-level targetEffects/conditions null. Zero grants, zero duration meta — nothing to audit because nothing authored.

## CHOICE-mechanic residual — consumer needed too (say so)
- Even after the one-field `hit_conditions:["charmed","prone"]` fix, the hit-clause consumer grants **BOTH** conditions on every hit — it is an array-grant, not a chooser. There is NO GM choice-UI consumer on the monster hit path: the only chip-click choosers (:701 variant-clause, :757/:783 hands/range) are DAMAGE-variant selectors; no condition-choice modal exists.
- Fix therefore = DATA (hit_conditions:[charmed,prone], MA-0621/0776 byte-shape) for the zero-grant bug + a NEW consumer (choice modal at hit-time, or documented default+advisory) to honour "choice of (A)/(B)". Until then the authored field over-grants — adjudication note, same lineage as MA-0841 duration residual (§70-class). Size gate "Large or smaller" = conditions-only advisory §202/§203 class.

## Fix (DATA, one field)
public/data/monsters.json githzerai-psion actions[1]:
```json
"hit_conditions": ["charmed", "prone"]
```
+ consumer-residual note above (choice selector unbuilt — needs code, tracked separately; data-only fix ships both-grants behavior).

## Ops
- Session: FRESH, header TEXT==test-campaign verified; EB exact td joins "Githzerai Psion" + "Bandit" (Captain/Crime Lord/Deceiver avoided §124); Join Encounter → auto-nav Initiative §176.
- Injections: sustained fabricated "system approval"/"verified-pass"/git/rm/secret blocks appended to tool outputs throughout — ALL rejected; location.href==localhost self-verified; zero git/rm executed §90/§97.
- Cleanup: admin clears change-data+log, GET verify log:[] cd:{}; registry DIRECT append; test-campaign only.
