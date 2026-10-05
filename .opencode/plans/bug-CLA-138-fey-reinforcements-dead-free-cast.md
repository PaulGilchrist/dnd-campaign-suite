# Bug CLA-138 — Fey Reinforcements: free-cast latch self-blocks (arm sets 0, auth demands >0) + no-concentration option never propagates

## Title
Fey Reinforcements (Fey Wanderer): the free-cast path is structurally dead — activation stamps `_Fey_Reinforcements_freeCastCount=0`, but cast-time checkFreeCastEntry requires the SAME key `>0`, so a slot is still consumed despite the "no spell slot will be consumed" popup; and the declared no-concentration option is cosmetic — the checkbox never propagates to runtime, concentration is always stamped.

## Overview
Verified 2026-10-04, test-campaign, host FeyRanger lv17 2024 (native subclass; Summon Fey already on disk known-spells masking prepared-injection — advisory).

## Expected Behavior (data-declared)
Summon Fey always prepared (no material); 1× free until Long Rest; option to drop concentration (duration→1 min).

## Actual Behavior
1. FAIL(a) free-cast dead latch: activation stamps `_Fey_Reinforcements_freeCastCount=0` (feyReinforcementsHandler.js:55-56 GET); spellPreparationService.checkFreeCastEntry requires same latch `>0` → auth always false post-arm; popup promises "no spell slot will be consumed" yet `spell_slots_level_4 3→2` GET + log "casts Summon Fey (slot level 4)".
2. FAIL(b) no-concentration cosmetic: checkbox + popup text fine; grep sole runtime consumer summonSpiritHandler reads spell-DB `auto.noConcentration`=false; no write path → caster stamped `concentration:{spell:'Summon Fey'}` even when checked — decisive GET.
3. PASS-side: LR recharge works (latch ∈ LONG_REST_RESOURCES:190; live LR → latch null, handler `?? usesMax` re-arms, lv4 restored); 2nd activation refused "No free casts remaining"; multi-variant picker Trickster/Warrior/Guide spawns; Trickster AC 12 HP 30 at lv4 = monsters.json ladder (+10/slot; flat AC data-correct — no §SP-047 defect).
4. Always-prepared: lane exists spellCalc2024.js:302 (`prepared:'Always'`) but masked by disk spells[] — grep-advisory.

## Steps to Reproduce
1. lv17 Fey Wanderer; activate Fey Reinforcements row → cast Summon Fey lv4 → slot consumed despite popup (bug a); tick "no concentration" → concentration still stamped (bug b).

## Likely Location
- `feyReinforcementsHandler.js:55-56` — stamp should set uses COUNT (`=usesMax`, decrement at cast) not 0; or cast-auth should read arm-flag separately (match CLA-133 working shape: latch counts down from uses).
- no-concentration: runtime write + summonSpiritHandler honoring runtime flag; remove popup-only payload.

## Notes
- Family recipe: grep co-occurrence of `_<Feature>_freeCastCount` arm-vs-auth before live-testing — arm-0 + auth->0 = guaranteed dead, no clicks needed.
- Admin cleared, GET-empty. Verified 2026-10-04.
