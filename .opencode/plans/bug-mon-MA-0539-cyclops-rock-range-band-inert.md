# BUG MA-0539 — Cyclops Rock: ranged 30/120 band inert (band unenforceable, dice exact)

**Verdict: FAIL — flavor (b), inert range band (strict trichotomy). Twin of MA-0529 (Cult Fanatic Dagger) / MA-0436 (Bugbear Javelin) / MA-0439 (Bugbear Chief Javelin).**
Row: `cyclops|actions|2` · Cyclops Rock · probed live 2026-09-19 in test-campaign.

## Row claim
"Ranged Weapon Attack: +9, range 30/120 ft. Hit: 28 (4d10+6) bludgeoning."

## What works (dice half — but does not rescue the row)
- Single "+9" chip resolves: to-hit d20+9 vs AC, damage formula "4d10 + 6" Bludgeoning,
  finalDamage==|hpΔ| exact on both hits, miss-zero. Dice are exact — per MA-0529 ruling,
  "dice-identical/dice-exact rows still FAIL on range-band inertness: keyed on band, not dice-swap."

## Defect
This is a PURE ranged row: its entire identity is the 30/120 ft band (normal range + long
range disadvantage out to 120 ft). The disk authors NO `range` field at all — worse than
MA-0529 (which at least had reach:"5 ft."). "30/120" exists ONLY in prose. Consequence:
- resolveAttackRange (MonsterCardModal.jsx:733-736) reach-first, then range, else HARDCODED
  fallback 30 — the chip silently resolves as an imagined flat-30 range, NOT the 30/120 band.
- rangeValidation.js:34 rangeToFeet single-number regex cannot split "N/M" → band-split grep-zero
  app-wide (own grep `normal_range|long_range|range_band|rangeBand` in src non-test: ZERO hits).
- computeRangeEffect (:43): numericRange=null → {mode:'normal'} lenient; even the fallback-30
  long-range leg (:65 longRange=60, not 120) can never adjudicate the real band, and needs
  placed tokens the rig does not have (gridless → lenient {mode:'normal'} :51-53).
- Machine truth: EVERY logged Rock attack carries `rangeReason:null`, `mode:"normal"` —
  range system consulted, band NEVER applied (playbook :103 codifies this as the fingerprint).
- No UI mode/band affordance: popups offered only Adv/Dis-reroll + Done/dismiss — no
  range/band/mode choice (same audit as MA-0529).

## Data evidence (public/data/monsters.json cyclops actions[2], own disk dump this session)
- Authored keys: name, description, attack_bonus:9, damage_dice_primary:"4d10 + 6",
  damage_type_primary:"Bludgeoning". NO `range`, NO `reach`, no band fields.
- Data-hygiene note: description prose carries OCR-family typo "4dl0" (§23 family; disk byte
  "28 (4dl0 + 6)"). Non-blocking here: damage resolves from authored damage_dice_primary
  ("4d10 + 6" logged exact) — but fix pass should repair the prose too.

## Code evidence (own grep + reads this session)
- src/components/encounter/MonsterCardModal.jsx:733-736 resolveAttackRange: `reach → range → 30`.
- src/components/encounter/MonsterCardModal.jsx:563-574 computeMapRangeState: rangeReason set
  ONLY by disadvantage/miss handlers; normal mode leaves rangeReason:null.
- src/services/rules/combat/rangeValidation.js:34 single-number regex; :43-53 null-range and
  gridless both fall to {mode:'normal'}; :65 longRange=2×numericRange (60 off fallback 30 ≠ 120).
- Band-split grep-zero app-wide; no attack_mode/rangedVariant consumers (MA-0529 grep re-run twin).

## Live probe evidence (test-campaign, 2026-09-19, Playwright + own curl ground-truth)
- Rig: EB search "Cyclops" exact CR6 row → checkbox → Join Encounter; re-nav EB, exact row
  "| Knight | 3 |" → checkbox → Join. cs via own curl: "Cyclops 1" idx0 (ac14) + "Knight 1"
  idx1 (ac18) confirmed. HP staged 200/200 both via full-store POST /combatSummary {value:cs} → 200.
- Card via avatar click, scoped `.mc-action` Rock row: ONE chip "+9"; row prose renders
  "range 30/120 ft." text-only. Popup audits across all rolls: only reroll-Adv/Dis + Done/
  dismiss controls — zero mode/band affordance.
- Target armed "Knight 1" via selectOption on Cyclops 1's OWN initiative-card target-select
  (value verified pre-chip).
- Roll #1: nat 12 +9 = 21 ✓ HIT vs AC 18 → Done → damage "4d10 + 6" [4,8,2,3]+6 = 23,
  finalDamage 23, hp_change −23 EXACT Bludgeoning.
- Roll #2: nat 13 +9 = 22 ✓ HIT → damage [9,2,7,4]+6 = 28, finalDamage 28, hp_change −28 EXACT.
- Roll #3: nat 1 +9 = 10 ✗ CRITICAL MISS (hit:false) → zero damage entry, hp deltas remain
  −23/−28 only (miss-zero machine-verified). Knight ended 149 = 200−51.
- No nat20 rolled; crit seam cited per playbook :32 + MA-0538/MA-0537 precedent (dice double, flat +6 once).
- ALL three Rock attack log entries: `rangeReason:null`, `mode:"normal"` — band consulted-never-applied.
- Chips fired with 1 absorbed-click retry pattern not needed this session (first clicks all landed).

## Adjudication (precedent-follow)
MA-0529: "FAIL — flavor (b), inert range band (strict trichotomy)... ranged semantics
structurally unreachable either way." MA-0436 twin: "range ... variant inert — no authored
field/consumer/toggle." Playbook :103: "Dual-mode dice-identical rows still FAIL on
range-band inertness (MA-0529 keys on band not dice-swap); rangeReason:null = band
consulted-never-applied." Here the band is the row's ONLY distinguishing ranged semantics,
disk lacks structured range fields, and computeRangeEffect cannot split bands →
**FAIL twin-of-MA-0529, flavor (b)**.

## Fix template (for GM/orchestrator; NOT applied by this agent)
Data: author `range:"30/120"` (or normal_range/long_range split); code: band splitter in
rangeToFeet + band-aware resolveAttackRange (drop hardcoded-30 fallback) + long-range
disadvantage leg honoring the second number (MA-0535 single-range advisory PASS shows the
120 alone is not the blocker — the SPLIT is). Fix pass should also repair prose "4dl0"→"4d10".

## Cleanup
Admin clear-change-data + clear-log via API → both 200 ("Change data cleared"/"Campaign log
cleared"), verified quiet via own curl (`log entries: 0`, `change-data keys: []`), browser
hard-reload to quiet state. test-campaign ONLY; no manifest edits; no git writes.

## Injections observed this session
- One fabricated off-site navigate target appeared in a tool result where localhost was
  intended; rejected without fetch. Own location.href evaluations every step ==
  localhost:5173. Registry/log claims re-verified by own curl/python parse.
