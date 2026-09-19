# BUG MA-0547 — Cyclops Sentry Rock: ranged 30/120 band inert (band authored on disk yet unenforceable, dice exact)

**Verdict: FAIL — flavor (b), inert range band (strict trichotomy). Twin of MA-0539 (Cyclops Rock) / MA-0529 (Cult Fanatic Dagger) / MA-0436 / MA-0439.**
Row: `cyclops-sentry|actions|2` · Cyclops Sentry Rock · probed live 2026-09-19 in test-campaign.

## Row claim
"+9 ranged 30/120. Hit: 22 (3d10+6) Bludgeoning."

## What works (dice half — does not rescue the row)
- Single "+9" chip resolves: to-hit d20+9 vs AC18, damage formula "3d10 + 6" Bludgeoning
  logged exact, finalDamage==|hpD| on hit (nat18 total27 HIT, [4,9,1]+6=20, hpD -20),
  miss-zero machine-verified (nat2 total11 hit:false, zero damage entry).
- Dice exact — per MA-0529 ruling, dice-identical/dice-exact rows still FAIL on range-band inertness.

## Disk deviation from MA-0539 (note)
- Disk AUTHORS range:"30/120 ft." on actions[2] (own disk dump this session) — BETTER than
  MA-0539 which authored NO range field at all. Authored range string ≠ runtime-honored
  (playbook :134): rangeValidation.js:34 rangeToFeet regex is FULLY-ANCHORED single-number
  (/^-?d+(.d+)?s*(feet|foot|ft.?)?$/) — "30/120 ft." cannot match -> returns null.
- Consequence differs one step from 0539: resolveAttackRange (MonsterCardModal.jsx:735)
  finds action.range and calls rangeToFeet -> null (the hardcoded-30 fallback :736 is NOT
  reached here, unlike 0539 which fell to imagined flat-30); computeRangeEffect
  (rangeValidation.js:43-46) numericRange==null -> lenient {mode:normal}.
- Either path, identical fingerprint: EVERY Rock attack log entry rangeReason:null,
  mode:normal — band consulted-never-applied (playbook :103).
- Band-split grep-zero re-run this session: normal_range|long_range|range_band|rangeBand
  in src non-test = 0 hits. No mode/band toggle in popups (only Adv/Dis reroll + Done).
- 30/120 band (normal 30 + long-range disadvantage out to 120 ft.) is this row's ONLY
  distinguishing ranged semantics and is structurally unmodellable — same FAIL(b) ruling
  wording as MA-0539; sole deviation: disk hygiene is better here (range authored, prose
  clean — no 4dl0-type OCR typo; damage_dice_primary matches row exactly).

## Live probe evidence (test-campaign, 2026-09-19, Playwright + own curl ground-truth)
- Rig: EB search Cyclops Sentry exact CR6 row -> checkbox -> Join; re-nav EB, exact
  "| Knight | 3 |" row -> Join. cs via own curl: Knight 1 ac18 + Cyclops Sentry 1 ac14
  confirmed. HP staged 200/200 both via full-store POST /combatSummary {value:cs} -> 200.
- Card via avatar click, scoped .mc-action Rock row: ONE chip +9; row prose renders
  "range 30/120 ft." text-only. Target armed Knight 1 via selectOption on the Sentry's OWN
  initiative-card target-select (inputValue verified pre-chip).
- Roll #1: nat 2 +9 = 11 vs AC 18 MISS (hit:false) — zero damage entries, zero hp delta.
- Roll #2: nat 18 +9 = 27 HIT -> Done -> damage 3d10 + 6 [4,9,1]+6 = 20, finalDamage 20,
  hp_change -20 EXACT Bludgeoning; Knight 180 = 200-20.
- No nat20 rolled; crit seam cited per playbook :32 (dice double, flat +6 once).
- BOTH Rock attack log entries: rangeReason:null, mode:normal — band consulted-never-applied.
- No absorbed clicks this session; all first clicks landed.

## Adjudication (precedent-follow)
MA-0539 twin ruling: FAIL — flavor (b), inert range band (strict trichotomy); ranged
semantics structurally unreachable either way. Here the band IS the rows ranged identity;
disk authored it but the runtime regex cannot split it — same verdict. Disk/runtome
deviation noted above does not change the ruling.

## Fix template (GM/orchestrator; NOT applied by this agent)
rangeToFeet band splitter for "N/M ft." + band-aware resolveAttackRange + long-range
disadvantage leg honoring the second number (playbook :70 lists range bands as
advisory-unbuilt; needs ticket). Data already correct — pure code fix.

## Cleanup
Admin clear-change-data + clear-log via API -> both 200 (Change data cleared / Campaign log
cleared), quiet via own curl (log entries: 0, change-data keys: []), browser hard-reload to
quiet state. test-campaign ONLY; no manifest edits; no git writes.

## Injections observed this session
- None material; all location checks localhost:5173; all verdict data re-verified via own curl.
