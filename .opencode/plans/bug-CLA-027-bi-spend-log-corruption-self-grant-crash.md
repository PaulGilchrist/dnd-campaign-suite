# CLA-027 Bardic Inspiration — spend log corruption + self-grant pool corruption/sheet crash

## Overview
Base Bardic Inspiration (2024, HeroesFeastBard lv20 Valor) grant lane and rest/gate economy work exactly. Two live-seam defects:
1. (a) Holder ability-check spend: popup math is exact (19→21) but the `ability_use` log corrupts the amended total and die metadata — records die-SIZE as the die value and string-concatenates the total ("19 → 1912").
2. (b) Self-grant (allowed by picker) clobbers the bard's numeric `bardicInspirationUses` pool with an object `{current:1,max:1}` (decrement lost) and crashes the character sheet render (React root wiped).

## Expected (app-data quote — public/data/2024/classes.json Bard lv1 feature, die per lv20 `bardic_die: 12`)
> "Up to three times per day, you can add one of your Bardic Inspiration dice to one ability check made by one other creature of your choice. You can do so when any creature (including yourself) makes an ability check... Your Bardic Inspiration die is a d6." (d12 at lv20 per `class_levels[19].bardic_die: 12`; uses via `automation.uses_expression: "CHA modifier"` = 5 at CHA 20.)

Log convention (§SP-001 twin): spend must log rolled die value and adjusted total exactly, "A → B".

## Actual
1. Spend log (live, Insight roll d20=10, +9, BI d12 rolled 2, popup total 21):
   `FeyRanger used Bardic Inspiration (1dd6): +12 to Insight (d20 10 + 9 = 19 → 1912). Inspiration granted by HeroesFeastBard.` + `dieValue:"12", dieSize:"d6"` (should be `1d12 ... 19 → 21`, dieValue 2, dieSize d12).
2. Self-grant: pool was numeric 1 → after granting to self, change-data `HeroesFeastBard.bardicInspirationUses = {"current":1,"max":1}` (no decrement to 0). Opening the bard sheet afterwards throws, full root blank:
   `Error: Objects are not valid as a React child (found: object with keys {current, max})` (screenshot .opencode/plans/CLA-027-self-grant-crash.png). Refusal-gate also bypassable while pool holds this object (Number(obj)=NaN, NaN<=0 false).

## Steps
1. test-campaign, cs seeded (14 PCs, no map). HeroesFeastBard lv20 Valor, pool 5/5 d12 displayed.
2. Bonus Actions "Bardic Inspiration:" → chooser radio FeyRanger → "Grant Inspiration" → grant OK (pool 5→4, target keys + log exact).
3. FeyRanger sheet → "Insight (+9)" span.clickable → roll popup offers "Bardic Inspiration (d12)" → click → popup "1d12 → 2 + 21" correct; Done → log corrupted (see Actual 1); `bardicInspirationDie/GrantedBy` cleared, badges cleared.
4. Grant to self (picker lists self when Valor `bardic_inspiration_combat_options` present) → pool corrupted to `{current:1,max:1}`, self-grant log written.
5. Reload, re-select campaign, open bard sheet → React crash, sheet blank (Actual 2).
6. (Post admin-clear re-run, numeric path clean): 5 ally grants 5→4→3→2→1→0 exact; click row at 0 → popup "Bardic Inspiration has no uses remaining. Recharges on a Long Rest.", zero pool/state/log delta; Long Rest → uses null-key fallback displays 5/5, long_rest log.

## Likely Location
- Spend log: `src/components/char-sheet/CharSheet.jsx:453-454` — wrapper discards popup args (`_dieValue, _dieSize`); `src/components/char-sheet/CharSheet.handlers.js:76-90 handleBardicInspiration` reads runtime `bardicInspirationDie` (die-SIZE string "12"), `modifiedTotal = originalTotal + biDie` string-concats ("19"+"12"), log hard-default `ph.dieSize || 'd6'`; caller never passes dieSize in popupHtml.
- Self-grant: `src/services/automation/handlers/class-bard/bardicInspirationHandler.js` applyBardicInspiration writes `bardicInspirationUses {current:1,max:1}` on target; when target===bard this overwrites the just-decremented numeric pool; `src/hooks/runtime/useTrackedResource.js resolveCurrent` returns raw stored value → `char-summary/TrackedResourceInput.jsx:13` renders `{current}` object as React child → crash.

## Notes
- PASS-subset mechanics: grant decrement exact (5→4→…→0 numeric, GET), grant chooser radio + explicit button (§CLA-058 shape), target die state `{die:'12', grantedBy, uses:{1,1}, options}` GET, refusal popup at 0, LR restore 5/5, badge/die consumption on spend, popup total correct, roll log `rolls:[10,2]` records BI die.
- Refusal is popup-only, no `automation`/refused log entry (CLA-006 family gap, cosmetic).
- Self-grant is RAW-consistent with app data ("including yourself") — fix the pool/crash, don't gate it.
- Cleanup: admin clear change-data + log server-verified `{}` / `[]`; registry left Valor lv20.
