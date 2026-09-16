# Bug — MA-0254: Ancient Silver Dragon lair "Unnamed lair actions 1" inert (raw-string fog row)

## Title
Ancient Silver Dragon lair_actions[0] (fog cloud) renders as inert static prose — no clickable affordance; fog zone never produced.

## Overview
monsters.json `ancient-silver-dragon.lair_actions[0]` is authored as a RAW STRING, not a structured dict. `MonsterCardBody.jsx:340` (`typeof la === 'string' || !isLairRowClickable(la)`) renders it as a bare `<span>` with zero affordance. `isLairRowClickable` (monsterLairActions.js:26) returns false for non-objects / nameless rows before any affordance check. The lair zone consumer for fog exists (`lair_fog_cloud` te at targetEffectDefinitions.js:851 + `handleLairZone` at MonsterCardModal.jsx:1262,1275) but its producer arm is only reachable through a clickable structured zone-dict row — the raw-string row never reaches it. No fog zone / te is ever produced. FAIL (MA-0221/MA-0222 inert-lair family; fix template present in sibling data).

## Expected (ground truth quote)
"The dragon creates fog as if it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round."
→ Should arm a fog zone (`lair_fog_cloud`, 20-ft radius, no-save, until init 20 next round) via a clickable lair chip, as the adult-bronze/ancient-bronze structured fog lair rows do.

## Actual (live evidence, test-campaign, 2026-09-15)
- Header verified `test-campaign`; dragon in initiative init 15, HP 468.
- Card → Lair Actions: row[0] renders `<div class="mc-action"><span>The dragon creates fog…</span></div>` — `hasDiceLink=false, hasRoleButton=false, hasOnclick=false`, children `["SPAN."]`. No affordance at all.
- Click on row prose → ZERO delta: log count unchanged 131→131, `lair/fog` log entries 0, no new overlay, row HTML identical.
- Control probe (engine alive): unspent `Paralyzing Breath` chip click spawned live `.sp-overlay` cone picker ("90-ft Cone") → Skip closed cleanly (overlays→0).

## Steps
1. test-campaign → Initiative (dragon init 15) → open dragon card.
2. Scroll to Lair Actions.
3. Observe lair row[0] = inert `<span>` prose, no dice-link / role=button.
4. Click row → zero delta (no zone, no log, no popup).
5. Control: Paralyzing Breath chip opens cone picker (engine live).

## Likely Location
- DATA: `public/data/monsters.json` `ancient-silver-dragon.lair_actions[0]` authored as raw string (should be a structured zone-dict like siblings).
- GATE: `src/services/encounters/monsterLairActions.js:26` `isLairRowClickable` — `typeof row !== 'object' || !row.name → false`; plus `src/components/encounter/MonsterCardBody.jsx:340` static render branch.

## Notes
- Fix template EXISTS in sibling data: adult-bronze-dragon & ancient-bronze-dragon author `lair_actions[0]` as `{name:"Fog Cloud", zone:{radius_ft:20, no_save:true, effect_key:"lair_fog_cloud", advisory:…}, duration:"until initiative count 20 next round"}` → routes to `affordance==='zone'` → `handleLairZone` (MonsterCardModal.jsx:1262) arms the fog te. Ancient-silver just needs the same dict shape (name + zone.radius_ft + no_save + effect_key). Consumers never fix on the producer side (MA-0222).
- Also note: the sibling nameless lair row[1] (cold wind, `save_dc:15`) is the separate MA-0222 nameless-dict inert row — also lacks `name`; not this row's FAIL but same authoring root.
- Per MA-0221 precedent, adjudicated FAIL (inert), not INCOMPLETE — fix template present in sibling data.
