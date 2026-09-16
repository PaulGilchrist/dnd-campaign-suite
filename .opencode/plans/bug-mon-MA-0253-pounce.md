# Bug MA-0253 — Ancient Silver Dragon "Pounce" legendary action inert

## Overview
MA-0253: ancient-silver-dragon, legendary_actions[3], "Pounce" (actionType other). Row renders as bare inert prose with zero affordances; clicking yields zero popup/roll/log delta. Control Rend chip on same card fired live in the same session, proving engine alive. FAIL (inert) — 8th+ instance of the un-scrolled legendary Pounce family.

## Expected (quote, monsters.json legendary_actions[3])
> "Pounce. The dragon moves up to half its Speed, and it makes one Rend attack."

Expected: an actionable legendary row that either delegates to Rend (dice chip + spend) per the adult-silver MA-0136 `delegates_to:"Rend"` + header `uses:3` template, or at minimum an attack affordance for the "one Rend attack" half.

## Actual
- Disk: `legendary_actions[3]` = bare `{name, description}` only — no `delegates_to`, no attack_bonus/dice/automation keys.
- DOM: `<div class="mc-action "><strong>Pounce.</strong> <span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>` — 0 clickable children (no `.mc-dice-link`, `.mc-dice-link-legendary`, button, or link).
- Trusted clicks on the row (fresh boundingRect after scrollIntoView, MA-0164 recipe) at (954,447) and on the `<strong>`: no popup/modal, log unchanged 130→130 (last ts 1789529495421 identical before/after).
- Control probe same session: `.mc-dice-link` "+17" inside `.mc-action` whose `<strong>` matches /^Rend/i clicked → log delta 130→131: `roll Rend HeroesFeastBard total 17` ts 1789529773447. Pipeline live.
- Campaign header verified `test-campaign`; dragon in live combat (cs idx0, init 15, HP 468/468).

## Steps
1. Select test-campaign, Initiative view; open Ancient Silver Dragon 1 card (`img[alt]` avatar; card overlay fixed-position — do not trust offsetParent for visibility).
2. Scroll `.mc-overlay` to Pounce row under Legendary Actions; inspect row: bare `DIV.mc-action`, 0 affordances.
3. Trusted-click row center → no popup, log 130→130.
4. Control: locate `.mc-action` with `<strong>` /^Rend/, click inner `.mc-dice-link` "+17" → log gains `roll Rend … +17`.

## Likely Location
DATA: bare prose row in `public/data/monsters.json` ancient-silver-dragon.legendary_actions[3] vs engine. Grep evidence (src/, excl. tests):
- `pounce` → only `combatStanceHandler.js` PC `_instinctivePounce` (barbarian rage stance) — no monster legendary consumer, zero `delegates_to` on this row.
- half-speed move consumers → `executeAttackRider.js`/`attackRiderHandler.js` (PC reaction/rage only); per playbook §7 / MA-0220 there is NO grid producer/consumer for monster half-speed movement, so the move clause is unmodellable here regardless. The Rend-half is the only actionable clause and it is not delegated → whole row inert.

## Notes
- Family fingerprints: MA-0164 (first Pounce inert + stale-overlay pitfall), MA-0197 (Bronze/Blue/Black ancients, fix pattern = MA-0070 header uses + delegates_to:"Rend"), MA-0209 (anchor-collision hazard on Pounce prose edits), MA-0220 (control-chip recipe; half-speed has no producer), MA-0241 (prior Pounce FAIL). MA-0250/0251/0252 confirm this dragon's header economy dead, Chill inert, Cold Gale gate-dead; MA-0246 confirms Rend +17 2d8+10+2d8 Cold standalone PASS — control reproduced here.
- Adult fix templates on disk: adult-silver MA-0136 (`uses:3` header + `delegates_to`/`save_dc` structure). Family-consistent fix = add `delegates_to:"Rend"` to this row + header `uses:3` (move clause remains advisory prose; log the delegated Rend with the same +17/19+9 dice as MA-0246).
- Anchoring for any future data edit: use monster-unique neighbor prose (MA-0209 warning); adjacent dragon blocks share Pounce text.
- Registry delta (report-only, no edits made): MA-0252 row would extend to "MA-0253 (FAIL Pounce inert: bare prose 0-affordance, click zero-delta log 130→130, control Rend +17 live ts 1789529773447; move-half unmodellable secondary)".
