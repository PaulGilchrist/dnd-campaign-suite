# Bug CLA-113 — Elemental Epitome: chosen-type Resistance render-only + Destructive Stride damage lane dead in both hosts

## Title
Elemental Epitome (Warrior of the Elements): epitome chosen-type resistance is never consumed by applyDamage (full damage lands), and Destructive Stride's proximity damage never resolves on either UI host (two independent signature mismatches). Empowered Strikes leg works.

## Overview
Verified on Disciplined_Monk lv20 (temp swap to Warrior of the Elements, reverted after; Attunement activated as prerequisite). Epitome activation, badges, chosen-type persistence and the Empowered Strikes rider (featureRiders lane) all work. Two of three sub-effects are inert.

## Expected Behavior
Feature text (classes.json Warrior of the Elements block): While Elemental Attunement is active —
1. Resistance to a chosen type (Acid/Cold/Fire/Lightning/Thunder), changeable at start of each of your turns.
2. Destructive Stride: Step of the Wind → Speed +20 until end of turn; a creature of your choice within 5 ft when you enter its space takes 1 Martial Arts die of chosen type, once per turn per creature.
3. Empowered Strikes: once per turn, extra 1 Martial Arts die (same type) on Unarmed Strike hit.

## Actual Behavior
1. PASS — activation: Attunement(Fire) → `elementalAttunementActive=true`; Epitome row → `elementalEpitomeActive=true`, modal sets `epitomeResistanceType="Fire"` + `activeBuffs[{effect:'epitome_resistance',damageType:'Fire'}]`; badge renders; FP untouched by activation.
2. FAIL(a) — Resistance: Fire Bolt vs host hit 29 → `4d10 [fire]=27`, `finalDamage:27, resistanceReduction:0, resisted:false`, HP 183→156 FULL. Producer writes `damageType`; applyDamage `addBuffResistances` reads `resistanceTypes` only; `epitome_resistance` appears NOWHERE outside elementalEpitomeHandler.js (grep-zero consumer). CLA-110 render-only family.
3. PASS — Empowered Strikes: `1d12+5 [bludgeoning] + 3d6 [fire] + 1d12 [Empowered Strikes]` (37); latch `epitomeEmpoweredUsedRound`; 2nd unarmed same round no rider; Quarterstaff (weapon) control no rider — unarmed-only gate live.
4. FAIL(b) — Destructive Stride damage: 0 damage across 3 attempts on both hosts:
   - CharActionModals.jsx:331 — type-confirm calls `handleDestructiveStrideConfirm(chosenType)` but DestructiveStrideModal self-applies and passes a RESULT OBJECT → double-apply, second returns null → picker never mounts.
   - CharSpecialActions.jsx:558 — picker mounts but calls `applyTargetChoice(action, ps, camp, …)` POSITIONALLY against an object-destructure signature → `getCombatSummary(undefined)=null` → silent null.
   - "+20 Speed" badge is render-only (no numeric speed); no once-per-creature latch code exists (modal-per-use only gate). FP auto-spends PRE-modal (CLA-112 pattern) — abandoned chains leak FP.
5. Deactivation: static clear-list ElementalAttunementModal.jsx:544-548 covers epitome keys but LEAKS `activeBuffs:'Elemental Epitome'` entry + `destructiveStrideActive/DamageType`; live expiry unverifiable in roster-seeded sandbox combat (Next inert — §70 token advisory family).

## Steps to Reproduce
1. test-campaign; Disciplined_Monk → step-7 Warrior of the Elements → Save+reload.
2. Activate Elemental Attunement (Fire: checkbox-target → Activate → Close results).
3. Activate Elemental Epitome, pick Fire.
4. Second caster Fire Bolt the monk → full damage, resisted:false (Bug 1).
5. Use Step of the Wind → type modal → confirm → no target picker / zero damage either host (Bug 2).

## Likely Location
- Resistance: applyDamage.js `addBuffResistances` (reads resistanceTypes) — consume `damageType` on effect:'epitome_resistance', or push chosen type into computed resistances at choice-time (CLA-110 fix twin).
- Destructive Stride: CharActionModals.jsx:331 (pass-through shape mismatch) and CharSpecialActions.jsx:558 (positional vs object signature); add once-per-turn creature latch per data clause.

## Notes
- Empowered Strikes PASS leg: featureRiders attackRollPostDamage.js:35 — lane healthy.
- Attunement modal: Skip does NOT activate; only checkbox-target→Activate→Close sets active flag — keep sacrificial target.
- change-data GET shape `{ "<charKey>": "<json-string>" }` at `/api/campaigns/:c/:key`; char JSON needs `.json` suffix (wildcard eats bare name).
- Subclass REVERTED to Warrior of the Open Hand (disk+UI); change-data/log cleared GET-verified. Verified 2026-10-04.
