# Bug — CLA-145 Font of Inspiration: Short Rest logs restore but never restores Bardic Inspiration uses

## Overview
CLA-145 Font of Inspiration (Bard lv17 passive; 2024 data: Bard class_feature lv5, `automation.type: "font_of_inspiration"`). Verified E2E on HeroesFeastBard (Bard / College of Glamour / lv20 / rules 2024) in **test-campaign** via Playwright UI at localhost:5173.

The **spell-slot → Bardic Inspiration conversion lane WORKS exactly** (handler live, machine-truth verified). The **short-rest restore lane is BROKEN**: the Short Rest modal logs "Resources restored: Bardic Inspiration (Font of Inspiration)" and shows a static "✓ Font of Inspiration applied on short rest", but **never writes `bardicInspirationUses`** — runtime stays 0/5 after completing the rest. Per mission rules ("Short Rest does NOT restore = FAIL") → FAIL.

## Expected Behavior (canonical app-data wording, public/data/2024/classes.json Bard lv5 feature)
> "You now regain all your expended uses of Bardic Inspiration when you finish a Short or Long Rest. In addition, you can expend a spell slot (no action required) to regain one expended use of Bardic Inspiration."

## Actual Behavior
- Short Rest (sheet "Short Rest" → modal → "Complete Short Rest"): UI stayed **0/5**; change-data `HeroesFeastBard.bardicInspirationUses = 0` 15+s after rest; log: `short_rest | HeroesFeastBard takes a short rest. | Hit Dice: 0 used | Resources restored: Bardic Inspiration (Font of Inspiration)` — a FALSE claim, no state write.
- Spell-slot conversion (click `b.clickable` "Font of Inspiration:" on sheet): **EXACT** — change-data `bardicInspirationUses 0→1`, `spell_slots_level_1 4→3`; log: `ability_use | HeroesFeastBard used Font of Inspiration: expended a level 1 spell slot to regain 1 Bardic Inspiration use.`
- Long Rest control: restores all — `spell_slots_level_1 3→4`, `bardicInspirationUses` key cleared (null reset → sheet shows 5/5); log `long_rest | Resources restored: All hit dice restored, All spell slots restored`. ✓

## Steps to Reproduce
1. test-campaign → HeroesFeastBard sheet (CHA +5 → BI max 5).
2. Set "Bardic Inspiration Uses" tracked input to 0 (POSTs runtime; machine truth 0/5).
3. Click "Short Rest" → modal shows "Regain 5 expended Bardic Inspiration uses / ✓ Font of Inspiration applied on short rest" → click "Complete Short Rest".
4. Observe: sheet still 0/5; GET /api/campaigns/test-campaign/change-data → `bardicInspirationUses: 0`. Bug.
5. (Working lane) Click "Font of Inspiration:" → popup "Expended a level 1 spell slot. Bardic Inspiration uses: 1/5"; change-data confirms.

## Likely Location
- `src/components/char-sheet/ShortRestModal.jsx:713` — `handleComplete` calls `applyShortRest(playerStats, campaignName, { skipAutoRecovery: true })`, which **skips** `addFontOfInspirationUpdates` (guarded by `if (!skipAutoRecovery)` at `src/services/rules/effects/restRules-shortRest.js:429-432`).
- `src/components/char-sheet/ShortRestModal.jsx:317-327` — `FontOfInspirationSection` renders a static `<span className="short-rest-applied">✓ applied` with **no request state and no write** (unlike Sorcerous/Arcane/Natural sections which have onRequest/selection plumbing consumed by `applyRequestedRestorations`).
- `src/components/char-sheet/ShortRestModal.jsx:124` — unconditionally pushes the "restored" log label whenever `hasFontOfInspiration`, regardless of any actual write.
- Fix direction: in `handleComplete`, write `bardicInspirationUses = maxBI` (or call `addFontOfInspirationUpdates` outside the skipAutoRecovery gate); gate the log label on the write.
- Stale manifest paths in mission row (actual files differ): handler is `src/services/automation/handlers/class-bard/fontOfInspirationHandler.js` (not `src/services/combat/automation/handlers/...`); dispatch table `src/services/automation/index.js:366`.

## Notes
- Runtime `playerStats.automation.passives` DOES contain `font_of_inspiration` (modal section and gates render) even though the on-disk character JSON stores automation empty — derivation works; the defect is purely the missing write on short rest.
- `restRules-shortRest.js` `addFontOfInspirationUpdates` (line 127) is correct in isolation but dead in the UI path due to `skipAutoRecovery:true`; only reachable via non-modal short-rest callers (none found in UI).
- Control evidence: shortRestHitDice/currentHitPoints writes from the same `handleComplete` DID land (change-data had `shortRestHitDice: 20`) — the POST path works; BI simply was never included.
