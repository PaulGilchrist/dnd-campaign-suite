# FT-104 Dual Wielder — FAIL

**Verdict:** FAIL — feat grants zero observable rule-correct delta; its only live affordance is a mis-routed Flurry-of-Blows modal that multi-fires with the wrong weapon. Verified live on test-campaign (EvasiveFighter, 2024) 2026-10-04.

## Bugs

### 1. feat extra attack row never renders (shape bug) — `attackCalc2024.js:158-175`
`buildDualWielderAttack` returns `actionType:'Bonus Action'` + `toHit`; every consumer keys on `type` + `hitBonus`:
- `CharActions.jsx:474` filters `type==='Action'`
- `CharBonusActions.jsx:779-780` filters `type==='Bonus Action'`
→ the dice-only "Dual Wielder Extra Attack" (the one rule-correct artifact) is silently dropped from the sheet. Tests assert `.name` only (`attackCalc2024-nick-dual-wielder.test.js:368,373`), never `.type`, so CI is green on invisible rows.
**Fix:** return `type: 'Bonus Action'`, `hitBonus: bonus + proficiency`, `damageType`, `range: 5`, `weaponType:'melee'`, `properties`, `mastery` (match `buildWeaponAttack` shape, `attackCalc.js:124-136`).

### 2. feat row click routes to Flurry of Blows — `automation/index.js:443` → `bonusAttacksHandler.js:92-149`
Router `bonus_attacks` is the monk Flurry handler. Clicking "Enhanced Dual Wielding:" opened (live):
- "Distribute Flurry of Blows Attacks / Heightened Flurry of Blows — **3 Attacks**" (`numAttacks = auto.attacks || 3`; DW automation has `extraAttacks:1`, no `attacks`) → **multi-fire**, feat grants exactly 1.
- "Each attack is an Unarmed Strike" framing; rolls copied from `playerStats.attacks[0]` = **Shortbow +6 1d6+0 Piercing** (a ranged main-hand) — no different-weapon gate, no melee gate, no two-handed gate, no Light-first gate, no own-turn gate.
- Damage copies `attacks[0].damage` verbatim — carries whatever ability mod the first attack has (violates "no ability modifier unless negative").
**Fix:** dedicated DW handler/modal: 1 attack, off-hand melee attack (different weapon, non-Two-Handed), damage dice only (+magic bonus), own-turn + Attack-action-with-Light gate, once-per-turn latch key (e.g. `_DualWielder_UsedRound` compared to `getCurrentCombatRound`).

### 3. feat is inert for its canonical delta — `attackCalc2024.js:214`
The `hasDualWielder` block sits after the `lightMelee.length < 2` early-return. A holder wielding Light + one-handed **non-Light** (Longsword+Shortsword) gets exactly what a non-holder gets: nothing. The feat's core benefit ("two-weapon fighting even when weapons aren't Light" / extra attack with a different non-Two-Handed melee weapon) has no row, no gate branch, no live affordance.

### 4. No once-per-turn latch (confirmed live)
Second click in same turn re-opened the modal and fired again. Runtime change-data for EF contains dozens of `_X_UsedRound` latch keys but no DW writer (grep-zero in src).

### 5. Quick Draw — advisory gap
grep-zero draw/stow consumers in `src/` (only feats.json description + passive.test.js mention). No UI/rules surface. Informational; not independently blocking.

## Evidence (live, test-campaign, GET-verified after cleanup)
- CONTROL non-holder Scimitar+Shortsword: Shortsword Bonus row `+8 / 1d6+2` already present (base TWF) → pre-feat baseline == post-feat weapon rows; the only post-grant artifact was the feature-text row.
- Fired: 3 attack rolls (+6) vs Bandit AC12 (5/20/13), damage formulas `1d6+0`, `1d6+0`, multiple hp_change rows for one bonus action.
- Same-turn second activation: modal re-opened (cancelled).

## Cleanup done
DW feat grant reverted + Skill Expert restored (disk-verified); Shortbow popup-only (equipment unchanged); Admin Clear Change Data + Clear Campaign Log GET-verified empty. Console: pre-existing `findFeat` debug errors only.
