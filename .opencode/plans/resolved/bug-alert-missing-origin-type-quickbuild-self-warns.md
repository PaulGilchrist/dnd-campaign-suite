# Quick-build draft trips the wizard's own Origin-feat validation — `Alert` is untagged as an Origin feat in the 2024 data

## Summary
`public/data/2024/feats.json` types 11 feats as Origin (Crafter, Fey Touched, Healer, Lucky, Magic Initiate, Musician, Savage Attacker, Shadow Touched, Skilled, Tavern Brawler, Tough) but NOT `Alert` — which the 2024 PHB publishes as an Origin feat and which `backgrounds.json` grants as the feat for both `Guard` and `Criminal`. Consequently a 2024 Quick-build draft (the generator pre-selects the background-granted Alert) lands on the Feats step showing "You have selected 0 of 1 allowed feat(s) (plus 1 pre-selected feat)" PLUS the warnings "Your selected feats don't include an Origin feat" / "Some selected feats are not Origin feats" — the shipped quick-build generator produces a draft that its own step validator calls internally inconsistent, on every 2024 run whose background grants Alert.

## Steps to reproduce
1. In test-campaign (localhost), click **Add Character**.
2. On the Ruleset step click **Quick build** + **2024 Rules (Essentials)** → Next.
3. Step 2: name the character anything → Next → Step 3 Race (leave Human) → Next → Step 4 Subrace → Next (Step 5 Background prefills **Guard**).
4. Next (Step 6 Class, leave Fighter) → Next (Step 7 Subclass, leave Battle Master) → Next (Step 8 Feats).
5. Observe the Feats step copy.

## Expected behavior
The quick-build draft satisfies the step's own Origin-feat rule: either the Alert pre-select is recognized as the Origin feat (Alert carries its PHB Origin type in `feats.json`), or the generator picks a tagged Origin feat. No self-contradictory warning on a machine-generated draft.

## Actual behavior
Feats step renders, verbatim:

    You have selected 0 of 1 allowed feat(s) (plus 1 pre-selected feat).
    ...
    Your selected feats don't include an Origin feat.
    Some selected feats are not Origin feats.

while the Feats list shows `Alert (Pre-selected) ✓`. The Versatile Trait origin-choice list also omits Alert (same missing tag), so the Human bonus-origin affordance and the background pre-select disagree. Disk evidence (no UI needed): `python3 -c` over `public/data/2024/feats.json` — 11 rows contain the Origin type, Alert does not; `public/data/2024/backgrounds.json` — `Guard.feat = "Alert"`, `Criminal.feat = "Alert"`. Reproduced twice (Rogue path and Fighter path).

## Likely location
Confident on the data lane: `public/data/2024/feats.json` row `alert` lacks the Origin `type` that the other 11 origin feats carry. Code consumers: the Origin-feat validator in the wizard's feats step (`src/hooks/wizard/` feats hook / step validator) and `src/services/character/quickBuildService.js` (origin-feat pre-select from `background.feat`).

## Suggested fix
Tag Alert with the same Origin `type` value the other 11 rows use in `public/data/2024/feats.json` (audit the other 2024 PHB origin feats for the same omission while there — cross-check the Versatile Trait choice list). Verify a 2024 Quick-build Fighter lands on Feats with zero warnings, and that custom-build Alert selection no longer warns. No app-code change should be needed if the validator reads `type`.

## Severity
Minor UX issue / wrong data in shipped feature. Nothing breaks or corrupts state (the validation is advisory and Save is reachable), but the flagship "level-1 draft that passes the same validators" promise visibly fails its own step on the most common 2024 background-granted feat, teaching players their legal draft is illegal.

## Resolution
**FIXED 2026-11-19 — data-only fix exactly as suggested; root cause confirmed as diagnosed.**

**What was actually wrong:** `public/data/2024/feats.json` row `alert` was the ONLY feat of 71 missing the `type` field entirely (all 11 other Origin feats carry `"type": "Origin Feat"`; the other 59 carry General/Fighting Style/Epic Boon). It was also the only row missing `prerequisites`/`ability_score_increase`/`repeatable`/`tags`. The wizard validator (`src/services/character/featValidation.js` `checkOriginFeatRequirements`) gates purely on `f.type === 'Origin Feat'`, so the quick-build draft's pre-selected Alert (from `backgrounds.json` Guard/Criminal `feat: "Alert"`) was invisible to it → both origin warnings fired on every 2024 quick-build. Secondary face: the Human `Versatile` trait's `proficiency_choices.from` in `public/data/2024/races.json` enumerated the 11 tagged feats by hand and also omitted Alert — PHB 2024 grants "an Origin feat of your choice", which includes Alert.

**Files changed:**
- `public/data/2024/feats.json` — Alert row normalized to the canonical feat shape: `"type": "Origin Feat"`, `"prerequisites": null`, `"ability_score_increase": null`, `"repeatable": false`, `"tags": ["initiative", "awareness", "origin"]` (mirrors the sibling origin rows, all of which carry an `origin` tag). `benefits`/`automation` left byte-identical (the string-benefits quirk predates this bug and all consumers tolerate it; converting it is out of scope).
- `public/data/2024/races.json` — Human `Versatile.proficiency_choices.from` gains `"Alert"` (list now = the full 12-feat PHB origin set, agreeing with the feats-data tag and the background pre-select).
- `src/services/character/featValidation.origin-feat-disk.test.js` (NEW) — disk-pinned regression test (readFileSync of the real 2024 feats/backgrounds/races, mirroring the `sacredWeaponRowActivation.test.js` disk-oracle idiom): Alert `getFeatTypeInfo` is Origin; the disk origin set == the 12 PHB origin feats; EVERY 2024 background-granted feat resolves to an Origin-typed row (guards future backgrounds); Human Versatile list == tagged origin set; `getPreSelectedFeats({Guard})` → `['Alert']`; `validateFeats` on the verbatim quick-build draft → **zero** warnings; and the validator still warns for a genuinely non-Origin custom selection (both messages for `['Chef']`, the one info message for `['Alert','Chef']`).
- 5e audit: `public/data/feats.json` Alert correctly stays untyped — Origin feats are a 2024-only concept and `checkOriginFeatRequirements` is gated `ruleset === '2024'`. No dual-ruleset change needed.

**Verification:**
- Reproduced live pre-fix (Playwright, test-campaign, Quick-build 2024/Human/Fighter walk): Feats step showed verbatim "Level 1 2024 characters should select an Origin feat…" + "Some selected feats are not Origin feats…" while `Alert (Pre-selected) ✓` was checked, and the Versatile options list started at Crafter.
- Re-ran the exact repro post-fix (fresh page load): Feats step shows NO warnings (`warning` DOM count 0), the Alert row now carries the `Origin Feat` type badge, and the Versatile list reads "Alert, Crafter, … Tough" — machine draft self-consistent, and the Versatile list now agrees with the background pre-select.
- Adjacent sanity live: selecting Chef alongside the pre-selected Alert still correctly produces "Some selected feats are not Origin feats…" (and it drains on unselect); custom-build validator lane untouched by design.
- Tests: new file 23/23 pass; touched folders (`src/services/character` + `src/components/character-creation`) 97 files / 1479 tests pass; FULL suite `npm run test:run` 3433 files / 36551 tests pass; `npm run lint` zero warnings.
- Hygiene: throwaway drafts discarded pre-save (zero characters created, `ZZ*` names never hit disk); test-campaign change-data cleared to `{}` and log to `[]` via the campaign-scoped admin routes after closing the tab; only the three paths above changed in git status.

