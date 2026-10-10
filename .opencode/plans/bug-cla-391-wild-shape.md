# Bug Report — CLA-391 Wild Shape (Druid lv2 BA shape-shift)

**Verdict: FAIL — ON leg crashes the tab at the form chooser (reproduced 2/2).**

## Host / environment
- Campaign: `test-campaign` (header verified), http://localhost:5173 (Vite) + :80 (Express).
- Host: `Wild_Sage_Druid` lv20 Druid, Circle of the Stars, rules 2024. Baseline AC 9, HP 143/143, Speed 30, Wild Shape Uses 4/4, Max CR 1, limitations walk/swim/fly. File untouched (md5 `5eb3c237a61cd55916232fc1a02de20f`).

## Data quote (`public/data/2024/classes.json`, Druid lv2)
- Feature: "Wild Shape … As a Bonus Action, you shape-shift into a Beast form … Temporary Hit Points equal to your Druid level. Your game statistics are replaced by the Beast's stat block … No Spellcasting."
- automation: `{type:"temp_buff", effect:"shape_shift", action:"bonus_action", duration:"half_druid_level_hours", tempHpExpression:"druid_level", uses:2, recharge_short_rest:1, recharge_long_rest:"all", blocksSpellcasting:true}`
- lv20 progression: `wild_shape: 4`, `beast_max_cr: 1`, fly yes.

## What works (server leg)
- OFF/press toggles `activeBuffs` entry (`effect: shape_shift`, duration half_druid_level_hours → renders "Wild Shape: 10 hours" badge, blocksSpellcasting:true) via `buffHandler.js:182→handleShapeShift` (buffHandler.js:396).
- Uses gate present: at `wildShapeUses<=0` refuses with popup + log `wild_shape_refused` "No Wild Shape uses remaining." (buffHandler.js:403–422) — code verified; could not exercise live because the ON modal crashes before consumption ever drops uses.
- OFF leg: `cleanupWildShape` + log "Wild_Sage_Druid deactivated Wild Shape." (observed live via GET /api/campaigns/test-campaign/log — verified buff cleared, tempHp reset, uses unchanged 4/4; OFF leg at 0 uses allowed by design, buffHandler.js:179–182).
- Use consumption & THP live in `activateWildShape` (wildShapeCreatureBuilder.js:114–153): THP = level, combatant stamp `beastIndex/beastName/wildShapeSource`, te `wild_shape`, `spendAndLogWildShapeUse` decrements `wildShapeUses`. **Never reached — no form is ever chosen.**

## The failure
Press Wild Shape (ON leg) → `handleShapeShift` returns popup `wild_shape_select` → `PolymorphSelectionModal` (CharSheet.modals.jsx:43) mounts → **tab main thread freezes within seconds, then "Target crashed"**. Reproduced twice (two fresh page loads, two ON presses). During the freeze all Playwright calls time out; only a page reload recovers. Press left the buff stuck ON (activeBuffs=[Wild Shape], uses 4/4, no beast stamped) — recovered via second press (OFF leg) before reload.

### Probable root cause
`PolymorphSelectionModal.jsx:185` — `useEffect` deps include `excludeTypes` and props defaulted in the component signature (`excludeTypes = []`, PolymorphSelectionModal.jsx:162). The Wild Shape caller (CharSheet.modals.jsx:47–58) does NOT pass `excludeTypes` (nor `maxCR`), so a fresh `[]` array identity is created on every render → effect refires → `loadMonsters()` resolves from cache → `setBeasts(filterCreatureList(...))` produces a new array → re-render → new `[]` default → **infinite effect/render loop**. Amplified by 62 remote GitHub-pages image loads (`BeastRow`, PolymorphSelectionModal.jsx:131) re-created per loop pass.

Fix candidates (do NOT apply without approval): memoize default (`const DEFAULT_EXCLUDE = []` module const), or pass explicit stable props from CharSheet.modals.jsx, or compare deps by value.

## Verification gaps (blocked by crash)
- Form stamp + combatant-stat swap (hp/ac/damage), uses 4→3 decrement, form-attack leg, 0-uses refusal popup live — all unreachable until the chooser renders.

## Cleanup performed
- OFF press reverted stuck buff (GET verified: activeBuffs [], tempHp 0, wildShapeUses 4).
- `POST /admin/clear-change-data` + `POST /admin/clear-log` on test-campaign, GET-verified empty.
- Host JSON byte-proof md5 `5eb3c237a61cd55916232fc1a02de20f` unchanged before and after.
