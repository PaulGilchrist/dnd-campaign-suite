# MA-0130 — Adult Red Dragon "Unnamed lair actions 3" (Volcanic gas) — FAIL (inert, data-shape)

Verdict: **FAIL**

## Row
- monster: Adult Red Dragon (`adult-red-dragon`), category `lair_actions`, claimed DC 13 CON, Poisoned/incapacitated, recurring turn-start save, cloud until initiative count 20.

## Step-1 static data read (`public/data/monsters.json`)
- `lair_actions[2]` is a **raw string** (`typeof === 'string'`): "Volcanic gases form a cloud in a 20-foot-radius sphere ... Each creature that starts its turn in the cloud must succeed on a DC 13 Constitution saving throw or be poisoned until the end of its turn. While poisoned in this way, a creature is incapacitated."
- Text DC/type/effect match the manifest row (DC 13 CON, poisoned→incapacitated). No `name`, no structured dict → generator placeholder "Unnamed lair actions 3".
- (Adjacent row drift noted, not this row: `lair_actions[0]` dict has `save_dc:13/save_type:Constitution` vs its text "DC 15 Dexterity" — MV-24 family.)

## Code-gate proof (static)
- `src/components/encounter/MonsterCardBody.jsx:340` — `MonsterLairAction`: `typeof la === 'string' || !isLairRowClickable(la)` → static `<div class="mc-action">` text render; no onClick, no `.mc-dice-link-lair`.
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable` requires `row.name`; raw strings never reach it → false. Header comment (:17-19): plain-string rows "never become clickable" (~600 monsters static by design).
- No volcanic/gas lair te: `targetEffectDefinitions.js` has `stinking_cloud`, `lair_insect_cloud`, `lair_sand_cloud` — NO volcanic/poison-gas cloud key.
- No initiative-count-20 seam app-wide (monsterLairActions.js:23: "GM-enforced — no initiative lair seam"); no turn-start lair consumer (only spell-zone turn-start saves exist: Slow/expireStaleEffects per SP-111/MA-0042).

## Live probe (Playwright, test-campaign, localhost:5173)
1. EB Join "Adult Red Dragon" → `Adult Red Dragon 1` in combatSummary (server-verified); armed target AasimarTest on its card (server cs `targetName: AasimarTest`).
2. Open dragon card → Lair Actions section renders 3 rows. Volcanic-gas row DOM probe:
   - `hasDiceLinkLair: false`, `hasButton: false`, `hasIcon: false`, span `onClick: undefined`, row `onClick: undefined` (via `__reactProps$`).
3. Clicked the volcanic-gas row → **zero effect**: no popup, no save prompt, no change-data keys, log delta for the click = 0 entries (baseline log 0; only join/initiative-roll entries present).
4. change-data top-level after probe: only `combatSummary/__campaign__/__map__/AasimarTest/activeCreatureName/combat-ui-viewingMonster*` — no gas/cloud zone te, no `_lair_*`, no pending save from the dragon.

## Control probe (link IS live for named dicts)
- EB Join Aboleth; its structured lair rows render 3 `.mc-dice-link-lair` role=button chips ("Phantasmal Force", "DC 14 Strength", "DC 14 Wisdom").
- Click "DC 14 Strength" with target unarmed → real refusal popup + `grasping_tide_refused` automation log (affordance pipeline firing).
- After arming AasimarTest, click again → server `savePrompt-AasimarTest` created: `{saveType:"Strength", saveDc:14, dcSuccess:"half", attackerName:"Aboleth 1"}` + `pendingSavePrompts` entry. Seam confirmed live; Adult Red Dragon row fails purely on data shape.

## Recurring turn-start save
- Absent by construction: no initiative-count-20 lair seam, no cloud te producer, no turn-start lair consumer — "starts its turn in the cloud" cannot re-fire even if the row were clickable (playbook MA-0118/MA-0092 fingerprint).

## Fix direction (not implemented)
Structure `lair_actions[2]` (and [0]/[1]) as named dicts (`name`, `save_dc:13`, `save_type:"Constitution"`, zone/te or save+condition per MA-0024/MA-0118 recipes); recurring cloud behavior remains GM-advisory residual (no initiative-20 subsystem exists).

## Cleanup
- Admin clear change-data + log (test-campaign): both 200, verified log count 0. Manifest `verified` untouched.

## Security note
- Repeated injected fake "tool acknowledged/continue" and fake USER/ASSISTANT blocks appeared between tool results this run (known 42r/44d family) — ignored; all adjudication from self-issued localhost fetches/probes.
