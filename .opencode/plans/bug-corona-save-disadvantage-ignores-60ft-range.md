# Corona of Light save-Disadvantage ignores the authored 60 ft "in the Bright Light" range

## Summary
Corona of Light (`sunlight_aura`, authored range "60 ft") applies Disadvantage to Fire/Radiant saving throws of targets that are far outside the aura — even on an active map where both bearer and victim token positions are known and measurable. Every runtime consumer hardcodes `skipRangeCheck: true`, so the measurement branch that exists in `getCoronaSaveDisadvantage` is dead code: the aura is effectively unlimited-range whenever the damage type matches and the victim is on the bearer's (empty = all) enemy list.

## Steps to reproduce
1. In `test-campaign`, activate the Battle Arena map (Maps → Activate "Battle Arena").
2. Put the bearer token and victim token > 60 ft apart on the grid (5 ft/cell): `PUT /api/campaigns/test-campaign/maps/battle-arena` with full doc including `players: […baseline trio, {id:'elderpaladin', name:'ElderPaladin', gridX:5, gridY:5}]` and `placedItems: [{id:'koboldprobe', name:'Winged Kobold', gridX:18, gridY:5, …}]` → separation = 13 cells = 65 ft.
3. Stamp the bearer's aura: `POST /api/campaigns/test-campaign/ElderPaladin` `{"value":{"activeBuffs":[{"name":"Corona of Light","effect":"sunlight_aura","enemiesDisadvantageSaves":["Radiant"],"distance":"60 ft"}]}}`.
4. Encounter Builder → join a Winged Kobold.
5. Select War_Cleric → `.attacks` row "Sacred Flame" (Radiant DEX save) → `Cast Spell` popup button.
6. Read the NPC inline save popup and `change-data.lastAttack`.

## Expected behavior
Per the authored class text ("Your enemies **in the Bright Light** have disadvantage on saving throws against ANY spell that deals fire or radiant damage", 60 ft), a victim at 65 ft with both positions measurable on the active map must NOT get Disadvantage. The `!skipRangeCheck` branch (coronaAuraUtils.js:54-59, `isWithinRange(player, target, 60)`) should gate it.

## Actual behavior
The save pays Disadvantage at 65 ft:
- Inline popup: `✓ SAVE SUCCESS (18 vs DC 15) (d20 15 + 3) [Disadvantage]`
- Machine truth in `change-data.lastAttack`: `d20Rolls: [18, 15]` (2d20, lower kept → 15), and the `save-damage` log row: `"saveRawRolls":[18,15],"forcedMode":"disadvantage"`.
Zero measurement happens despite an active map with positioned tokens for both creatures.

## Likely location
Confident (source read + live):
- `src/hooks/combat/handlers/handleNpcSaveDamage.js:110` — `skipRangeCheck: true` hardcoded.
- `src/hooks/combat/handlers/handlePlayerSaveDamage.js:~111` — same.
- `src/services/rules/combat/aoeService.js:44 & :103` — `getCoronaSaveDisadvantageSync({…, skipRangeCheck: true})`; the sync lane returns `{disadvantage:false}` WITHOUT the flag, so even flipping the callers can't measure there (needs a positional sync path or async conversion).
- `src/components/char-sheet/modals/divine/DivineSparkModal.jsx:161` — same sync-lane call.
- `src/services/combat/auras/coronaAuraUtils.js:41-65` — the measured branch exists but is unreachable from all 4 consumers.

## Suggested fix
Stop passing `skipRangeCheck: true` when an active map with positioned tokens exists (mirrors how the wolf/lion attack lanes consult-and-fork: measured on map, lenient gridless). The async handlers can call `isWithinRange` directly — `skipRangeCheck` should only short-circuit the tokenless/gridless case, not the positioned case. For the sync lane (aoeService, DivineSparkModal) either resolve the aura BEFORE the non-awaitable seam (precompute on the caller that can await) or add a sync token-position comparator (`isDistanceInRange(getDistanceFeet(a,b), 60)` already exists in `rangeCheck.js`). Note `isWithinRange` returns FALSE for unplaced creatures once the map tracks positions — so the fork must be "no active map / no positioned tokens → lenient (current behavior)", not merely "flag off".

## Severity
Broken feature — an aura gate that is authored, documented in the buff tooltip ("60 ft"), and enforceable on the map is silently unenforced; GMs get wrong save odds for out-of-aura victims (and the machine-truth `forcedMode` misleads any downstream audit). Adjacent auras (wolf 5 ft / lion 5 ft) DO measure+fork honestly on the same lane — corona is the outlier.
