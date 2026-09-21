# Bug MA-0652 — Druid "Quarterstaff" versatile two-handed clause inert (FAIL(a) / DATA)

## Expected (canonical, disk description byte-anchored)
> "Melee Weapon Attack: +2 to hit (+4 to hit with shillelagh), reach 5 ft., one target. Hit: 3 (1d6) bludgeoning damage, **or 6 (1d8 + 2) bludgeoning damage with shillelagh or if wielded with two hands**."

The versatile clause must be offered live on the HIT popup via the authored field `damage_dice_two_handed` → `buildTwoHandedVariantOffer` (MonsterCardHelpers.js:687 → useLoggedDiceRollAttack.js:258) — the LIVE seam proven by twins Azer Warhammer `damage_dice_two_handed:"1d10 + 3"` and Drider Longsword MA-0636 (both disk-confirmed this session; §163/§168).

## Actual
- Disk `public/data/monsters.json` druid actions[0]: attack_bonus 2, damage_dice_primary "1d6", damage_type_primary bludgeoning, reach "5 ft." — **NO `damage_dice_two_handed`**, no shillelagh structure, no secondary.
- Live: BASE route exact — "+2" chip renders (not suppressed, §116), 5/5 attacks logged `bonus:2` (nat 15/17/12/11/18; totals 17/19/14/13/20 vs AC 12), 4/4 confirmed hits each ONE `roll damage` formula **"1d6"**, `finalDamage == |hp_change|` unclamped (6→993, 2→991, 3→988, 3→985 with Bandit maxHp staged 999 via full-store cs POST), `damageType:"bludgeoning"`, `secondary` keys `{}` (§185 shape).
- **Two-hands variant never offered**: HIT popups carried only Done ("d20 N +2 (+2 to hit) ✓ HIT (X vs AC 12) Done"). Toggle audit: card overlay AND every hit popup `[role=switch]/[role=radiogroup]/[role=tablist]` count = **0**. Log grep "1d8" = **0**.
- Honest miss boundary: nat 7 +2 = 9 vs AC12 → ✗ MISS popup, no Done, zero damage entry, zero hp_change.

## Steps to reproduce
1. test-campaign → Encounters → search "Druid" (check) → search "Bandit" (check) → Join Encounter. Stage Bandit maxHp/currentHp 999 via POST /combatSummary {value:fullCs}.
2. Initiative → arm Bandit 1 on Druid 1's OWN card `[data-testid="target-select"]` → open Druid card → click Quarterstaff "+2" chip.
3. Roll repeatedly, click Done on every HIT popup: damage always "1d6"; the two-hands 1d8+2 chooser NEVER appears (popup toggles 0).

## Likely Location / Fix
`public/data/monsters.json` → druid actions[0] — one-field DATA fix: `damage_dice_two_handed: "1d8 + 2"` (exact MA-0636/§168 Azer/Drider placement). No code change — seam is live.

## Notes
- Shillelagh conditional (+4 to hit / damage swap): MA-0007 `conditional_damage` template UNAUTHORED on this row and no shillelagh-specific seam app-wide → §70-class zero-consumer **advisory only**, do NOT build without a ticket. NOT the primary defect.
- Base numerics (+2 / 1d6 / bludgeoning / reach 5) verified EXACT — verdict FAIL is solely the unauthored versatile field on a seam-live row (§163 precedent MA-0636; ~17 sibling versatile rows same family).
- VERIFIED: FAIL (FAIL(a)/DATA, one-field).
