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
