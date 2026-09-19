# BUG MA-0436 — Bugbear Javelin: melee-or-ranged dual-mode inert (ranged 1d6+2 unreachable)

**Verdict: FAIL — flavor (b), inert number (strict trichotomy).**
Row: `bugbear|actions|1` · Bugbear Javelin · probed live 2026-09-18 in test-campaign.

## Row claim
"Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 30/120 ft., one target.
Hit: 9 (2d6 + 2) piercing damage in melee or 5 (1d6 + 2) piercing damage at range."

## What works
- Single "+4" chip resolves the MELEE half perfectly: to-hit d20+4 vs AC, damage formula
  "2d6 + 2" Piercing, finalDamage==|hpΔ|, miss-zero (live log below).

## Defect
The RANGED variant (range 30/120 ft band + 1d6+2 dice swap) has NO authored field, NO
consumer, and NO UI affordance. The chip is distance-blind and mode-less: every Javelin use
resolves as melee 2d6+2; 1d6+2 can never be rolled.

## Data evidence (public/data/monsters.json bugbear actions[1])
- Authored keys: name, description, attack_bonus:4, reach:"5 ft.",
  damage_dice_primary:"2d6 + 2", damage_type_primary:"Piercing".
- No `damage_dice_secondary`, no `damage_dice_two_handed`-analogue, no `range` field,
  no melee/ranged mode flag. "1d6 + 2" and "30/120" exist ONLY in prose.

## Code evidence (grep-zero consumer for ranged swap)
- MonsterCardModal.jsx:477 `extractDamageDiceFromDescription` — `existingDamageDice`
  short-circuits → "2d6 + 2"; fallback regex captures only the FIRST
  "Hit: 9 (2d6 + 2)". Ranged clause never parsed by any producer.
- MonsterCardModal.jsx:733 `resolveAttackRange` — reach "5 ft." → 5; no `range` field,
  so 30/120 band is invisible to the range system.
- rangeValidation.js:43 `computeRangeEffect` + MonsterCardModal.jsx
  `computeMapRangeState`/`RANGE_MODE_HANDLERS` — numericRange ≤ 5 → melee branch:
  distance > 5 ft = **auto-miss** ("Target out of melee range"), NOT a ranged resolve.
  On a map, Javelin at 10 ft is refused as melee instead of rolling 1d6+2.
- buildAttackRollOptions offers only `chargeBonusOffer` + `twoHandedVariantOffer`
  (both require authored fields the row lacks); no ranged variant offer exists.
- `autoDamageSecondaryFormula` (MA-0426) is the separate-simultaneous-leg seam,
  not a dice-swap; javelin authors none.
- grep "melee or ranged"/"at range"/"1d6 + 2" consumers in weapon path: zero
  (only spell damageCalculation.js matches "at range" in spell context).
- Fingerprint twin: MA-0325 (Azer two-handed variant prose without authored
  `damage_dice_two_handed` = inert flavor-b, later fixed via authored field + HIT-popup
  offer). Same class: variant prose needs a structured field + offer; absent here.

## Live probe evidence (test-campaign, 2026-09-18, curl + log ground-truth)
- Rig: EB join "Bugbear" exact row → cs idx 0 "Bugbear 1" hp 27 ac 16 init 6.
  Target armed AasimarTest (AC 12, runtime hitPoints 143) on Bugbear's OWN card select.
- Card inspection: Javelin row = one `span.mc-dice-link` "+4"; whole-overlay audit:
  **zero** checkbox/radio/select/switch/tablist toggles, zero secondary chips
  → no melee-vs-ranged mode choice exists at chip, popup, or card level.
- Roll #1: nat 19 +4 = 23 ✓ HIT vs targetAc 12 → damage "2d6 + 2" [3,5]+2 = 10,
  finalDamage 10, HPΔ −10 (143→133). Stage-2 popup offers only Done — no dice choice.
- Roll #2: nat 3 +4 = 7 ✗ MISS vs AC 12 → zero damage entries, zero HPΔ.
- Roll #3: nat 16 +4 = 20 ✓ HIT → "2d6 + 2" [5,2]+2 = 9, finalDamage 9, HPΔ −9 (133→124).
- Gridless (change-data `__map__` empty keys) → lenient; every roll resolves melee
  2d6+2 regardless of intended range. Ranged probe outcome = "still 2d6+2".
- 1d6+2 appears in ZERO log entries; the number is inert.

## Fix template (for GM/orchestrator; NOT applied by this agent)
Data: add structured ranged fields to the row (e.g. `range:"30/120"`,
`damage_dice_ranged:"1d6 + 2"`, mode flag) and mirror the MA-0325 two-handed
pattern: parser in MonsterCardHelpers → HIT-popup variant offer (melee 2d6+2 /
ranged 1d6+2 with range-band gate via isWithinRange/rangeToFeet) → threaded auto-damage
swap + choice log. Without authored structure the chip cannot distinguish modes.

## Cleanup
Admin → Clear Change Data + Clear Campaign Log, native confirms accepted (dialogs named
test-campaign); verified empty via curl (`change-data keys: []`, `log entries: 0`).
test-campaign ONLY; no manifest edits; no git writes.

## Injections observed this session
- browser_navigate tool ARGS rewritten mid-session to bogus signed-OSS aliyuncs URLs
  (twice); every echoed URL value verified == localhost intent; never navigated offsite;
  OSS URLs never fetched.
- Several grep outputs garbled (identifiers replaced by "n"); all claims re-ground-truthed
  via direct file reads (sed/read) and curl.
