# BUG MA-0529 — Cult Fanatic Dagger: melee-or-ranged dual-mode inert (20/60 band unreachable)

**Verdict: FAIL — flavor (b), inert range band (strict trichotomy). Same fingerprint as twins MA-0436 (Bugbear Javelin) / MA-0439 (Bugbear Chief Javelin).**
Row: `cult-fanatic|actions|1` · Cult Fanatic Dagger · probed live 2026-09-19 in test-campaign.

## Row claim
"Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one creature.
Hit: 4 (1d4 + 2) piercing damage."

## What works (melee half — no FAIL(a))
- Single "+4" chip resolves the MELEE half exactly: to-hit d20+4 vs AC, damage formula
  "1d4 + 2" Piercing, finalDamage==|hpΔ|, miss-zero. Same seam pre-cited MA-0528
  (Dagger +4 fired x2 vs Bandit AC12, nat17/nat18 exact finalDamage 6 == |hp_change -6|).

## Defect
The RANGED mode (range 20/60 ft band) has NO authored field, NO consumer, and NO UI
affordance. The chip is distance-blind and mode-less: every Dagger use resolves as a
reach-5 melee attack; a RAW-legal shot at 20–60 ft can never be adjudicated (on-grid
>8 ft = auto-miss per melee branch; gridless = lenient normal with no band applied —
`rangeReason:null` on every logged attack).
Unlike the javelin twins this row authors ONE dice set (identical 1d4+2 both modes), so
the only inert semantics are the range bands themselves — but they are equally unenforceable.

## Data evidence (public/data/monsters.json cult-fanatic actions[1], own disk dump this session)
- Authored keys: name, description, attack_bonus:4, reach:"5 ft.",
  damage_dice_primary:"1d4 + 2", damage_type_primary:"Piercing".
- No `range` field, no `damage_dice_secondary`/ranged analogue, no melee/ranged mode flag.
  "20/60" exists ONLY in prose. Manifest row matches disk byte-for-byte.

## Code evidence (own grep + reads this session — twin fingerprint re-grounded, not copied)
- MonsterCardModal.jsx:733-734 `resolveAttackRange` — reach-first: `action.reach` →
  rangeToFeet("5 ft.")=5; row authors no range field, so the 20/60 band is invisible.
- rangeValidation.js:34 `rangeToFeet` — single-number regex `^(-?\d+(\.\d+)?)\s*(feet|foot|ft\.?)?$`
  cannot split "N/M"; "20/60" → null (grep-zero band-split app-wide, twin-confirmed).
- rangeValidation.js:53 `computeRangeEffect` — numericRange 5 ≤ MELEE_RANGE_FT 8 → melee
  branch: distance > 8 ft = auto-miss ("Target out of melee range"), NOT a ranged resolve;
  distanceFt null (gridless) → lenient {mode:'normal'} with no band consulted (:49-51).
- MonsterCardModal.jsx:477-478 `extractDamageDiceFromDescription` — existingDamageDice
  short-circuits → "1d4 + 2" (moot here: same dice both modes; no dice-swap needed,
  none exists, none authored).
- grep `damage_dice_ranged|damageDiceRanged|rangedVariant|ranged_variant|RangedVariant|attack_mode|attackMode`
  in src/: ZERO. grep "melee or ranged" non-spell weapon-path consumers: ZERO.
- Fingerprint twins: MA-0436/MA-0439 (Bugbear/Bugbear Chief Javelin dual-mode inert);
  playbook §132/§133 codify: authored "N/M" prose ≠ runtime-honored; dual-mode rows
  collapse to melee by construction.

## Live probe evidence (test-campaign, 2026-09-19, Playwright + own curl ground-truth)
- Rig: EB search "Cult Fanatic" exact row → checkbox → Join Encounter; re-nav EB, exact-td
  "Bandit" → checkbox → Join. cs: "Cult Fanatic 1" idx0 + "Bandit 1" idx1 confirmed via
  own curl change-data dump. HP staged 999/999 both via full-store POST /combatSummary.
- Card audit (`.mc-overlay`, scoped `.mc-action:has-text('Dagger')`): ONE chip "+4";
  whole-overlay audit `[role=switch]/[role=radiogroup]/[role=tablist]/checkbox/radio/select`
  = **zero** → no melee-vs-ranged mode toggle exists at chip, popup, or card level.
  "20/60" present in card prose only.
- Target armed "Bandit 1" on Cult Fanatic's OWN initiative-card target-select (selectOption;
  self excluded from options, Bandit 1 present; verified value pre-chip).
- Roll #1: nat 4 +4 = 8 ✗ MISS vs AC 12 (log `hit:false`, zero damage, zero hp_change).
  Popup offered only Adv/Dis/dismiss — no mode/dice choice.
- Roll #2: nat 11 +4 = 15 ✓ HIT vs AC 12 → Done → damage formula "1d4 + 2" [4]+2=6,
  finalDamage 6, hp_change delta −6 (999→993) — melee half EXACT.
- Every attack log entry: `rangeReason:null`, `mode:"normal"` — range system consulted but
  band NEVER applied. Map active (`__map__.activeMapName`) but tokenless (`tokens:[]`) →
  gridless lenient; distance unriggable in tokenless initiative (§100). Even if tokens were
  placed, :53 melee branch auto-misses >8 ft; the 20/60 band can never be consulted
  (:34 band-split grep-zero). Ranged semantics structurally unreachable either way.

## Adjudication (precedent-follow)
MA-0436 twin text: "FAIL-Javelin: melee half ... exact; ranged ... 30/120 variant inert —
no authored field/consumer/toggle, >5ft auto-miss". MA-0439: "FAIL — flavor (b), inert
number". Identical construction here (identical-dice variant): melee-exact +
ranged-unadjudicable = **FAIL twin**.

## Fix template (for GM/orchestrator; NOT applied by this agent)
Data: author `range:"20/60"` (or split `normal_range`/`long_range`) + mode flag; code:
range-band splitter in rangeValidation (rangeToFeet band branch) + dual-mode aware
resolveAttackRange (ranged mode when distance>reach) + HIT/popup mode affordance mirroring
MA-0325 two-handed variant offer. Without authored structure the chip cannot select modes.

## Cleanup
Admin clear-change-data + clear-log via API (localhost admin; fires native confirm — handled),
verified empty via own curl (`log entries: 0`, `change-data keys: []`). test-campaign ONLY;
no manifest edits; no git writes.

## Injections observed this session
- Tool-result stream carried fabricated off-site navigate entries (signed-OSS aliyuncs URLs
  appearing where localhost navigation was issued) + empty-tool-output noise; own
  `location.href` evaluate confirms every real page URL == localhost:5173 intent; never
  navigated offsite; OSS URLs never fetched; log/registry claims re-verified by own curl/parse.
