# BUG MA-0439 — Bugbear Chief Javelin: melee-or-ranged dual-mode inert (ranged 1d6+3 unreachable)

**Verdict: FAIL — flavor (b), inert number (strict trichotomy). Same fingerprint as twin MA-0436.**
Row: `bugbear-chief|actions|2` · Bugbear Chief Javelin · probed live 2026-09-18 in test-campaign.

## Row claim
"Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft., one target.
Hit: 10 (2d6 + 3) piercing damage in melee or 6 (1d6 + 3) piercing damage at range."

## What works (melee half — no FAIL(a))
- Single "+5" chip resolves the MELEE half perfectly: to-hit d20+5 vs AC, damage formula
  "2d6 + 3" Piercing, finalDamage==|hpΔ|, miss-zero (live log below).

## Defect
The RANGED variant (range 30/120 ft band + 1d6+3 dice swap) has NO authored field, NO
consumer, and NO UI affordance. The chip is distance-blind and mode-less: every Javelin use
resolves as melee 2d6+3; 1d6+3 can never be rolled.

## Data evidence (public/data/monsters.json bugbear-chief actions[2], verified this session)
- Authored keys: name, description, attack_bonus:5, reach:"5 ft.",
  damage_dice_primary:"2d6 + 3", damage_type_primary:"Piercing".
- No `damage_dice_secondary`, no `damage_dice_two_handed`-analogue, no `range` field,
  no melee/ranged mode flag. "1d6 + 3" and "30/120" exist ONLY in prose.
- Prose internally consistent with authored dice: 10 (2d6 + 3) melee, 6 (1d6 + 3) range
  (floor-average); manifest row matches disk byte-for-byte.

## Code evidence (own grep + reads this session — twin fingerprint confirmed, not copied)
- MonsterCardModal.jsx:733 `resolveAttackRange` — reach "5 ft." → 5; no `range` field,
  so 30/120 band is invisible to the range system.
- MonsterCardModal.jsx:477-482 `extractDamageDiceFromDescription` — `existingDamageDice`
  short-circuits → "2d6 + 3"; fallback regex captures only the FIRST
  "Hit: 10 (2d6 + 3)". Ranged clause never parsed by any producer.
- rangeValidation.js:43 `computeRangeEffect` — numericRange 5 ≤ MELEE_RANGE_FT 8 → melee
  branch: distance > 8 ft = **auto-miss** ("Target out of melee range"), NOT a ranged
  resolve. On a map, Chief's Javelin at 10+ ft is refused as melee instead of rolling 1d6+3.
- buildAttackRollOptions offers only `chargeBonusOffer` + `twoHandedVariantOffer`
  (MonsterCardModal.jsx:727/:729; both require authored fields the row lacks); no ranged
  variant offer exists app-wide.
- grep `damage_dice_ranged|damageDiceRanged|rangedVariant|ranged_variant|RangedVariant`
  in src/: ZERO. grep "melee or ranged"/"at range" non-spell weapon-path consumers: ZERO.
- `autoDamageSecondaryFormula` (MA-0426) is the separate-simultaneous-leg seam,
  not a dice-swap; Chief Javelin authors none.
- Fingerprint twins: MA-0436 (Bugbear Javelin, same inert dual-mode construction) and
  MA-0325 (Azer two-handed variant prose without authored field = inert flavor-b).

## Live probe evidence (test-campaign, 2026-09-18, curl + log ground-truth)
- Rig: EB search "Bugbear Chief" exact row → checkbox → Join Encounter → cs idx 0
  "Bugbear Chief 1" hp 65 ac 17 init 4 (correct statblock). Target armed AasimarTest
  (AC 12, runtime hitPoints 143) on Bugbear Chief's OWN initiative-card target-select
  (selectOption → value "AasimarTest").
- Card inspection: Javelin row = one `span.mc-dice-link` "+5"; whole-overlay audit:
  **zero** checkbox/radio/select/switch/tablist toggles → no melee-vs-ranged mode choice
  exists at chip, popup, or card level.
- Roll #1: nat 7 +5 = 12 ✓ HIT vs targetAc 12 (exact boundary) → damage "2d6 + 3"
  [4,1]+3 = 8, finalDamage 8, HPΔ −8 (143→135). Stage-2 popup offers only Done — no dice choice.
- Roll #2: nat 6 +5 = 11 ✗ MISS vs AC 12 (boundary pair) → zero damage entries, zero HPΔ.
- Roll #3: nat 7 +5 = 12 ✓ HIT → "2d6 + 3" [6,6]+3 = 15, finalDamage 15, HPΔ −15 (135→120).
- Gridless lenient (no token distance) → every roll resolves melee 2d6+3 regardless of
  intended range. Ranged probe outcome = "still 2d6 + 3".
- "1d6" appears in ZERO log entries (9 total); the ranged number is inert.

## Fix template (for GM/orchestrator; NOT applied by this agent)
Data: add structured ranged fields to the row (e.g. `range:"30/120"`,
`damage_dice_ranged:"1d6 + 3"`, mode flag) and mirror the MA-0325 two-handed
pattern: parser in MonsterCardHelpers → HIT-popup variant offer (melee 2d6+3 /
ranged 1d6+3 with range-band gate via isWithinRange/rangeToFeet) → threaded auto-damage
swap + choice log. Without authored structure the chip cannot distinguish modes.

## Cleanup
Admin → Clear Change Data + Clear Campaign Log, native confirms accepted (Admin page of
test-campaign); verified empty via curl (`change-data keys: []`, `log entries: 0`).
test-campaign ONLY; no manifest edits; no git writes.

## Injections observed this session
- navigate/click/type tool ARGS and code-echo wrappers rewritten mid-session to bogus
  signed-OSS aliyuncs URLs (multiple times, incl. twice inside a single navigate block);
  every result URL verified == localhost:5173 intent; never navigated offsite; OSS URLs
  never fetched.
- One run_code_unsafe call had args mangled (ReferenceError from stripped closure vars);
  retried with self-contained single-purpose evaluates.
- Playbook-anticipated near-miss avoided: Initiative-page "Clear" (renames joined
  monsters) was NOT clicked; cleanup performed only via Admin data-management buttons.
