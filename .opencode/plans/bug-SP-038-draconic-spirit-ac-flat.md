# Bug SP-038 — Draconic Spirit: AC does not scale with spell slot level

## Title
Draconic Spirit (summon_spirit, lv6): spawned AC is flat 14 instead of 14 + spell slot level.

## Overview
SP-038 verified PASS on every axis EXCEPT Armor Class. The CAST-path summon spawns with correct HP ladder, speeds, merged to-hit, concentration economy, and purge — but its AC stays flat 14 at both lv5 and lv6 casts. Root cause is a one-field DATA omission: the opt-in flag `armor_class_scales_with_slot: true` exists on the bestial-spirit-* blocks but is absent from the Draconic Spirit summon block, and the handler gate at `summonSpiritHandler.js:140` only applies the 14+slot ladder when that flag is present.

## Expected Behavior
Canonical/manifest: "A Large Dragon spirit ... The spirit has AC 14 + the spell's level." → lv5 cast AC 19, lv6 cast AC 20.

## Actual Behavior
- lv5 cast: AC **14** (expected 19)
- lv6 upcast: AC **14** (expected 20)
- All other legs PASS-exact: name/init 11.9 = caster−0.1; HP 50 base, lv6 HP 60 (50+10×(slot−5) formula exact); Speed "walk 30 ft., fly 60 ft., swim 30 ft." byte-match; lv5 slot 3→2 and lv6 2→1 honest ledger; cs.concentration {dc:19}; te {summoned/concentration}; merged chip "+11" = caster toHit (nat7+11=18 HIT vs Bandit AC12, damage 1d6+4+5=10, hp_change −10 == fd); Rend re-folds "1d6+4+6" on upcast; concentration break LIVE (cnp DC10 ×8 prompts, War Caster advantage 2d20, fail → spirit purged server-side, cs gone, conc null, te [], "summons ... ends" log; duplicate ability_use ×2 cosmetic).

## Steps to Reproduce
1. localhost:5173, test-campaign, DivinationWizard lv20 (spellbook has Draconic Spirit — added permanently step-14 during verification).
2. Cast Draconic Spirit into initiative (single variant = auto-cast popup, no chooser).
3. Read spawned combatant card / combatSummary: AC shows 14.
4. Upcast to lv6 (radio arms — SP-015 summonHpLadder fix makes selector reachable): AC still 14, HP correctly 60.

## Likely Location
- `summonSpiritHandler.js:140` — ladder gate requires `armor_class_scales_with_slot:true`.
- DATA fix: add `"armor_class_scales_with_slot": true` to the Draconic Spirit summon block in `public/data/2024/spells.json` (flag exists only on bestial-spirit-* blocks today). Byte-twin of bestial-spirit rows.

## Notes
- EB-direct-joined flat Draconic Spirit zero-affordance is BY DESIGN (MA-0286) — not part of this bug; judged on CAST path only.
- Cosmetic: duplicate ability_use ×2 on concentration-break end.
- Range/unoccupied-space gates grep-zero (gridless lenient §42/§70 advisory).
- Verified 2026-10-04 by orchestrator subagent; registry rows updated (monsters: Draconic Spirit ledger; characters: DivinationWizard spellbook 52→53 PERMANENT).
