# BUG MA-1608 — Tribal Warrior / Spear (actions[0]): versatile "or 1d8 + 1 two hands" clause prose-only, chooser structurally inert

**Verdict: FAIL(a)/DATA** (§166 codified: prose-only "or N (XdY) if two hands" = inert FAIL(a), MA-0325/MA-0636 family; one-field fix)

## Overview
`public/data/monsters.json` tribal-warrior actions[0] "Spear" keys enumerate: `{name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary}` ONLY. The row's own prose promises a versatile two-handed alternative — "Hit: 4 (1d6 + 1) piercing damage, **or 5 (1d8 + 1) piercing damage if used with two hands to make a melee attack.**" — but `damage_dice_two_handed` is ABSENT (as are `damage_dice_secondary` and `damage_dice_ranged`). The live seam `buildTwoHandedVariantOffer` (src/components/encounter/MonsterCardHelpers.js:992) arms the HIT-popup chooser ONLY from `action.damage_dice_two_handed`; with the key absent it returns null (MonsterCardModal.jsx:1222 threads `twoHandedVariantOffer: buildTwoHandedVariantOffer(...)` → nothing) — every Spear hit pays 1d6 + 1 with zero GM choice, structurally.

§415 TWO-HANDED SLOT RULE adjudication: clause conjunction is alternative-die "**or** X ... if used with two hands" (NOT an additive "plus X" rider) → MUST live in `damage_dice_two_handed`; prose-only placement = FAIL(a). `damage_dice_secondary` ABSENT confirms the MA-0871/MA-1063 combined-always over-deal fingerprint is NOT present (engine never pays both pools) — this is the cleaner prose-only sibling defect of the family.

## Expected (manifest row quote, verbatim)
> "Melee or Ranged Weapon Attack: +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6 + 1) piercing damage, **or 5 (1d8 + 1) piercing damage if used with two hands to make a melee attack.**"

RAW expectation in engine terms (per §166/§104): on a HIT, the popup shows a third-stage chooser with variant buttons "Two-Handed: 1d8 + 1 piercing" vs "One-Handed: 1d6 + 1 piercing"; picked variant swaps the rolled formula; unpicked Done collapses to the one-handed default with a `one_handed_variant_selected` log (§397 — variant buttons share class `dice-roll-reroll-btn` with Done, so target Done by exact text).

## Actual (live evidence, test-campaign, dev:locked :5173, 2026-09-29)
- Spear-row chip census: exactly ONE `.mc-dice-link` "+3" (§119/§116 self-suppress correct); zero `[role=switch]/[role=radiogroup]/[role=tablist]` on the row or any popup (§166 toggle audit = proof-of-no-mode-toggle).
- 3 presses, 3/3 landed (zero §442 absorb): attack logs {nat 18, hit} / {nat 20, crit} / {nat 13, hit}; popup prints concat "total d20 nat +3" with nat = popupTotal−bonus ✓ (§popup concat); log `total` raw nat ✓ (§33: 18/20/13, bonus 3).
- **Every popup stage, every press: buttons == ["Done"] ONLY.** No "Two-Handed"/"One-Handed" variant buttons at stage-1 HIT even on the crit ("CRITICAL HIT! — DAMAGE DICE DOUBLED" stage also carries only Done). Whole-log regex `/two.?handed/gi` == **0 hits** — chooser, chooser-select log (`two_handed_variant_selected`), and `one_handed_variant_selected` default log all absent (no chooser exists to produce them).
- Damage ledger (core lane otherwise exact): formulas "1d6 + 1" (totals 7, 4), crit "1d6*2+1 (6)" = 13 doubling the PRIMARY only; `finalDamage == |hp_change|` unclamped (−7/−13/−4; Bandit 1 999→975); `damageType` "piercing" lowercase passthrough ✓ (§1262); zero save affordance/entries (saveEntries 0); breakdown {piercing, resisted:false}.
- cs rig: Bandit 1 ac12 hp999 (full-store `/combatSummary {combatSummary:cs}` POST — endpoint serves/accepts `{combatSummary:…}` shape; `{value:…}` parse was the probe error, §MA-1115 route-shape note), Tribal Warrior 1 targetName "Bandit 1" same POST; own-card selectOption armed, cs-confirmed.
- Console: 0 errors whole session.
- Secondary gaps (codified, part of fingerprint): "20/60" dual-mode band inert by construction (§150, no `damage_dice_ranged` authored; ranged prose dice inert MA-0325/0436) — noted, NOT the decisive axis.

