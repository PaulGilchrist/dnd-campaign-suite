# BUG — CLA-372 Uncanny Metabolism: once-per-Long-Rest gate resets on EVERY initiative roll

**Verdict: FAIL** (2026-09-09) · Host: Disciplined_Monk lv18 2024 Monk (Warrior of Shadow) · test-campaign

## App canonical
- `public/data/2024/classes.json` [5]=Monk `class_levels[0].features[1]` — **BASE Monk lv1** (offer model).
- automation `{type:'initiative_action', effect:'regain_focus_points_and_heal', healExpression:'monk_level + martial_arts_die', uses:1, recharge:'long_rest'}`.
- Row: Special Actions `b.clickable` "Uncanny Metabolism:" → router `initiative_action` → `automation/index.js:311` → `handlers/combat/initiativeHandler.js:150-215`.

## PASS clauses (live EXACT)
1. **First trigger** (FP pre-spent 18→17 via Heightened Step of the Wind; HP GM-set 129→80 on initiative card; initiative rolled d20 2+3=5):
   - FP **17→18** (regain all to lv18 max ✓)
   - HP **80→101**, delta **+21 = 18 (Monk lv) + 3 (d12)** — formula exact, clamped to max 129 model ✓
   - change-data `uncannyMetabolismUsed=true` ✓
   - Logs: `hp_change {targetName:Disciplined_Monk, sourceName:"Uncanny Metabolism", delta:21, currentHp:101, maxHp:129, isHealing:true}` + `ability_use "Rolled 3 (1d12) + 18 (Monk level) = 21 HP. Regained all Focus Points."` ✓ (NOT popup-only)
2. **Same-initiative refusal**: re-click row while flag true → popup "Uncanny Metabolism has been used and cannot be used again until a long rest.", zero HP/FP/log deltas ✓ (refusal itself is popup-only, no `<feature>_refused` log — secondary logging gap vs family precedent).
3. **LR re-arm**: Long Rest → flag false, HP 129 full, FP null(=max) ✓.

## FAIL clause — once-until-Long-Rest gate
`src/hooks/combat/initiativeProcessing.js:32` (processInitiativeRoll) unconditionally runs
`setRuntimeValue(characterName, 'uncannyMetabolismUsed', false, campaignName)` on **every** initiative roll.

Live proof:
- After first use: flag `true` (change-data).
- Rolled initiative AGAIN, no rest (d20 9+3=12): change-data transition captured `uncannyMetabolismUsed: true → **False**`.
- Re-click row → **feature FIRED AGAIN**: popup "Rolled 4 (1d12) + 18 = 22 HP", HP **70→92**, FP **17→18** (pre-spent via a second real Step of the Wind FP use), second `ability_use` + `hp_change` pairs in log. Full regain, no long rest consumed.

So the feature is effectively **once per initiative roll**, and the LR gate is vacuous. Per verdict policy (unenforced gate = FAIL even if math exact).

## Fix recipe
- **Delete the reset at initiativeProcessing.js:32** — the flag's only legitimate reset is Long Rest (`restRules-longRest.js:400` already sets `uncannyMetabolismUsed=false`; keep that). If a "new combat offer" UX is wanted, gate on `auto.uses`/round, never clear the LR latch.
- Secondary: add a refusal log (`type:'automation'`, `uncanny_metabolism_refused`) on the refusal branch of `initiativeHandler.js` (family precedent CLA-345/355/394); refusals returned as `type:'popup'` from `handle()` DO reach the generic flusher when `logEntries` is attached (CLA-359 recipe).
- Advisory: handler has no "did you actually roll initiative" gate — row works any time (trigger ungated, §7 family); `auto.uses:1` counter (`uncannymetabolismUses` resourceKey from infoBuilder/initiative.js) is never registered in trackedResources nor spent — boolean flag is the sole state.

## Cleanup
Admin clear change-data + log (curl Host:localhost). Host kept lv18 Monk (CLA-387 needs lv≥17). Retest here post-fix.
