# BUG CLA-011 — Arcane Recovery: once-per-long-rest gate inert + inverted

**Verdict:** FAIL (recovery/budget halves live-exact; gate clause live-broken, proven both directions)
**Date:** 2026-10-01 | **Host:** DivinationWizard lv20 2024 Wizard (Abjurer), test-campaign
**Automation:** CLA-011 Arcane Recovery | classFeature | trigger short_rest; passive

## Expected (task + app's own feature text)
Choose expended slots, combined level ≤ ceil(lv/2)=10, none ≥6; **once used, can't again until a Long Rest** (2024). Data carries this: 2024 classes.json Wizard lv1 passive `{type:'resource_restoration', resourceKey:'arcaneRecoveryLevels', uses_max:1, recharge:'long_rest', maxSlotLevel:5}`.

## Live evidence (change-data GET truth)
Baseline: lv1-9 slots full, runtime `arcaneRecoveryLevels=10`.

**Working half (PASS):**
- Burn via casts: Web ×3 → lv2 3→2→1→0; Stinking Cloud ×2 → lv3 3→2→1 (expended 12 levels).
- Short Rest modal → "Arcane Recovery" section + enabled "Recover Spell Slots" button; click → stamp "Arcane Recovery applied" → Complete.
- Restore GET: lv2 0→**3**, lv3 1→**2** (+9 levels). Budget cap live-enforced: 12 expended, only 9 regained — lv3 stayed short (budget 10 exhausted; 10−9=1 < slot lv3). lv6-9 untouched.
- Log: `short_rest` — "DivinationWizard takes a short rest. | Hit Dice: 0 used | Resources restored: Arcane Recovery".

**FAIL legs:**
1. **No once-per-long-rest consumption.** After AR used, runtime `arcaneRecoveryLevels` stays 10 (grep: zero production writers decrement it — recoverArcaneSlots ShortRestModal.jsx:15-30 and addArcaneRecoveryUpdates restRules-shortRest.js:140 write only `spell_slots_level_*`; `uses_max:1`/`recharge:'long_rest'` data fields have zero consumers). Same-cycle second Short Rest: section re-offered, button enabled, second click regained lv2 2→3 again (double-dip live-proven).
2. **Gate inverted after Long Rest.** Long Rest nulls `arcaneRecoveryLevels` (LONG_REST_RESOURCES restRules-constants.js:112) but availability test ShortRestModal.jsx:186 `arcaneRecoveryCur !== null && !== 0` → null counts UNavailable. Post-LR short rest modal: **Arcane Recovery section ABSENT** (sections = Hit Dice, Resources Restored, Memorize Spell only). Feature is usable exactly once ever (until the manual "Arcane Recovery Levels" sheet tracker, CharClassFeatures.jsx:812, is hand-entered).
3. Spec deviation: not a "choose expended spell slots" picker — single-button auto-allocation (ascending lv1→5). Over-budget/lvl6 "selection" refusal untestable by UI; enforced structurally (slotLevels=[1,2,3,4,5] hardcoded ShortRestModal.jsx:19 + restRules-shortRest.js).
4. Auto-path: applyShortRest without skipAutoRecovery (restRules-shortRest.js:391-393) auto-recovers AR on ANY short rest, ungated, no user request, no log detail of regained slots.

## Fix hints
- Consume on use: in recoverArcaneSlots / addArcaneRecoveryUpdates, decrement `arcaneRecoveryLevels` by regained levels (or set 0) and gate availability on it; LONG_REST reset should restore **max** (ceil(lv/2) / class_specific.arcane_recovery_levels), not null — or gate must treat null as full.
- Respect uses_max/recharge from data instead of hardcoding.

## Cleanup
Runtime + log admin-cleared (POST admin/clear-log + admin/clear-change-data → GET []/{}); Long Rest normalized slots pre-clear. Disk character untouched.
