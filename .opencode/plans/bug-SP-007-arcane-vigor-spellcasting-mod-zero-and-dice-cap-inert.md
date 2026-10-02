# Bug SP-007 — Arcane Vigor: spellcasting modifier dropped (+0), lv2 dice cap inert, lv3 upcast burns slot at base 2-dice

**ID:** SP-007 | **Automation:** `arcane_vigor` | **Ruleset:** 2024 | **Date:** 2026-10-01
**Host:** DivinationWizard (lv20 Wizard/Abjurer, INT 20 → +5, d6 hit dice, spell DC 19)
**Verdict:** FAIL (3 defects; heal math wrong on EVERY cast)

## Overview
E2E via sheet Bonus Actions row (`div.clickable` damage cell "2 short rest dice") and Spells-table name popup. Cast lane, slot payment, hit-dice pool accounting and logging all work — but (1) the healing amount NEVER includes the spellcasting ability modifier (`abilityModifier: 0` on every cast/log despite INT +5); (2) the lv2 "roll one or two" cap is unenforced (Roll One is an unbounded accumulator gated only by pool size — 3+ dice rolled AND consumed on a lv2 cast); (3) lv3 upcast burns the lv3 slot but the modal silently caps at "up to 2 dice allowed" and logs `spellLevel: 2` (FAIL(a)-style slot burn, per SP-127 precedent).

## Expected (canonical, public/data/2024/spells.json arcane-vigor)
- Heal = roll total of **1 or 2** unexpended Hit Dice **+ spellcasting ability modifier** (here INT **+5**). Those dice are expended.
- Upcast: unexpended-HD rollable count **+1 per slot level above 2** (lv3 → up to **3** dice).
- Pool/HP/log: `shortRestHitDice` −N, `currentHitPoints` +N clamped at max, spell + `hp_change` logs.

## Actual (live, GET change-data/log truth)
1. **Modifier +0 on every cast.** Modal header "regain HP equal to the roll total + 0 (INT modifier)"; spell log `"abilityModifier": 0, "healing": 1` with `rollTotal: 1`; `hp_change` `"formula": "1d6 + 0"`. INT is correctly identified (display "(INT modifier)") but the bonus resolves 0. Host INT +5 proven (sheet Save DC 19 = 8+5+6).
2. **lv2 cap inert.** Modal text "up to 2 dice allowed" but a 3rd Roll One click was accepted and APPLIED: log `diceRolled: 3, healing: 10, formula "3d6 + 0", spellLevel: 2`, pool −3. No radio 1-vs-2 chooser exists — free accumulator; only pool size gates, diceCount never consulted in `handleRollDie`.
3. **lv3 upcast → base-2 cap with slot burn.** Upcast popup radio Level 3 → Cast: `spell_slots_level_3 3→2` burned, generic cast log `spellLevel: 3`, but modal still "up to 2 dice allowed" and modal spell log `spellLevel: 2`. Canonical lv3 = up to 3 dice.

Working halves (PASS evidence): lv2 cast pool −1/−2 exact (`20→19→17→14`), slot lv2 3→2→1→0 paid, HP +exact-dice-total (`currentHitPoints 20→21→26→36`), spell+`hp_change` logs each apply, pool exhaustion refusal exact (`"0 of 0 remaining"`, Roll+Apply disabled, zero-spend), upcast radio lv2 disabled at 0 slots (slot-aware popup), cancel mid-cast consumes nothing.

## Steps
1. test-campaign, host DivinationWizard lv20 Abjurer; rig HP down (GM initiative-card `input[aria-label="DivinationWizard current HP"]` fill 20 + Enter — trusted; writes runtime currentHitPoints and full tracked-store).
2. Hydrate `activeConditions` first (own-card `.effect-add-btn` → Deafened → Apply) — else `executeSpellCast` throws "activeConditions must be an array for caster" AFTER slot burn (SP-002 seam, live).
3. Cast lv2: sheet Bonus Actions row damage cell → ArcaneVigorModal → Roll One → Apply → log shows +0 mod (defect 1).
4. Cast lv2 again → Roll One ×3 → Apply → modal accepts 3rd die, pool −3 at lv2 (defect 2).
5. Name-cell popup → radio "Level 3" → Cast Spell → modal header still "up to 2 dice allowed"; GET `spell_slots_level_3` −1 (defect 3).
6. Roll 14 dice in one cast → "0 of 14 remaining" → Roll disabled; Apply consumes all; next cast: "0 of 0", Roll/Apply disabled (refusal works).

## Likely Location
- **Defect 1:** `src/services/automation/handlers/spells/arcaneVigorHandler.js:29-31` — `spellAbilities.spellcasting_ability` yields shorthand `'INT'`; `playerStats.abilities[].name` carries full names (`"Intelligence"` disk dump) → `find(a => a.name === 'INT')` → undefined → `modifier || 0`. (CLA-304 searing-vengeance "CHA dropped" family.)
- **Defect 2:** `src/components/char-sheet/ArcaneVigorModal.jsx:17-22,101` — `handleRollDie`/button gate only on `availableHitDice` (pool − rolled); `diceCount` prop never enforced.
- **Defect 3:** upcast level is set on the SPELL object (`SpellDetailPopup.handleCast` → `spell.upcastLevel`) and consumed by `prepareSpellCast` (`spellPreparationService.js:809-828`) for slot payment, but `handleGenericAutomation` passes only `{...metaCtx}` (`execution/triggerSpells.js:453-461`) which carries no `slotLevel/upcastLevel/modifiedSpell`; `resolveSlotLevel` (arcaneVigorHandler.js:3-5) then defaults to 2 → diceCount 2 + log spellLevel 2.

## Notes
- Pool default `?? diceCount` fallback (ArcaneVigorModal.jsx:14) NOT observable in practice: tracked-resources full-store sync seeds runtime `shortRestHitDice = level` (20) on sheet load, so real pool reads correct; fallback is a latent mis-default only if the key is absent at cast time.
- Empty-pool cast still burns the slot with zero dice (defect-3 path, lv3 2→1, zero heal) — RAW-debatable, record-only.
- `hp_change.maxHp: 1` every entry — cs player-placeholder max leaks into log (cosmetic, known §9 family); runtime `hitPoints: 82` is the true max; clamp at true max worked in principle (heal never exceeded, clamp path untested live at boundary).
- Abjuration cast fires no Auto-Arcane-Ward side effect here (ward only via bonus-restore row) — no collateral on ward pool (45/45 throughout).
- Runtime + log admin-cleared twice this session; final `{}` + `[]`, hard-reload quiet verified. Host restored via Long Rest (pool 20/20). DISK: `Arcane Vigor` PERMANENTLY added to spells[] (48→49) via wizard step-14 `.list-item-checkbox-trigger` + trusted Save (mi-overlay `.mi-skip` required FIRST — trusted click; synthetic skip click did NOT close it).
