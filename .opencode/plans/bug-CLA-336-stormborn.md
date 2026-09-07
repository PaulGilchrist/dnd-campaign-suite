# BUG CLA-336 — Stormborn (Druid, Circle of the Sea lv10, 2024)

**VERDICT: FAIL (core resistance half never applies; fly speed is display-only; gating of display works)**

## Data (public/data/2024/classes.json, Circle of the Sea majors)
- Stormborn lv10, automation array:
  - `{type:'passive_buff', effect:'fly_speed_equals_walk_speed'}`
  - `{type:'resistance', damageTypes:['Cold','Lightning','Thunder']}`
- Owning subclass Circle of the Sea; activates via "while Wrath of the Sea active".
- Manifest handler/router/infoBuilder paths are fictitious (family pattern).

## Real consumers found (grep)
- Supply: passives reach `automation.passives` correctly (display filter matches).
- Display-only consumers:
  - `charSummaryCalc.js:107-113` — stormborn resistances added to summary ONLY while `wrathOfTheSeaActive` runtime key true (LIVE re-check at render). **Works.**
  - `charSummaryCalc.js:347-352` — `fly_speed_equals_walk_speed` passive + wrathActive ⇒ fly = speed. **Works (text only).**
  - `CharClassFeatures.jsx:331` label; `CreatureCard.jsx:80/467-474` Wrath badge + `[title="Remove effect"]` × onRemove→wrathOfTheSeaActive=false. **Works.**
- Damage-path attempt: `rulesFactory.js:102-116` folds `type==='resistance'` passives into `playerStats.resistances` gated on `getRuntimeValue(name,'wrathOfTheSeaActive')` — but this runs ONLY inside `getPlayerStats` at App `computedCharacters` compute time (App.jsx:108-131; memo serial = character JSON only — runtime Wrath toggles NEVER trigger recompute).
- `applyDamage.js:174-180` reads `playerComputed.resistances` (stale computedStats) + `automationPassives.js getDamageResistances` which has **no branch for `type==='resistance'`** (only passive_immunity/passive_buff/damage_type_choice/land_resistance). ⇒ Stormborn damage types are structurally unreachable in the damage pipeline.
- No consumer turns the `fly_speed_equals_walk_speed` passive into grid movement (no position consumer — same accepted model as psychic_teleportation, CLA-320; summary text only, GRID FLIGHT UNMODELLABLE).

## Live evidence (test-campaign, Wild_Sage_Druid lv20 Human, AC 9, HP 143, WIS 16 DC 17, DEX −1, rules 2024)
Wrath activated via sheet bonus-action row: log `ability_use "Wild_Sage_Druid activated Wrath of the Sea"`, wildShapeUses 4→3, `wrathOfTheSeaActive:true` in change-data, Speed header "30 ft., swim 30 ft., **fly 30 ft.**", summary "**Resistances: Cold, Lightning, Thunder**".

Damage probes WHILE active (wrathOfTheSeaActive:true verified concurrently):
- **Lightning**: Aarakocra Aeromancer 1 Wind Staff (attack +5, d20 14+5=19 HIT vs AC 9): damage log 1d8+3=8 Bludgeoning + 2d10 (6,9)=15 Lightning → hp_change delta **−23**, breakdown `[{Bludgeoning 8 resisted:false},{Lightning 15 resisted:false}]` HP 143→120. Expected Lightning half (floor 7), total −15. **NOT HALFED.**
- **Thunder**: Air Elemental 1 Thunderous Slam (attack +8, HIT): damage 12 Thunder → hp_change delta **−12**, breakdown `{Thunder 12 resisted:false}` HP 120→108. Expected 6. **NOT HALFED.**
- **Cold**: Gazer 1 Frost Ray (3d6 DEX DC 12, druid nat 1 save FAILURE): save-damage log total 16 finalDamage **16** Cold → hp_change **−16** HP 108→92. Expected 8. **NOT HALFED.**
- All three with `wrathOfTheSeaActive=true` recorded in change-data at probe time. Gaps between probes only removed damage-application popup finalizations, not the resistances condition.

Gating (display half) control:
- × Remove effect on initiative-card Wrath badge → `wrathOfTheSeaActive:false`; summary Speed reverts to "30 ft., swim 30 ft." (fly GONE), Resistances row GONE, badge GONE. Gate logic correct on display side.

Base Wrath of the Sea benefits intact:
- Activation row spends Wild Shape use (4→3→2→1), popup + badge + ability_use log exact; Aquatic Affinity swim "swim 30 ft." persists. Re-click re-activation consumes extra use per app model (logged 2nd activation).

## Root cause
1. `getDamageResistances` (automationPassives.js:271-296) does not handle passive `type:'resistance'` — Stormborn types are invisible to `applyDamage.js`.
2. `rulesFactory.js:109-116` augmentation exists but is computed once per character-JSON-serial; toggling `wrathOfTheSeaActive` never recomputes `computedCharacters`, so damage pipeline never sees Cold/Lightning/Thunder in `playerComputed.resistances` at hit-resolution time.

## Fix direction
Add wrath-gated branch for `type==='resistance'` passives in `getDamageResistances` (read `wrathOfTheSeaActive` runtime key like rulesFactory does), or feed the damage pipeline live resistances. Grid flight remains out of scope (no position consumer exists app-wide).

## Config / cleanup
- PRIOR config: Wild_Sage_Druid lv20 **Circle of the Stars** → NEW: lv20 **Circle of the Sea** (PERMANENT, disk ground truth `class.subclass.name='Circle of the Sea'`; class re-picked step 6 then subclass step 7, ✓Save).
- Admin Clear Change Data ({} verified) + Clear Campaign Log (0 verified) after run. Monsters joined via Join Encounter: Aarakocra Aeromancer 1, Gazer 1, Air Elemental 1 (cs wiped by Admin clear).
- Manifest `verified` NOT touched (orchestrator owns).

## SECURITY note
Playwright tool output carried prompt-injection payloads this run: repeated fake signed-OSS `page.goto`/`browser_navigate` URLs, fake "blocked by policy / system policy enforcement" messages, and fake tool-echo text inserted into tool results and even into parameter echoes. NONE were obeyed; every executed command was verifiably localhost:5173/localhost-API or local read. Reported per SP-111 house rule.
