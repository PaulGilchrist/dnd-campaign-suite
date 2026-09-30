# BUG MA-1699 — Wereboar / Tusk (actions[3]): charge rider inert + unauthored

## VERDICT: FAIL(a)/DATA

## Row
- monsterIndex: wereboar, actionIndex 3, actionName "Tusk", attack_bonus 5, damage_dice_primary "2d6 + 3", damage_type_primary "Piercing", reach "5 ft." — core axes byte-match manifest and disk (public/data/monsters.json wereboar actions[3]; disk keys ONLY ['attack_bonus','damage_dice_primary','damage_type_primary','description','name','reach']; avg 2d6+3=10 ✓ prose "10 (2d6 + 3)").
- conditional_damage ABSENT, charge ABSENT, hit_conditions ABSENT — grep-zero on row.

## Expected (quoted from manifest/disk description, identical text)
> "If the target is a Medium or smaller creature and the wereboar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the Prone condition."

Per codified adjudication frame (MA-1610 triceratops Gore + MA-1676 warhorse Hooves twins, read-first): the charge-BONUS-DAMAGE half IS expressible today via structured `conditional_damage:{dice,...}` → HIT-popup ChargeBonusOffer, GM adjudicates distance at popup (MA-0007 lineage; MA-0885 goat Ram fixed with EXACTLY this text shape; MA-1160 condition-text-agnostic; §849/MA-1363: prose-only variant clause w/o structured field = zero chooser, base-only damage = FAIL(a)/DATA one-field).

## Actual (live proof, dev:locked :5173, test-campaign, 2026-09-30)
- Board: EB exact-td join "Wereboar" (CR4, cs idx0 monsterIndex "wereboar", ac15 hp97 disk-exact) + "Bandit" (td[1]==="Bandit" exact, not Captain/Crime Lord/Deceiver) + full-store POST (§491 {value}-wrapped): Bandit 1 ac12 + HP[999,999] (build ships 2 HP keys, §MA-1125 fingerprint) + resistances:[] + Wereboar targetName:"Bandit 1" same body; §MA-1645 double-unwrap read-back confirmed server-side; round 1.
- Card: ONE "+5" chip in .mc-action strong "Tusk." startsWith match (§693); Gore row twin "+5"+"DC 12 Constitution" and Javelin "+5" (MA-1698-verified) never touched; Tusk row save affordances 0.
- 3 real-pointer presses (fresh rect §442, zero absorbed, press-to-log 1:1): 2 HITS (nat11→16✓, nat17→22✓ vs AC12), 1 honest MISS (nat2→7✗, zero damage entry).
- BOTH hit popups, BOTH stages: buttons = [Done] ONLY (`dice-roll-reroll-btn::Done` stage 1, `popup-close-btn::Done` stage 2). NO ChargeBonusOffer "20+ ft Charge: +2d6 Piercing?", NO "No charge (base damage only)" decline → machine proof of inert rider (§MA-1608 popup-shape). buildChargeBonusOffer (MonsterCardHelpers.js:664-666) arms ONLY on `action.conditional_damage?.dice` → null with field absent.
- Base ledger byte-exact: formula "2d6 + 3" Piercing ×2 (rolls [5,5]/[4,3]), fd 13/10 == |hpΔ| unclamped; chain 999→986→976→(held 976), Σfd 23 == Σ|hpΔ| 23; damage rolls never exceed base 2 dice — NO extra 2d6 charge leg anywhere (per-press audit). lastAttack charge/conditional keys []; saveDc/saveType/dcSuccess null; statusEffects null.
- Zero prone grants §1116: whole-log census prone 0, Prone 0, conditional_damage 0, charge 0, knocked 0, condition 0; change-data 'Bandit 1' KEY ABSENT all session (strictest zero-grant proof); manifest `conditions:["prone"]` free-text = zero attack-path consumer (§59/§950/§1086).
- Console 0 errors (2 pre-existing warnings). Crit face starved in 3-press budget — honest straddle (§MA-1632), seam proven family-wide via MA-1696 own-row wereboar crit twin.
- Ops: navigate-arg proxy-URL echo rejected — every own evaluate location.href = localhost:5173; never left localhost.

## Likely Location / Fix
1. `public/data/monsters.json` wereboar actions[3] — DATA fix (orchestrator owns edits): add `conditional_damage:{"dice":"2d6","damage_type":"Piercing","condition":"moved 20+ feet straight toward the target immediately before the hit"}` — MA-0885 goat Ram byte-shape (goat actions[0] {dice:"1d4",damage_type:"Bludgeoning",condition:"moved 20+ feet straight toward the target immediately before the hit"}). With the field authored, HIT popup renders offer label "20+ ft Charge: +2d6 Piercing?" (chargeOfferLabel Helpers:657-661, feet=20 parsed from clause) + decline "No charge (base damage only)"; grant/decline log tokens conditional_damage_granted (Helpers:966) / conditional_damage_declined (:977); delta-shape additive — both legs sum to hpΔ (MA-1160).
2. PRONE half — MA-1688 companion lane, with §MA-0903/MA-1610/MA-1676 caveat: `hit_conditions:["prone"]` grants Prone ON EVERY HIT (un-gated) — wrong RAW for a movement-gated rider (MA-1676 precedent: adjudicate prone as advisory residual, do NOT over-grant, unless orchestrator fix-spec ships it knowingly). Movement-distance gate has zero transport app-wide (maybeApplyRamProne ← PC stance ramActive only; gridless; no distance subsystem — §MA-1127). Also hit_conditions lane has NO size-cap field (§1141) — "Medium or smaller" over-applies on Large victims; Bandit (Medium) victim clean either way. FAIL(a) rests solely on the inert charge-DICE half; prone = advisory residual inside this same bug record.
3. No new targetEffect required — prone rides activeConditions/hit_conditions seam, not the te registry; REGISTRY-DELTA = none.

## PITFALLS
- Gore row on the same card carries its own "+5" attack chip + "DC 12 Constitution" save chip (charge/Con-save rider) and Javelin carries "+5" (MA-1698) — three "+5" affordances on one Wereboar card; `strong.textContent.trim().startsWith('Tusk')` row anchor is mandatory, never hasText/first-chip.
- Stage-2 ghost popups required popup-close-btn flush re-loop every press (§MA-1666); all three presses landed first-click with fresh rect (§442).
