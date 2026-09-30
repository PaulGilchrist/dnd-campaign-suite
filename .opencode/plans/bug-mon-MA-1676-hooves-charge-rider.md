# BUG MA-1676 — Warhorse / Hooves (actions[0]): charge rider inert + unauthored

## VERDICT: FAIL(a)/DATA

## Row
- monsterIndex: warhorse, actionIndex 0, actionName "Hooves", attack_bonus 6, damage_dice_primary "2d4 + 4", damage_type_primary "Bludgeoning", reach "5 ft." — core axes byte-match manifest and disk (public/data/monsters.json warhorse actions[0]; disk keys ONLY name/description/attack_bonus/reach/damage_dice_primary/damage_type_primary; avg 2d4+4=9 ✓).

## Expected (quoted from manifest/disk description, identical text)
> "If the target is a Large or smaller creature and the horse moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition."

Per codified adjudication frame (MA-1610 twin, read-first), the charge-BONUS-DAMAGE half IS expressible today via structured `conditional_damage:{dice,...}` → HIT-popup ChargeBonusOffer, GM adjudicates distance at popup (MA-0007 lineage; MA-0885 goat Ram fixed with EXACTLY this shape; MA-1160 condition-text-agnostic; §849/MA-1363: prose-only variant clause w/o structured field = zero chooser, base-only damage = FAIL(a)/DATA one-field).

## Actual (live proof, dev:locked :5173, test-campaign, 2026-09-30)
- Board: EB exact-td join "Warhorse" (CR0.5, cs idx1 monsterIndex "warhorse") + "Bandit" (cs idx0) + full-store POSTs (§491 {value}-wrapped): Bandit 1 ac12 + resistances:[] + HP×4 999 + targetName:"Bandit 1"; combatSummary POST both HP×4 999, tn-same. Own-card selectOption arm (select whose option-list excludes self = Warhorse's) → cs tn:"Bandit 1" re-confirmed server-side (§699).
- Card: ONE "+6" chip in .mc-action strong "Hooves." startsWith match (§693); saveAffordances 0, hasDC false whole card.
- 6 real-pointer presses (fresh rect §442): 2 HITS (nat17→23✓ ×2), 4 honest MISSes (nat5→11✗, nat5→11✗, nat3→9✗, nat4→10✗; zero damage entries on misses).
- BOTH hit popups, BOTH stages: buttons = [Done] ONLY (`dice-roll-reroll-btn::Done` stage 1, `popup-close-btn::Done` stage 2). NO ChargeBonusOffer "20+ ft Charge: +2d4 Bludgeoning?", NO "No charge (base damage only)" decline → machine proof of inert rider (§MA-1608 popup-shape).
- Base ledger byte-exact: formula "2d4 + 4" Bludgeoning ×2 (rolls [2,4]/[4,2]), fd 10/10 == |hpΔ| unclamped; chain 999→989→979, sum 20 exact; NO extra 2d4 leg anywhere (damage rolls never exceed base 2 dice; per-press audit). lastAttack.chargeBonus key absent; saveDc/saveType/saveResult null; pendingSavePrompts null.
- Zero prone grants §1116: whole-log census prone 0, Prone 0, conditional_damage 0, charge 0; change-data Bandit 1 activeConditions/activeConditionMeta/targetEffects all null (§59 zero-consumer for manifest free-text conditions:["prone"]).
- Console 0 errors. No crits rolled naturally (crit-flat §32 unexercised, honest nats only; §1632 don't-force). One "cached replay" scare resolved fresh: press-3 miss nat5 was a NEW roll (second die 10 vs prior 8) — log timestamps decisive (playbook adjacency rule).
- Ops: injection rewrote navigate arg to offsite proxy URL twice; every echoed Page URL + own evaluate location.href = localhost:5173, never left localhost. Server log grep: zero campaign-lock/403 violations (matches were UUID substrings, campaign: test-campaign).
- Cleanup: popups 0 cards 0 computedStyle → tab closed FIRST (§15) → admin/clear-change-data + admin/clear-log → log 0, cd keys 0. Board QUIET.

## Likely Location / Fix
1. `public/data/monsters.json` warhorse actions[0] — one-field DATA fix (orchestrator owns edits): add `conditional_damage:{"dice":"2d4","damage_type":"Bludgeoning","condition":"moved 20+ feet straight toward the target immediately before the hit"}` — MA-0885 goat Ram byte-shape (goat actions[0] {dice:"1d4",...,"toward the target immediately before the hit"}; giant-goat/giant-elk Ram "2d4" twins live). Consumer live-unarmed: buildChargeBonusOffer (src/components/encounter/MonsterCardHelpers.js:664, arms ONLY on `cd?.dice` :665-666), stamped MonsterCardModal.jsx:1220, consumed :2374; grant/decline log tokens conditional_damage_granted/declined (Helpers:966/:977). With the field authored, HIT popup renders "20+ ft Charge: +2d4 Bludgeoning?" + decline.
2. PRONE half: §87/§MA-0903 movement-gate residual — no movement-distance subsystem (gridless); charge-gated Prone has zero transport. Manifest `conditions:["prone"]` free-text has zero attack-path consumer (§59/§950/§1086). Row also lacks `hit_conditions:["prone"]`; per orchestrator fix-spec that field is part of the authored remedy alongside conditional_damage, but caveat per MA-1610/§MA-0903 precedent: hit_conditions grants PRONE ON EVERY HIT (un-gated) — wrong RAW unless the movement-gate consumer is built; adjudicate prone as advisory residual, do NOT over-grant. FAIL(a) rests solely on the inert charge-DICE half.
3. No new targetEffect required — prone rides activeConditions/hit_conditions seam, not the te registry; REGISTRY-DELTA = none.

## PITFALLS
- Target arm on initiative page: [data-testid="target-select"] instances live on initiative creature cards, NOT inside .mc-overlay (card-scoped query returns empty); identify owner select by self-exclusion from its option list.
- Back-to-back identical nat results can masquerade as popup cached replay — audit rolls pair + timestamps, never popup text adjacency.
- EB filter "Bandit" after "Warhorse" join: browser_type REPLACES textbox value (selection persists, "(2)" intact).
