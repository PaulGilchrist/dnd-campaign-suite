# Bug FT-035 — Fey Touched: Misty Step never prepared + Long-Rest free-cast rearm on dead key

## Title
Fey Touched feat: chosen-spell prepared injection + free-cast badge + normal-slot fallback work, but (a) Misty Step NEVER appears as a prepared row/affordance (injection lane is wizard-only), and (b) the long-rest rearm resets `_feyTouchedSpell_freeCastCount` while the live latch written at cast time is `_Fey_Magic_freeCastCount` — dead-key mismatch, free use never returns.

## Overview
Verified 2026-10-04, test-campaign. Created **FeyNewTest** lv4 2024 Hill Dwarf Battle Master Fighter (origin feat lane: lv1 origin slots=0 + background locked Savage Attacker → set Level=4 step-2, tick feat `.list-item-checkbox`; ASI chooser `select.bg-ability-select`; FeyTouchedModal auto-opens at Spells step).

## Expected Behavior (feats.json:1238)
+1 ability; choose lv1 Divination/Enchantment spell; BOTH chosen spell and Misty Step always prepared; each free 1× until Long Rest; slot-casting also allowed.

## Actual Behavior
1. PASS: feats stored `["Savage Attacker","Fey Touched"]`, `feyTouchedSpell:"Detect Magic"`; CHA 8→9 featIncrease:1 via ASI chooser live.
2. PASS: chosen spell row + free badge "Free Cast — no spell slot consumed", latch `_Fey_Magic_freeCastCount:0` stamped, slot 3/3 unchanged; 2nd cast badge gone → slot consumed normally (fallback lane OK).
3. FAIL(a): **Misty Step never renders** — no spell row, no special-action row post-reload. getPreSelectedSpells.js:142 lane is wizard-only (useWizardSpells.js); feats.json `free_spell spell:["Misty Step"]` automation never converts to sheet row for non-wizards → free-cast of Misty Step untestable (injection absent).
4. FAIL(b) LR rearm (CLA-130 twin, grep-decisive): cast writer `spellCastHandler.js:191` `_${action.name}_freeCastCount` = `_Fey_Magic_freeCastCount`; restRules-longRest.js:676 resets DEAD key `_feyTouchedSpell_freeCastCount`; FT-070 loop :587 needs perSpellTracking (absent on rules.js:299 injection). Live post-LR: dead key null-stamped, live latch stayed 0, free badge never returned.

## Steps to Reproduce
1. lv4 char with Fey Touched; cast chosen spell free, spent; Long Rest → reopen: no free badge.
2. Check sheet for Misty Step row anywhere: absent.

## Likely Location
- `restRules-longRest.js:676` — reset `_Fey_Magic_freeCastCount` (match spellCastHandler.js:191 writer); or unify latch naming family audit (FT-070 Shadow Touched fixed at :567 — same pattern).
- Prepared-injection: extend getPreSelectedSpells/feat free_spell row builder so `spell:["Misty Step"]` from feat automation surfaces on non-wizard sheets.

## Notes
- App quirk: 2024 Fighter HAS spell slots here (lv3=2, lv4=3 lv1) — verify base from class_levels before slot-math claims. Faerie Fire absent from 2024 lv1 Div/Ench picker (use Detect Magic/Bless).
- FeyNewTest left in place (see registry). Admin cleared, GET-empty. Verified 2026-10-04.
