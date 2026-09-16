# Bug — MA-0264: Ancient White Dragon lair_actions[1] "Unnamed lair actions 2" inert (raw-string ice-shards row)

## VERDICT: FAIL

## Title
AWD lair ice-shards row (ranged attack +7, 10 (3d6) piercing, up to 3 targets) authored as RAW STRING → zero clickable affordance; attack never routable.

## Expected (ground truth)
"Jagged ice shards fall from the ceiling… The dragon makes one ranged attack roll (+7 to hit) against each target. On a hit, the target takes 10 (3d6) piercing damage." → clickable lair chip routing to the attack seam (attack_bonus +7, 3d6 Piercing).

## Actual (live evidence, test-campaign, 2026-09-16)
- Header verified `test-campaign`; AWD live cs init 9, HP 333/333.
- Card (avatar click → `.mc-overlay`, `.mc-action` idx10) row renders `<div class="mc-action"><span>Jagged ice shards…</span></div>` — `hasDiceLink=false, hasRoleButton=false, hasButtonTag=false, onclick=false, clickableEls=0`, children `["SPAN."]`. Static branch MonsterCardBody.jsx:340 (`typeof la === 'string'` true).
- Click row + click span → ZERO delta: log 214→214, `lair|ice` entries 0→0, no overlay, row HTML identical.
- Control (engine alive): target-armed Rend `.mc-dice-link` +14 → live popup "✓ HIT (29 vs AC 19)", log 214→215 (roll/attack/Rend). Popup dismissed via bg-click; overlays flushed to 0.

## Root cause
DATA: `public/data/monsters.json` `ancient-white-dragon.lair_actions[1]` = RAW STRING. `isLairRowClickable` (monsterLairActions.js:26) `typeof row !== 'object' → false` → inert. MA-0254/MA-0221/MA-0199 raw-string lair family. Numbers (+7, 3d6) prose-only.

## Grep correction — attack-roll lair machinery EXISTS (task premise refuted)
- Consumer: `lairRowAffordance` monsterLairActions.js:43 `attack_bonus != null → 'attack'` → :99-100 `handleAttack(name, attack_bonus, action)` — attack seam wired in the lair pipeline itself (not limited to zones/saves).
- Producer on disk: `adult-white-dragon.lair_actions[1]` = named dict `{name:"Jagged Ice Shards", attack_bonus:7, damage_dice_primary:"3d6", damage_type_primary:"Piercing"}` — byte-identical prose to this row. Named lair dicts app-wide: 43.
- So secondary claim "attack-roll lair clause = zero producers" is FALSE; this row is purely a DATA authoring gap of the raw-string family, with a same-monster-family fix template already present.

## Fix template
Copy adult-white-dragon's structured dict to ancient `lair_actions[1]` (keep +7/3d6 Piercing prose numbers). Routes `affordance==='attack'` → handleAttack live.

## Constraint compliance
No save-file edits, no mutating POSTs (GET-only curl), test-campaign lockdown, no Enter in rename input, overlays flushed.