## Steps to reproduce
1. dev:locked, http://localhost:5173, select test-campaign (header-verify).
2. EB: filter "Tribal Warrior", exact td[1] match, checkbox click, verify `input.checked`; filter "Bandit", exact "Bandit" row tick; `button:has-text("Join Encounter")` (never Save); poll combatSummary (GET returns `{combatSummary:…}` wrapper).
3. Full-store cs POST: Bandit 1 `ac:12, maxHp:999, currentHp:999, tempHp:0` + Tribal Warrior 1 `targetName:"Bandit 1"` SAME POST.
4. Reload + re-select test-campaign → Initiative → click Tribal Warrior 1 avatar → `.mc-overlay`; arm own-card target-select to "Bandit 1".
5. Press the single "+3" Spear chip; enumerate popup buttons at HIT stage and after Done — ["Done"] only, every press.
6. Whole-log grep `two.?handed` → 0.

## Likely location
- **DATA:** `public/data/monsters.json` tribal-warrior actions[0] — versatile clause never structured (`damage_dice_two_handed` absent).
- **Code lane proof (no code fix needed):** `buildTwoHandedVariantOffer` (MonsterCardHelpers.js:992-1004) early-returns null on missing variant key; consumer `MonsterCardModal.jsx:1216-1226` HIT-result threading. Live twins with the key authored render the chooser (MA-0636/0871/0959/1063/1146 verified + pinned in `MonsterCardHelpers.two-handed.test.js` family).

## Fix — one field, kuo-toa MA-1063 byte-shape twin (same +3, same "1d6 + 1", same lowercase "piercing")
```
"damage_dice_primary": "1d6 + 1",
"damage_dice_two_handed": "1d8 + 1",
"damage_type_primary": "piercing"
```
Placement: AFTER `damage_dice_primary`, BEFORE `damage_type_primary` (Azer Warhammer/drider MA-0636/hobgoblin MA-0989 byte-shape). Modifier-bearing "1d8 + 1" per prose (merfolk MA-1146 modifier-less twin shows per-prose digits). Two-handed leg rides primary type "piercing" (§871). No test pins on tribal-warrior anywhere (`grep -rn tribal src` = 0) → no pin inversion required. §415 CAUTION satisfied: row is alternative-die "or", not a "plus" rider; the orc-eye/orc-war-chief "plus 1d8" Spears are legitimate separate shapes, untouched by this fix.

## Notes / residuals
- Post-fix live expectation: chooser third stage (§104) — first Done logs variant pick + prints second Done; unpicked Done = one_handed default `one_handed_variant_selected`; backdrop-flush pre-Done silently abandons damage (§104/§871).
- Range band 20/60 stays inert-by-construction §150 (whole-app design state; even post two_handed fix, do NOT expect ranged dice-swap — no `damage_dice_ranged` seam consumer).
- Pack Tactics advantage chrome on popups cosmetic (§92): rolls:[first,second], adjudication from first die.

## Session ledger
- Baseline board clean (cs null, log 0 — MA-1607 handoff). Join noise 3 (encounter + 2 initiative) → 3 press cycles × (attack+damage+hp_change) → final log 12. Bandit 999→975 (−7, −13 crit, −4). two_handed tokens in log: 0. Console 0 errors.
- Cleanup: tab closed FIRST (§15), then admin/clear-log + admin/clear-change-data curl POST (200/200); GET-confirmed log_len 0, cs `{"value":null}`.
