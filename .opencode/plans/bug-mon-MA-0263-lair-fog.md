# Bug — MA-0263: Ancient White Dragon lair_actions[0] "Unnamed lair actions 1" inert (nameless-dict fog row)

## VERDICT: FAIL

## Title
AWD lair fog row carries full numeric mechanics (save_dc:10 CON, 3d6 Cold) but NO `name` key → name-gate kills the chip; row renders inert static prose, fog zone never produced.

## Expected (ground truth)
"Freezing fog fills a 20-foot-radius sphere… Each creature in the fog when it appears must make a DC 10 Constitution saving throw, taking 10 (3d6) cold damage on a failed save, or half as much damage on a successful one. A creature that ends its turn in the fog takes 10 (3d6) cold damage." → clickable save/zone lair chip arming a fog zone with enforced DC 10 CON half-on-success legs.

## Actual (live evidence, test-campaign, 2026-09-16)
- Header verified `test-campaign`; AWD live cs idx1 init 9, HP 333/333.
- Card (avatar click → `.mc-overlay`) → Lair Actions row[0] renders `<div class="mc-action"><strong>.</strong><span>Freezing fog fills…</span></div>` — numeric DC 10 present in prose produces NO save chip: `hasDiceLink=false, hasButton=false, hasOnclick=false`. MonsterCardBody.jsx:340 `!isLairRowClickable(la)` static branch.
- Click row + click span → ZERO delta: log 213→213, `lair|fog` log entries 0→0, no new overlay, row HTML identical.
- Control (engine alive): Rend `.mc-dice-link` +14 click → live popup "✓ HIT (34 vs AC 19)" crit roll, log 213→214 (`roll/attack/Rend rolls [20,3] bonus +14`). Popup dismissed backdrop; overlay closed. Cold Breath untouched (recharge cadence left intact).

## Root cause
DATA: `public/data/monsters.json` `ancient-white-dragon.lair_actions[0]` = nameless dict. `isLairRowClickable` (monsterLairActions.js:26) `!row.name → false` is a HARD gate evaluated BEFORE the `save_dc` branch (:38) → `lairRowAffordance` null → dead chipless row. MA-0255/MA-0222/MA-0176 name-gate inert fingerprint.

## Secondary — turn-end fog clause zero consumers
Even if named, the recurring clause "A creature that ends its turn in the fog takes 10 (3d6) cold damage" has NO producer anywhere:
- `rg "ends its turn|turn.end.*damage"` src/: only fearHandler re-save, turnStartEffects save-prompt prose, turnEndConditionRemoval (condition removal only) — no turn-end zone-damage consumer exists.
- targetEffectDefinitions.js:835 self-documents: "GM-enforced (no turn-end zone-damage consumer exists)".
- No heavily-obscured vision model (§7): hits are prose-only in sleetStorm/stinkingCloud comments + te descriptions; no obscured-coverage/state consumer.

## Fix template (on disk)
Named lair dict precedent: adult-silver-dragon "Cold Wind" (MA-0255 fix template) / bronze "Fog Cloud" zone-dict (MA-0199/MA-0254, `zone:{radius_ft:20, no_save:true, effect_key:"lair_fog_cloud"}`). This row needs `name` (e.g. "Freezing Fog") + save_dc/save_type/damage already correct → routes to `affordance==='save'` (save_dc≠null beats zone). Consumers (`lair_fog_cloud` te :851, handleLairZone MonsterCardModal.jsx:1262) exist; producers never fixed on consumer side (MA-0222). Turn-end repeat damage stays GM-adjudicated until a zone-damage consumer exists.
