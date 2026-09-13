# Bug MA-0044 — Adult Blue Dracolich Multiattack: Frightful Presence named mechanic inert (Frightened never applied on failed save)

## Verdict: FAIL (MV-39 precedent; core bite+claws EXACT)

## Expected
Row: "The dracolich can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws."
- Bite: +13, 2d10+7 piercing (+5 lightning per RAW description).
- Claw ×2: +13, 2d6+7 slashing.
- Frightful Presence: DC 18 Wisdom save; on FAILURE target becomes Frightened (1 min), with repeat saves / 24h immunity.

## Actual — CORE PASS (bite+claws EXACT)
- Bite: d20 7 +13 = 20 vs AC 19 ✓ HIT → Done → 2d10+7 [10,4]+7 = 21 piercing → EP 224→203; lastAttack.hit/damageApplied true, logs roll+damage+hp_change.
- Claw: d20 15 +13 = 28 ✓ HIT → 2d6+7 [6,3]+7 = 16 → 203→187; d20 10 +13 = 23 ✓ HIT → 2d6+7 [2,1]+7 = 10 → 187→177. All to-hit/damage exact vs authored.
- Data drift: Bite secondary "+5 (1dlO) lightning" is description-only, NOT structured (no damage_dice_secondary) → lightning half unrolled (cosmetic, core dice exact).

## Actual — FAIL (Frightful Presence named mechanic zero effect path)
- FP row DOES expose a clickable "DC 18 Wisdom" affordance (differs from MA-0039 Adult Black inert text) and DOES open a generic sp-modal save ("ElderPaladin must make a WISDOM saving throw. DC 18"). Wrong boilerplate "Half damage on successful save" (FP deals NO damage — MV-19).
- Forced SAVE FAILURE: d20 2 +10 = 12 vs DC 18 → DONE.
- POST-fail state: ElderPaladin activeConditions ABSENT (null), combatSummary conditions null, campaign log `condition/applied` entries = ZERO. `fright` present in change-data ONLY as data echo + lastAttack/save stamp metadata, never as an applied condition.
- Root cause: saveConditions:["frightened"] IS extracted (MonsterAction.jsx:33 buildSaveOptions→MonsterCardModal.jsx:213) and stamped onto lastAttack/_lastRollContext, but applyFailedSaveConditions (saveProcessing.js:304) is invoked exclusively from within applySaveDamage (:420), gated `if (context?.autoDamageFormula && saveDc != null)` (:130/:283). FP has no autoDamageFormula → applySaveDamage branch skipped → applyFailedSaveConditions never runs → Frightened never applied. NPC variant (handleNpcSaveDamage.js:648) requires context.statusEffects, never populated by the FP path. FP condition application is structurally unreachable.

## Repro
1. test-campaign → Encounters → search "Adult Blue Dracolich" → tick → Join Encounter (init 2, HP 225).
2. `.creature-card.npc` target-select → ElderPaladin (AC 19, HP 224).
3. Dragon turn → avatar → `.mc-overlay`: Bite "+13" ×1 → Done → 21 pierce exact. Claw "+13" → 28 HIT 16, → 23 HIT 10 exact.
4. Frightful Presence "DC 18 Wisdom" → Roll Save → force FAIL (12 vs DC 18) → Done → ElderPaladin NOT Frightened, no condition log.

## Likely Location
- `src/hooks/combat/saveProcessing.js:130,283,420` — condition application coupled to autoDamageFormula presence.
- `src/components/encounter/MonsterCardModal.jsx:578 handleSaveRoll` / `MonsterAction.jsx:33` — saveConditions extracted but no consumer without damage.

## Verdict
FAIL — multiattack bite+claws core fully live+EXACT, but named Frightful Presence mechanic has zero effect path (Frightened never applied on failed save). Same fingerprint as MA-0039 (FP named mechanic zero cast/effect path), refined: affordance present + save rolls, but condition resolution is dead code for damageless saves.
