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

## Resolution
**Confirmed live, then fixed 2026-11-05.** Diagnosis held: the picker route (`SaveAttackAoeModal`) re-implements save resolution and its two adjudication seams — `computeNpcSave` (NPC inline) and the `resolvePcTarget` prompt builder — never consulted the Corona of Light aura. The only corona-aware AoE consumers (`aoeService.processAoeNpcs`/`sendAoePlayerSaves` via `handleAoeDamage`) are intercepted before sheet casts ever reach them. `mapData={null}` at the overlay branch was a red herring: that prop only feeds `AreaEffectTargetModalBase`'s distance-eligibility filter, which short-circuits (`attackerPos=null` → pass); resolution in BOTH branches funnels through the shared `resolveAllSavesAndDamage` hub, so the fix threads the aura through that hub once instead.

**Changes:**
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` — in `resolveAllSavesAndDamage` (async hub both branches share): load the active-map document once per cast via new `loadCoronaMapData` helper (mirrors `handleAoeDamage`'s `{players, placedItems}` mapData build), then per target fold `getCoronaSaveDisadvantageSync({targetName, mapData, damageType, campaignName}).disadvantage` into `ctx`. `computeNpcSave` ORs it into `hasSaveDisadvantage` (NPC rolls 2d20 at min, logs `mode:"disadvantage"`); the PC prompt builder ORs it into the CLA-063 machine-truth payload flag via new `promptDisadvantage` helper (complexity hoist — both additions kept the file under the 15-branch ceiling). Gridless/unplaced/no-map pairs stay consulted-and-passes lenient inside the util — same doctrine as the 13dd98cc4 seams. No changes needed in `AreaEffectSaveFlow.utils.js` (its only consumers are the enchantment condition modals CalmEmotions/Tashas/HypnoticPattern — no Fire/Radiant damage types, aura gate inapplicable) nor the 2024 twin (shared component, ruleset-agnostic).
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.corona.test.jsx` (NEW) — 5 pins riding the REAL `coronaAuraUtils` through the picker: NPC exact-60 ft Fire → two dice at min + `mode:"disadvantage"`; NPC 65 ft → `mode:"normal"` single die; non-Fire (`Cold`) → aura ignored; PC prompt payloads `disadvantage:true` @60 ft vs `false` @65 ft; no-aura map byte-inert `false`.

**Verification:**
- Pre-fix repro (live, test-campaign): fresh EB Winged Kobold join (14-combatant board), cx-corona-fix map with ElderPaladin (2,8) aura stamp + Fire/60, EvasiveFighter (14,8), FeyRanger (15,8), kobold token (14,8), `cx-corona-60` sphere overlay armed + selected on AberrantSorcerer's Initiative card. Burning Hands cast → picker pre-checked the 3 overlay tokens; prompt payloads `disadvantage:false` for BOTH EF(60 ft) and FR(65 ft) (zero delta), kobold inline save-damage `mode:"normal"` — while the same page's live `getCoronaSaveDisadvantageSync` probe returned `{disadvantage:true, source:'ElderPaladin'}` for EF/kobold, false for FR & Cold. Bug confirmed exactly as filed.
- Post-fix re-run (same rig): kobold save-damage logs `mode:"disadvantage"` with `saveRawRolls:[16,1]` → saveRoll 1, failure, full damage 14 (vs normal/19/half pre-fix); `savePrompt-EvasiveFighter-*` `disadvantage:true`, `savePrompt-FeyRanger-*` `disadvantage:false`; prompt modal header reads "EvasiveFighter must make a DEX saving throw. (Disadvantage)"; resolved PC logs `mode:"disadvantage"` (EF, 60 ft) / `mode:"normal"` (FR, 65 ft). Leading Evasion + evasion prompts on the same queue still work (adjacent sanity).
- Tests: new file 5/5; `shared` modals folder 85 files/517 tests green (family byte-inert — real util loads but no active map in those lanes); `auras` + `aoeService` + `divine` + `handlers` adjacent suites green (146 files/1167 passed + 1 pre-existing expected-fail). `npm run lint` zero warnings.
- Cleanup: overlay cleared, cx-corona-fix map deleted (GET 404), change-data + log Admin-cleared from a quiet tab; `git status --porcelain public/campaigns/` EMPTY (character files byte-untouched).
