# bug-FS-011 — Thrown Weapon Fighting inert on 2024 rules hosts

**Verdict:** FAIL (unimplemented on assigned ruleset path — grep + live probe)
**Date:** 2026-09-08 | **Host:** EvasiveFighter lv18 Fighter, rules=2024 (Battle Master)

## Canonical / app data
- App canonical text: `public/data/fighting-styles.json` → "Thrown Weapon Fighting": "You can treat any short sword that you hold with one hand as if it had the thrown property… When you make a ranged attack roll with a thrown weapon, you add your proficiency bonus to the attack roll." (this is the 2014 wording; manifest FS-011 expectedBehavior matches).
- `public/data/2024/classes.json` Fighter fighting_style feature_specific = `{count:1}` only — NO option text in the 2024 data path (divergence noted; task's "2024 adds PB to thrown ranged rolls" wording exists nowhere in app JSON).

## Consumers (grep evidence)
- `src/services/rules/core/attackCalc.js:242,262,288,323,366-392` — FULL 5e implementation: thrown ranged weapons get `extraHitBonus = proficiency` stacked on the normal `abilityBonus + proficiency` (would double-prof to +12 at lv18), plus a thrown Shortsword Action row grant (`extraHitBonusLabel: 'Thrown Weapon Fighting (Proficiency)'`).
- `src/services/rules/rules-fightingStyles.js:119-136` — specialAction/passive_rule grant is **5e-gated** (`if (!is2024(playerStats, null))`).
- `src/services/rules/core/attackCalc2024.js` — **ZERO** Thrown Weapon Fighting branch (fightingStyles2024 consulted only for Archery/Dueling/Two-Weapon/Blessed/Druidic). No thrown Shortsword row grant, no thrown PB.
- `automationPassives.js:370 hasThrownWeaponFighting` — re-exported by automationService.js:8 but has ZERO pipeline callers.
- Dispatch: `rules-core.js:65-69` routes rules=2024 → `getAttacks2024` exclusively. EvasiveFighter is rules=2024 → feature unreachable.
- Manifest handler/router/infoBuilder paths (fightingStyleHandler/Router/InfoBuilder) are fictitious (§ house rules).

## Live probe (localhost:5173)
- Baseline grid (before): Shortbow 80ft **+6** (DEX+0+PB6, ammunition — correctly NOT thrown), Scimitar melee +7, Unarmed +7, Shortsword **Bonus Action melee row +7 only** — no thrown row.
- Edit wizard step 7 "Languages & Fighting Styles": ticked Thrown Weapon Fighting ("2 of 1 allowed", warn-only), ✓Save → disk-confirmed `class.fightingStyles: ['Superior Technique','Thrown Weapon Fighting']`, `specialActions: []` (5e gate proven live).
- Hard reload post-grant: sheet header shows "Fighting Styles: Superior Technique, Thrown Weapon Fighting" but attack grid is BYTE-IDENTICAL to baseline — no thrown Shortsword row, no PB anywhere. Delta = zero. (a) FAIL, (b) N/A (no Handaxe/Dagger on sheet), (c) melee control unchanged (by accident, not enforcement), (d) before/after delta is the control.

## Fix recipe (suggested)
Add a Thrown Weapon Fighting branch to `attackCalc2024.js` mirroring `attackCalc.js:242/366-392` (thrown-property ranged weapons + one-handed Shortsword thrown grant) — but FIRST resolve the double-PB semantics: 2024 attacks already fold PB into the roll, so a literal "add your proficiency bonus" second stack yields +12; canonical 2024 styling likely intends the grant row + mastery only. Also un-gate `rules-fightingStyles.js:119` if the specialAction row should appear for 2024.
