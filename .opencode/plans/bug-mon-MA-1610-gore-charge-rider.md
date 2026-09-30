# BUG MA-1610 — Triceratops / Gore (actions[1]): charge rider inert + unauthored

## VERDICT: FAIL(a)/DATA

## Row
- monsterIndex: triceratops, actionIndex 1, actionName "Gore", attack_bonus 9, damage_dice_primary "2d12 + 6", damage_type_primary "Piercing", reach "5 ft." — core axes byte-match manifest and disk.

## Expected (quoted from manifest/disk description, identical text)
> "If the target is Huge or smaller and the triceratops moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition."

Per codified adjudication frame, the charge-BONUS-DAMAGE half of this clause IS expressible today via structured `conditional_damage:{dice,...}` on the row → HIT-popup ChargeBonusOffer, GM adjudicates distance at popup (MA-0007 lineage; MA-0885 goat Ram fixed with EXACTLY this text shape + label "20+ ft Charge: +NdX?"; MA-1160 condition-text-agnostic; §849 MA-1363: prose-only variant clause w/o structured field = zero chooser, base-only damage = FAIL(a)/DATA one-field).

## Actual (live proof, dev:locked :5173, test-campaign, 2026-09-29)
- Board: EB exact-td Triceratops join ("Triceratops 1" cs idx0) + Bandit ("Bandit 1", ac12, HP 999, targetName="Bandit 1" same full-store cs POST) + own-card selectOption arm (tn re-confirmed server-side).
- 6 presses on Gore "+9" chip (single chip, §116 self-suppress), all audited:
  - 4 HITS (nat20 crit, nat9, nat4, nat16; popup totals 29/18/13/25 = nat+9 exact).
  - EVERY popup, BOTH stages: buttons = [Done] ONLY (`dice-roll-reroll-btn::Done` stage 1, `popup-close-btn::Done` stage 2). NO ChargeBonusOffer "20+ ft Charge: +2d8 Piercing?", NO "No charge (base damage only)" decline button → machine proof of inert rider (§MA-1608 popup-shape).
  - 2 honest MISSes (nat1→10 ✗, nat2→11 ✗ vs AC12), zero damage entries.
- Core axes exact: formula "2d12 + 6" Piercing all hits; crit freebie LIVE "2d12*2+6 (3, 12)" fd36 (§32); secondary keys absent; fd 36+25+29+14=104 == |hp chain| 999→963→938→909→895 unclamped exact; saveDc:null, zero save entries, pendingSavePrompts null (zero save affordance required+confirmed).
- Whole-log census: `conditional_damage` tokens 0, `charge` tokens 0, `prone` tokens 0; change-data Bandit activeConditions/activeConditionMeta null, targetEffects null → zero prone grants in log AND change-data (§59 zero-consumer for manifest free-text `conditions:["prone"]` — §950/§1086).
- Ops notes: one lingering stage-2 overlay absorbed 3 chip clicks (§29/§308 double-flush + own-button click cleared it); press-to-log 1:1 after flush; console 0 errors.

## Likely Location / Fix
1. `public/data/monsters.json` triceratops actions[1] — one-field DATA fix: add `conditional_damage:{dice:"2d8",damage_type:"Piercing",condition:"moved 20+ feet straight toward the target immediately before the hit"}` — MA-0885 goat Ram byte-shape (goat actions[0]: {dice:"1d4",damage_type:"Bludgeoning",condition:"moved 20+ feet straight toward the target immediately before the hit"}). Consumer live-unarmed: buildChargeBonusOffer (src/components/encounter/MonsterCardHelpers.js:664, arms ONLY on `cd?.dice` :666), stamped at MonsterCardModal.jsx:1220 (`chargeBonusOffer: buildChargeBonusOffer(v.action, v.name)`), consumed at :2374. With the field authored, HIT popup will render offer label "20+ ft Charge: +2d8 Piercing?" (chargeOfferLabel Helpers:657-661, feet=20 parsed from clause) + decline "No charge (base damage only)"; grant logs `conditional_damage_granted` (Helpers:966), decline `conditional_damage_declined` (:977).
2. §MA-0903 RESIDUAL (separate axis, NOT this row's core): the PRONE half of the movement-gated rider has zero transport — maybeApplyRamProne requires PC stance buff ramActive (attacker buff optionName:'Ram', contextBuilder-sync.js:167); no movement-distance subsystem, gridless app. Document as advisory inside this bug file per codified frame; do NOT adjudicate as FAIL(a). Gridless never-prone is RAW-correct at resolve time (§MA-0903 gorgon Gore / MA-1347 lineage); the charge DICE half, however, is a GM-adjudicable popup choice and its absence is the FAIL(a).
3. Manifest `conditions:["prone"]` free-text has zero attack-path consumer (§59/§950/§1086) — part of this same bug record; `hit_conditions` would over-grant always-prone (wrong RAW, §MA-0903 warning).

## PITFALLS
- Single lingering stage-2 popup-overlay survived 3 backdrop el.click() flushes and absorbed 3 chip clicks; reliable clear = click its own `button` (popup-close-btn) then verify display:none (§29/§308 extension).
- EB join auto-lands monster cs idx0; party PC 1/1 placeholders join along — filter cs to non-placeholder combatants when auditing.
- Miss popups this build carry a `popup-close-btn::Done` (dismiss-only, zero damage) — do not miscount as damage-Done.
