# Corona of Light save-disadvantage never consulted on the SaveAttackAoeModal picker route (PC save-AoE casts)

## Summary
A character with the Corona of Light (`sunlight_aura`) aura on the active map imposes Disadvantage on Fire/Radiant saves for victims within the authored 60 ft in every OTHER seam (attack lane, monster→player prompt lane, aoeService sync lane — all measured live), but a PC casting a save-AoE spell from the sheet (Burning Hands verified) resolves through the SaveAttackAoeModal / AreaEffect picker route, which never consults the aura: both the picker's inline NPC saves and the player save-prompt payloads it builds show zero aura awareness.

## Steps to reproduce
In test-campaign, GM tab on localhost:5173 (dev pair, `CAMPAIGN_LOCK` unset or including test-campaign):

1. Encounter Builder → join **Winged Kobold** (fresh board fan-seeds the 13 PCs incl. EvasiveFighter/FeyRanger).
2. Create/activate an indoor map (`POST /api/campaigns/test-campaign/maps` then `PUT …/activate`). Doc PUT players[]: ElderPaladin (2,8), EvasiveFighter (14,8) = exactly 60 ft, FeyRanger (15,8) = 65 ft; placedItems: `{type:'npc', name:'Winged Kobold', gridX:65ft-or-60ft}` (both faces ridden).
3. Stamp the bearer: `POST /api/campaigns/test-campaign/ElderPaladin` `{value:{activeBuffs:[{effect:'sunlight_aura', distance:60, enemiesDisadvantageSaves:['Fire']}]}}`.
4. Arm an overlay so the picker pre-checks map tokens: `POST /spell-overlay?campaign=test-campaign` `{action:'add', overlays:[{id:'cx-corona-60', shape:'sphere', startGridX:15, startGridY:8, radiusFt:10, color:'#ff4400', label:'CX Probe'}]}`, then select `overlay-cx-corona-60` in AberrantSorcerer's Initiative `[data-testid="target-select"]`.
5. AberrantSorcerer sheet → Actions → Burning Hands → Cast Spell → Cast Without Metamagic → confirm `Burning Hands (3)`.
6. Read the machine surfaces: change-data `savePrompt-EvasiveFighter-*` payload `disadvantage`; log `save-damage` entries' `mode`; then repeat with the kobold stacked at 60 ft for the NPC-inline face.

## Expected behavior
Victims within 60 ft of the bearer taking a Fire save roll with Disadvantage (`mode:"disadvantage"`, prompt payload `disadvantage:true`) — the same rule the CS-verified seams apply at exactly this geometry (13dd98cc4: 60 ft exact = disadvantage, 65 ft = normal).

## Actual behavior
- Player face: `savePrompt-EvasiveFighter-…` payload carries **`disadvantage:false`** at exactly 60 ft (and `false` for FeyRanger at 65 ft — zero delta between in-range and out-of-range victims). Prompt rolled single die: log `save-damage … rolls:[17] mode:normal` vs DC 13.
- NPC face: kobold save-damage entries log **`mode:"normal"`** at both 60 ft and 65 ft.
- Control (same page, same runtime store, same mapData, live dev-module import): `getCoronaSaveDisadvantageSync({targetName:'EvasiveFighter', mapData, damageType:'Fire'})` → `{disadvantage:true, source:'ElderPaladin'}`; `'FeyRanger'` (65 ft) → false; damageType `'Cold'` → false. The lane works — the picker route just never calls it.

## Likely location
Confident on the wiring gap, on code read + live grep:
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` — `computeNpcSave` (~:44) honors heighten/rider/slow/ability-scoped te but has NO `getCorona*` import (grep-zero in the file); the player-prompt builder (~:298) sets `disadvantage: heightenTarget === targetName` only.
- `src/components/char-sheet/modals/shared/AreaEffectSaveFlow.utils.js` (`rollNpcSave`, `sendSavePrompt`) — same: no corona consumer.
- Contrast consumers that DO ride the lane: `src/services/rules/combat/aoeService.js` (sync, mapData), `src/hooks/combat/handlers/handlePlayerSaveDamage.js` :110 (async, measured), `handleNpcSaveDamage.js` :113, `DivineSparkModal.jsx` :164.
Note: the only route into `aoeService`'s corona-aware `processAoeNpcs`/`sendAoePlayerSaves` is `handleAoeDamage` (context.targetName `overlay-` via the damage pipeline); sheet spell casts intercept into the picker modal instead, which re-implements save resolution without the aura — so the aoeService lane stayed unreachable from this cast even with the overlay armed (picker merely PRE-CHECKS the overlay's hit-set).

## Suggested fix
Thread the aura into the picker route's two adjudication seams exactly like `handleAoeDamage` does: build `mapData = {players, placedItems}` (the modal already receives `mapData` for the overlay branch at AreaEffectTargetModalBase — today `mapData={null}` from SaveAttackAoeModal.jsx ~:2016, first check why) and in `computeNpcSave` + the prompt-builder fold in `getCoronaSaveDisadvantageSync({targetName, mapData, damageType, campaignName}).disadvantage` (async twin if mapData is null, mirroring handlePlayerSaveDamage's resolve). Add a picker-route pin to the existing corona test family.

## Severity
Broken feature / rules integrity — an owned, previously-fixed aura (CS/CQ lineage) is silently inert on the most common PC save-AoE cast lane; damage outcomes diverge from the verified prompt lane with zero advisory.
