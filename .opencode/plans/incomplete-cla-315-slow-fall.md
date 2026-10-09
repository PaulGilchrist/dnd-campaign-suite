# CLA-315 Slow Fall — INCOMPLETE (setup-blocked) 2026-10-08

## One concrete blocker
**Falling state is physically unreachable through any in-app UI.** There is no fall-damage producer and no GM tool to stamp a falling event; the Reaction therefore cannot be legitimately triggered in-app.

## Evidence (from verification run)
- Grep `trigger:'falling'`: zero producers; consumers only (`damageReductionHandler.js:81-86`, `MonsterCardHelpers.js:2172/2175`). Handler comment: "no fall-damage producer yet; only a lastAttack explicitly stamped trigger==='falling' by a GM fall tool passes" — and `grep -i fall server/routes/*.js` shows no GM fall tool.
- `targetEffectDefinitions.js` grep-zero `falling` → GM Effect Adder has no Falling chip (registry is its sole source). `conditions.json`: no Falling. Maps/hex-map: CSS height only, no elevation/cliff mechanic.
- 2d10-per-10ft fall-damage roll: grep-zero producer app-wide.

## What IS live (rig-proven, capped below PASS because rig = API stamp, not UI)
- Data: 2024 lv3 (5e lv4), `damage_reduction`, `reductionExpression:'5 * monk level'`, trigger falling, reaction.
- Live press-model on Disciplined_Monk lv20 with sanctioned server rig `POST /api/campaigns/test-campaign/lastAttack {value:{trigger:'falling', totalDamage:120}}` + reload:
  - Reduction math EXACT: popup "Reduce ... = 100 ... Damage reduced to: 20 ... Healed: 100 HP"; `hp_change +100` machine truth; `ability_use` log.
  - Gates EXACT: no-attack refusal verbatim (popup-only), not-falling refusal + `slow_fall_refused` log (gate fails closed — historic fail-open fixed), round latch `_Slow_Fall_usedRound` + spent-refusal verbatim, round-wrap re-arm live.
- Modeled as post-damage heal `min(reduction,totalDamage)`; full-HP heals 0 — judge by hp_change.

## What would unblock
Any producer of a falling event via UI: hex-map elevation/cliff, a GM fall tool, or a registered `falling` condition chip in targetEffectDefinitions + a fall-damage roller. After that, re-verify via CAST/press path only.

## Manifest fix suggestion
Row silent on level; canonical data: 2024 lv3. Reduction is heal-model, not pre-damage mitigation (design note).

## Retry attempt 2 (2026-10-08) — blocker CONFIRMED
New paths tried, all dead: Maps create form name+Indoor/Outdoor only; Test Map editor no elevation/cliff fields (3D = camera toggle); hexTerrainGenerator elevation has zero combat consumers; flight-expiry consumers produce no fall/land/hover events; CampaignAdmin = backup/rename/theme only; EB monsters offer only Feather Fall + Falling Ceiling (no trigger:'falling'). Blocker stands: no legitimate in-app fall-event producer.
