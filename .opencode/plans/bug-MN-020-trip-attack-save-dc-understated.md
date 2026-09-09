# MN-020 Trip Attack — FAIL (save DC understated; core trigger/die/damage/prone verified)

**Row:** MN-020 Trip Attack (maneuver, Fighter, attack_rider / weapon_attack_hit / superiority_die)
**Host:** EvasiveFighter lv18 2024 (converted Psi Warrior → **Battle Master** via Edit wizard, disk-confirmed), Superior Technique style retained; EB Thug 1 (Medium humanoid, STR +2) + Knight 1 (Medium, AC 18) in test-campaign combat.
**Date:** 2026-09-09

## Verified PASS live (evidence via self-issued curl + trusted clicks)
- **Offer gated to hits only:** pipeline `AttackRiderManeuverPrompt` ("Battle Master — Attack Rider Maneuver — Trip Attack — adds superiority die to damage — STR save") AND poller `CombatSuperiorityModal` ("Combat Superiority — Use Maneuver") both fired after HIT Done. MISS control: "✗ MISS (14 vs AC 18)" → **no offer modal, no save prompt, supDice unchanged (3→3), Knight hp unchanged (46)** (`attackRollRiders.js:18`, `combatSuperiorityQueries.js:58-81` hit===true gates, MN-018 family).
- **Die spend exactly 1/trigger (DELTA):** Superior Technique host 1→0 (d6); BM run 6→5→4, post-short-rest 6→5. First use each round rolls free **d8 "(Relentless)"** with no die spend (BM lv18 app feature, CLA-286 shape) — judge by delta per playbook 43b.
- **Die added to damage:** real damage rolls `formula "1d6+3 [slashing] + 4 [slashing]" rolls [5,4] total 12` hp 32→20; `+8 [slashing]` hp 20→3; `+5` on Knight (52→46, 46→38) with hp_change rows each time.
- **STR save at correct ability, outcome-gated:** save_result logs `Thug 1 succeeded STR save`, `Knight 1 failed STR save (DC 14, rolled 3 +3 = 6)`; success branch wrote NO prone (twice: Thug DC10 nat20, Knight DC10 7+3=10).
- **Prone on fail:** `change-data['Knight 1'].activeConditions=["prone"]`, `activeConditionMeta.prone={dc:14, ability:"STR"}`, initiative-card badge `creature-badge effect-condition "Prone DC 14"` (title "… DC 14 STR") + remove ×; popup "Knight 1 fell Prone." (`combatSuperiorityUtils.js:189-192` producer).
- **Size gate consulted:** `validateSizeLimit` large_or_smaller (`executeManeuver.js:446-482`); Medium targets passed (Huge refusal not re-probed — proven MN-015 family).

## FAIL clause — save DC is wrong (not "correct DC")
Canonical & app-displayed BM text: "Saving Throw DC = 8 + Strength/Dexterity modifier + Proficiency Bonus" → **8 + 3 (STR, sheet shows +3: +9 to hit, 1d6+3 dmg) + 6 (PB) = 17**. Live prompts offered **DC 14** (pipeline rider leg) and **DC 10** (style/poller legs).

### Root cause seams (grep-proved)
1. **Info-builder bakes numeric DC from pre-computed abilities:** `automationInfoBuilder/combatSuperiority.js:45-49` computes `saveDc` numerically at build time; live fiber `playerStats.automation.specialActions[combat_superiority]` carries baked **saveDc:14** (= 8 + STR-mod-read-as-0 + PB 6), while `playerStats.abilities[].bonus` is +3 post-compute. The build pass runs against raw `{baseScore, featIncrease…}` entries with no `.bonus`.
2. **Pipeline forwards the baked number, disabling runtime recompute:** `useAttackDamageResolution.js:331` `saveDc: superiorityInfo?.saveDc ?? 'ability'` — 14 is truthy, so `buildSaveDc` returns the literal 14 (`savePrompt.js:27`) instead of resolving 'ability' → 17.
3. **Style grant has no saveDc at all (FS-010 residual):** `rules-fightingStyles.js:199-218` Superior Technique automation lacks `saveDc`/`saveAbility`; builder takes `auto.saveDc || 10` → DC 10 (observed on the first, pre-conversion trigger; console-error fallback also seen on the poller leg).
4. **Log asymmetry (secondary gap):** pipeline leg `executeAttackRiderManeuver` ability_use log omits the save/prone text ("Trip Attack: Rolled d12 for N. Added N to the damage roll." — `executeAttackRider.js:246-264` builds its own logEntry ignoring the accumulated save description); poller leg `executeManeuver` logs it fully ("Target made STR save DC 10: Success."). The campaign-wide audit trail for PRONE therefore depends on which leg fired.

## Fix recipe
- Add `"saveDc":"ability","saveAbility":["STR","DEX"]` to the Superior Technique grant in `rules-fightingStyles.js` (mirror classes.json BM major `[4]/majors[0]/features[0]/automation`).
- In `automationInfoBuilder/combatSuperiority.js`, DO NOT bake numeric DC into the runtime automation object (keep the `'ability'` token) or compute it from post-computed `playerStats.abilities[].bonus` after rulesFactory folds feats — the baked value is what poisons `buildSaveDc` downstream (CLA-342 data-fix precedent).
- `executeAttackRider.js` damageBonus return should carry the full accumulated `description` (incl. save result + "fell Prone") into its logEntry.

## Residual accepted (not defects of MN-020)
- Thug died on the nat-20 crit swing whose trip save failed → prone landed on a 0-HP corpse (state wrote correctly; visual check done on Knight instead).
- Ghost promptId of the cleared Thug lingers in `pendingSavePrompts` (42h family).
- `+9` attack row carries studied-attacks "Adv (conditions)" from earlier misses — irrelevant to rider gates.

## Verdict
**FAIL** — trigger, die-spend, damage-join, STR-save mechanics, once-per-hit and miss/size gates are all live-verified, but the save DC (14/10 vs canonical 17) violates the "must succeed on a Strength saving throw [at the correct DC]" clause and contradicts the app's own printed feature text. All other clauses pass.
