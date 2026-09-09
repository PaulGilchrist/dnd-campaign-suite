# BUG CLA-384 — Warping Implosion: dedicated handler unreachable; live path is generic save_attack with NO teleport, NO pull, NO SP restore

**Verdict: FAIL** (2026-09-09)
**Automation:** CLA-384 | classFeature | Sorcerer — Aberrant Sorcery (2024 app data, lv18)
**Host:** AberrantSorcerer lv18 Aberrant Sorcery 2024 (converted this run from Clockwork lv14; Orc; CHA 9/−1, PB +6 → real DC **13**)

## Data ground truth (public/data/2024/classes.json, Sorcerer → majors "Aberrant Sorcery", lv18)
`automation: {type:'save_attack', damage:'3d10', damageType:'Force', saveType:'STR', saveDc:'ability', saveAbility:'CHA', shape:'emanation_30ft', range:'30_ft', uses:1, recharge:'long_rest', resourceCost:'sorcery_points', restoreCost:5}`

## Root cause — dead-code dispatch mismatch
A full dedicated implementation exists but **can never fire**:
1. `src/services/automation/index.js` `HANDLER_MAP` dispatches by RAW `auto.type`:
   - `save_attack: handleSaveAttack` (:298) ← the row's actual type (playbook 46j: sheet rows carry RAW classes.json automation) → **generic path always wins**
   - `warping_implosion: handleWarpingImplosion` (:454) ← **unreachable**: nothing in public/data or src ever produces type `warping_implosion`
2. `automationInfoBuilder.js:50` `DISPATCH[auto.type]` — `sorcery.js:68` `'warping_implosion'` builder (the ONLY place that computes the real ability DC and forwards `restoreCost`) never matches `save_attack`. Even its own output remaps `type:'save_attack'`, which would loop back to the generic handler anyway.
3. `handleWarpingImplosion` returns `modalName:'warpingImplosion'` — **ZERO renderers** in src/components + src/hooks (grep, non-test: 0 hits). Even if dispatched, the modal would silently swallow (§8-20).
4. `applyWarpingImplosion` (the only SP-restore + teleport-prose code: `spendSorceryPoints(..., restoreCost 5)`) — **ZERO consumers** outside its own test file.
5. Generic `saveAttackHandler.js` cost branches cover `channel_divinity` (:36/:106) and `wild_shape` (:44/:126) only — `resourceCost:'sorcery_points'`/`restoreCost:5` **no branch** → SP restore cannot exist on the live path.
6. `grep -rn "pulled" src/services/` → only flavor text (randomEventService riptide). **No pulled-toward producer anywhere.** No teleport state write on the live path (gridless lenient model still expects a state marker; none).

## Live evidence (test-campaign, all via self-issued localhost fetch/curl + tool code-echoes)
WORKING (generic save_attack half):
- Row `b.clickable "Warping Implosion:"` in Actions grid at lv18 Aberrant Sorcery (absent at Clockwork — subclass grant correct).
- Click → `.sp-overlay` AoE picker "Each must make a STR saving throw (DC 13)" — **DC 13 = 8 + CHA(−1) + PB(+6) exact**.
- Save SUCCESS: "Thug 1: Saved — takes no damage (rolled 15)", cs currentHp 32 unchanged.
- Long Rest re-arm (`warpingimplosionUses` ∈ LONG_REST_RESOURCES, restRules-constants.js:200): key 0 → null.
- Re-cast save FAIL: log `roll` `save-damage` `{formula:'3d10', rolls:[8,9,10], total:27, damageType:'Force', saveDc:13, saveType:'STR', saveResult:'failure', saveRoll:4, finalDamage:27}` + `hp_change` Thug 1 delta −27 → 5/32 + `ability_use` "Selecting 1 target(s) for save (DC 13 STR)".
- Once-per-LR latch: 2nd click at uses 0 → refusal popup "has been used and cannot be used again until a long rest"; refused spends nothing (SP unchanged, uses stayed 0, thugHp frozen).

FAILING (core clauses with zero live implementation):
- **No teleport**: no chooser, no popup choice, no state write — row goes straight to AoE picker. Feature's defining half (teleport 120 ft to unoccupied space) is absent.
- **No pulled-toward**: target activeConditions stays null; zero `pulled` producers app-wide.
- **No SP restore (5 SP)**: picker and refusal popup show no restore affordance; `sorcery_points` unhandled in generic handler; SP pool untouched through the whole session (14 → LR null → untouched).
- Gridless lenient accepted (§7): emanation 30 ft unenforced, picker lists all combatants incl. self.

## Secondary gaps
- Refusal is popup-only, no `*_refused` log (CLA-359 family).
- Save SUCCESS produces no log line of its own (only the picker ability_use; failure logs save fields, success leaves nothing).
- Picker header text claims "On a successful save, target takes half damage" — contradicts RAW/dcSuccess 'none' (damage logic itself is correct: success took 0).
- Uses decrement happens at picker-open (handler :198) — cancel would strand the charge (§4 known convention).

## Fix guidance
Route by feature name/flag before type (e.g. stamp a distinct automation type `warping_implosion` in classes.json, or special-case name in executeHandler), then register `warpingImplosion` modal renderer in SecondaryModals + wire confirm to `applyWarpingImplosion`, or add `sorcery_points` + `restoreCost` branches + teleport/pulled markers to the generic saveAttack path.

## Cleanup
Admin clear change-data + log; Thug removed with cs wipe. Host LEFT: **lv18 Aberrant Sorcery** (level bump permanent; CLA-389 Wild Magic Surge will need a step-7 chip swap to Wild Magic Sorcery — lv18 preserves both lv18 feature sets).
