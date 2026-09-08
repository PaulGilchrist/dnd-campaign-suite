# bug-CLA-356 — Telekinetic Master (Fighter / Psi Warrior lv18, 2024) FAIL

Verdict: **FAIL** — core clause (bonus-action weapon attack while concentrating) is a popup-only claim with zero attack resolution; always-prepared Telekinesis spell row never appears; concentration recorded with hardcoded fallback DC.

## Ownership (verified from app data)
- `public/data/2024/classes.json` → Fighter → majors **Psi Warrior** → features **Telekinetic Master**, **level 18** (NOT a Sorcerer feature).
- automation array (3 entries): `passive_rule/effect:always_prepared_spells [Telekinesis]`; `concentration_bonus_attack` (each_turn, bonus_action, weaponAttack:true, concentrationSpell:Telekinesis); `free_spell` spell:Telekinesis (no uses/usesMax defined).
- Manifest handler/router/infoBuilder paths (`classFeatureHandler.js` etc.) are fictitious per playbook §12.

## Real consumers (grep)
- `spellCalc2024.js:298` — always_prepared_spells branch, **gated on `playerStats.class.major.features` name match**; EvasiveFighter disk `major:null` → branch inert.
- `spellCalc2024.js:311` — free_spell branch (should inject Telekinesis Always row) — never surfaced live (see A).
- `automationRouter.js:296` — concentration_bonus_attack → bonusActions.
- `automation/index.js:397` → `handlers/combat/concentrationBonusAttackHandler.js` — writes cs concentration + ability_use log + INFO POPUP ONLY. **No attack roll, no damage, no lastAttack write, no once-per-turn latch, no concentration gate on its own re-click** (`dc = auto.dc || 10` → fallback DC 10; real caster DC is 17, INT+3 PB+6).
- `isFreeCastAuthorized` (spellPreparationService.js:77-122) free_spell scan requires `uses/usesMax/recharge` or a `_Telekinetic_Master_freeCast` runtime array — **zero producers of that key**.

## Live evidence (EvasiveFighter lv18 Psi Warrior INT17, test-campaign, 2026-09-08)
- A. Sheet (post reload): Spells grid = Cantrips Known 0, single row **Mage Hand** (from the *Telekinesis feat* already on the char — data noise). **No Telekinesis spell row anywhere** → cannot cast; no free-cast popup; `spell_slots_level_5` = 0 unchanged (nothing was ever cast — no slot evidence available by design).
- B. `b.clickable "Telekinetic Master:"` renders in the **Actions** grid (router targets Bonus Actions; rendering leak/mismatch). Click → popup "Concentrating on Telekinesis…" + `cs.concentration {spell:'Telekinesis', dc:10}` (fallback DC — gap) + 1 ability_use log. Log + cs prove the row has a live handler (not fully inert).
- C. DECISIVE: EB-joined Thug 1 in initiative, EF active turn (top-level `activeCreatureName`=EvasiveFighter), target armed Thug 1, concentration active → click "Telekinetic Master:" → **same info popup, no buttons, no attack picker, `lastAttack` unchanged (still control Shortbow), zero Thug hp_change, no new log line** (second click logs NOTHING). Weapon attack as bonus action NEVER resolves. No concentration-gated attack row exists in Bonus Actions (grid identical concentrating vs not).
- Control: same turn sheet attack cell click resolves real pipeline (Shortbow HIT 13 vs AC 11, lastAttack + `roll attack` log) — engine healthy; failure is feature-specific.

## FAIL clauses (strict exactness)
1. "Always have Telekinesis prepared" — FAIL: no spell row/injection surfaces (major-null gate at spellCalc2024.js:298; free_spell injection never rendered).
2. "Cast without spell slot" — FAIL: no cast path at all; free-cast authorization keys have no producer.
3. "Each turn while concentrating, make one weapon attack as a Bonus Action" — FAIL: popup-only claim; zero attack/damage/latch consumers (popup-only = AGENTS.md logging gap too).
4. Concentration recorded but dc fallback 10 (should be 17) — SP-107-family gap.

## Fix recipe pointers
- Drop/replace the `majorFeatureNames` gate at spellCalc2024.js:298 or give Psi Warrior a major fallback (subclass-name fallback pattern, cf. trackedResources.js:161).
- Either push Telekinesis through the free_spell injection with a `uses`-free unlimited flag consumed by `isFreeCastAuthorized` + `decrementFreeCastResource`, or stamp `_Telekinetic_Master_freeCast:['Telekinesis']` with a writer + Long-Rest re-arm.
- Make `handleConcentrationBonusAttack` gate on LIVE cs concentration (refuse+log when absent), then route a real weapon attack through the attack pipeline (arm current target, roll, damage, `ability_use` log) with a `_Telekinetic_Master_attack_usedRound` latch cleared at turn start (mirror `_Slow_Fall_usedRound` family). Use real caster saveDc for addConcentration.

## Rig state after run
- Thug removed from initiative via Admin Clear Change Data; change-data `{}`, log `[]`, server up. EvasiveFighter left lv18 Psi Warrior permanent (unchanged). FeyRanger card mis-click only wrote initiative numbers (runtime state wiped by clear; disk JSONs untouched).
