# Bug CLA-130 — Faithful Steed: free cast never recharges on Long Rest + Find Steed summon is log-only (no steed ever created)

## Title
Faithful Steed free-cast latch `_Faithful_Steed_freeCastCount` is absent from LONG_REST_RESOURCES and every long-rest reset site → free use dead permanently after one cast; and Find Steed has no summon handler/stat block → cast produces log entry only, no steed card/summons anywhere.

## Overview
Verified 2026-10-04, test-campaign, host ElderPaladin lv20. Always-prepared + first free cast + second-cast slot gate all work; recovery and the actual summon do not.

## Expected Behavior
Find Steed always prepared; cast once without expending a slot; regain the free use on finishing a Long Rest; spell summons a steed (Find Steed block from spells/monsters data).

## Actual Behavior
1. PASS: always-prepared row + feature text pre-cast; change-data empty pre-test (lv2=3).
2. PASS: free cast #1 — modal "Free Cast — no spell slot consumed", lv2 3→3, latch `_Faithful_Steed_freeCastCount=0` stamped, log row ×1.
3. PASS: gate — cast #2 lost free badge → lv2 3→2 consumed; latch stayed 0.
4. FAIL(a): Long Rest ran (log long_rest, lv2 2→3) but latch stayed 0; key ABSENT from `LONG_REST_RESOURCES` (restRules-constants.js) and all reset sites in restRules-longRest.js (only perSpellTracking resets at :582). Post-LR modal: no free badge — never re-arms.
5. FAIL(b): no steed — no tracker card, no `summons` log entry, no `Summoned (source)` te; `free_spell` routes to generic handleSpellCast (automation/index.js:310); "Otherworldly Steed" stat block absent from monsters.json → silent log-only summon.

## Steps to Reproduce
1. test-campaign; lv20 Paladin (any, feature present at lv?—ElderPaladin lv20).
2. Cast Find Steed free → second cast consumes → Long Rest → reopen Find Steed: no free badge (bug a).
3. Any successful cast → tracker: no steed appears (bug b).

## Likely Location
- `restRules-constants.js` LONG_REST_RESOURCES — include `_Faithful_Steed_freeCastCount` (family fix: every `_<Feature>_freeCastCount` consumer must be listed or free uses die permanently).
- New Find Steed summon handler (CLA-127 Primal Companion picker lane is the working template) + steed stat blocks in monsters.json.

## Notes
- free_spell+uses/recharge routes to specialActions row (routeCtPassiveBonusOrAction); free authorization = "Free Cast — no spell slot consumed" paragraph in spell-detail modal.
- Admin cleared, GET-empty; disk untouched (git clean). Verified 2026-10-04.
