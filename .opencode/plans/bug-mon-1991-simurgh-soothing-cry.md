# MA-1991 — Simurgh "Soothing Cry (Costs 2 Actions)" legendary child: silent-burn, condition-end inert (FAIL(b)/DATA)

## Overview
Simurgh legendary_actions[3] `Soothing Cry (Costs 2 Actions)` is the MA-1936/MA-1990 twin: a `delegates_to:null` prose-only legendary child. The Expend chip lives; pressing at a legal boundary spends 2 legendary uses honestly (Costs-2 enforcement live), emits console.error "no resolvable mechanic", shows zero popup, and ends ZERO conditions. The condition-REMOVAL transport ("ending one effect causing them to be Charmed, Frightened, or Confused") is §70 grep-zero territory — ruled out live with a pre-applied Frightened victim. LA burns 2/press with no mechanic.

## Expected (row + monsters.json)
- Manifest row: MA-1991, actionIndex 3, actionType "condition", conditions ["charmed","frightened"] (extraction noise — even omits Confused; raw effect is a condition-END on allies, not an apply).
- RAW: "Each ally within 60 ft. is calmed, ending one effect causing them to be Charmed, Frightened, or Confused."
- Disk shape (public/data/monsters.json L59530-59534, byte-shape recorded):
  `{ "name": "Soothing Cry (Costs 2 Actions)", "delegates_to": null, "description": "Each ally within 60 ft. is calmed, ending one effect causing them to be Charmed, Frightened, or Confused." }`
  — prose-only: no numeric fields, no automation, no advisory, explicit `delegates_to:null` (distinct from sibling Healing Breath [2] which carries only name+description).

## Actual
Press at legal boundary spends 2 uses, console.errors, and does nothing else:
- cd `Simurgh 1.monsterLegendaryUses` 0→2 (key CREATED by press); log `ability_use`: "Simurgh 1 spends 2 legendary uses for Soothing Cry (Costs 2 Actions) after AasimarTest's turn — 1 of 3 left".
- Console ERROR (exact): `[MonsterCardModal] legendary action "Soothing Cry (Costs 2 Actions)" delegates_to "null" — no resolvable mechanic on "Simurgh 1"` — MA-0510/MA-1936 signature.
- ZERO popup from press; ZERO rolls (session rolls = init-only); ZERO hp_change; ZERO condition log entries attributable to the press.
- Live §70 ruling-out: Bandit 1 pre-rigged Frightened via GM Add→Conditions chip→Apply (cd `activeConditions:["frightened"]` GET-verified, card closed for Add per §76). Press #1 → Frightened INTACT (`activeConditions` unchanged); only condition entries in whole log are the GM rig applied/broken pair. No cleanse/calm/condition-end transport exists on this lane.
- Economy gates honest (NOT display-only): same-boundary re-press → `legendary_use_refused (turn)` zero-spend popup+log; fresh boundary (AberrantSorcerer, post cs mirror unstick MA-1852) → `refused (insufficient-cost: costs 2, 1 left)` zero-spend = Costs-2 enforcement LIVE (MA-1920/1944 family re-confirmed).

## Steps to Reproduce
1. :5173 → test-campaign → EB join Simurgh x1 + Bandit (exact) x1. Join lands WITHOUT cs.activeCreatureName (MA-1990 pitfall): unstick via full-store POST /combatSummary {value:{...cs, activeCreatureName: topTruth}} (topTruth = cd.activeCreatureName, e.g. AasimarTest).
2. GM Add on Bandit 1 → Conditions tab → Frightened chip → Apply → close `.ea-overlay` (§76). cd Bandit 1.activeConditions=["frightened"].
3. Open Simurgh card; row-scoped strong startsWith "Soothing Cry" → single "Expend Legendary" chip (title hardcodes "Expend 1 legendary use", cosmetic MA-1944 lie at cost-2).
4. Page.mouse.click fresh rect at the legal boundary: spend 0→2 + console.error "no resolvable mechanic", zero popup, Frightened intact.
5. Same-boundary re-press → (turn) refusal; fresh boundary press → (insufficient-cost: costs 2, 1 left). Bandit never un-frightened by any press.

## Likely Location
**monsters.json DATA drift** — the row is prose-only with `delegates_to:null`, so `resolveLegendaryRowMechanic` (MonsterCardModal.jsx, advisory branch :755 checked BEFORE numeric/delegate legs) finds no advisory, no numeric payload, no delegate, and hits the MA-0510 console.error dead-end (:776). No consumer code fix is needed for the verdict: grep-zero proves no condition-END consumer exists for legendary rows —
- `soothing` : ZERO hits src/**.
- calm/cleanse hits: PC spell lane ONLY (calm_emotions concentration/service/clearExpirationEffects SP-020, mass_cure_wounds, greater_restoration, countercharm).
- saveProcessing.js: ZERO soothe/calm/cleanse/condition-end-from-monster-legendary hits.
- monsterLegendaryUses.js condition code = `parseLegendaryAllyPrerequisite` gate (ally-prerequisite READ lane, e.g. "no creature is currently X by Y" refusals), not a condition-END producer.
- applyDamage.js removeConditionFromList = took-damage charmed/frightened clear (damage-axis), unrelated.

## Fix (MA-1944 option-A precedent)
Flat `advisory:"soothing_cry"` + `advisory_message` carrying the RAW text ("Each ally within 60 ft. is calmed, ending one effect causing them to be Charmed, Frightened, or Confused — GM-enforced."), authored AFTER `delegates_to:null` per MA-1936 byte-shape. Per MA-1975, `advisory` and `delegates_to` are EXCLUSIVE on legendary rows — drop or null the `delegates_to` per family precedent (explicit null tolerated by MA-1936 shape; the advisory branch preempts it at :755). Record-only honest spend preempts numeric/delegate legs.

## Notes
- Manifest `conditions:["charmed","frightened"]` = extraction noise (actionType "condition" is an APPLY label on an END/cure effect; Confused omitted). Renderer keys disk fields only (MA-0548) — inert manifest keys, record-only.
- Simurgh Purifying Aura trait (turn-start curse/disease/poison removal) is the same §70 zero-consumer cure family.
- Session boundary mechanics: cs mirror froze at AasimarTest after join AND again post-walk (preActive "AasimarTest" while top truth AberrantSorcerer) — MA-1852 full-store unstick restored pressability both times; refusal-popup flush via inner button.popup-close-btn; .mc-close before Initiative Next.
- Cleanup verified: Frightened removed via badge × (cd activeConditions[]), card closed, admin-cleared cd+log :80, GET-quiet two-pass ({} / []), app RUNNING. test-campaign only; no monsters.json writes.
