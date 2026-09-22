# BUG MA-0762 — Gas Spore "Touch": missing `attack_bonus` ⇒ attack half structurally dead (FAIL(a)/DATA)

**Row:** MA-0762 · gas-spore actions[0] "Touch" · actionType attack+save · test-campaign · 2026-09-21
**Verdict:** FAIL(a)/DATA — one-field fix `attack_bonus: 0` (MA-0647/§206 byte-twin family). Save chip itself is LIVE; disease rider = §70-class advisory (grep-proven unmodellable, documented below).

## Disk (public/data/monsters.json gas-spore actions[0], verbatim keys)
`name, description, reach, save_dc:10, save_type:"Constitution", save_effect:"The target becomes infected with the disease described in the Death Burst trait.", damage_dice_primary:"1", damage_type_primary:"Poison"`
— **`attack_bonus` ABSENT** while description carries "Melee Weapon Attack: + 0 to hit". Manifest static-check claim "attack_bonus 0" is NOT disk-true (§3 rule data is truth; §186: prose "+N to hit" has zero parser app-wide on plain weapon rows).

## Code seam (pre-diagnosis, confirmed live)
- MonsterAction.jsx:240/258 — `actionHasAttack = attack_bonus != null` → false → NO "+0" attack chip renders.
- MonsterCardHelpers.js:437 `attackRowMissingToHit` — description matches ATTACK_ROW_WORDING "Melee Weapon Attack" + null attack_bonus → true (MA-0286 honest suppression).
- MonsterAction.jsx:44 ActionDamageLinks self-suppresses (`save_dc != null` → null) → no damage chip either.
- Row degenerates to ONE affordance: "DC 10 Constitution" save chip (MonsterAction.jsx:91 armed; plan.rollable=false since canRollExpression("1")=false; plan.clickable=true via `!attack_bonus`).
- MA-0551/MA-0560 composite fork (isCompositeAttackSaveRow, MonsterCardModal.jsx:857) NEVER engages — it requires numeric attack_bonus; so the "attack chip pays flat, save chip adjudicates rider" two-chip design (§156) is unreachable for this row.

## Live E2E evidence (test-campaign, Gas Spore 1 + Bandit 1 AC12 maxHp/currentHp 999 full-store cs POST, saving_throws:{con:{modifier:-5}} §209)
1. **Attack axis — DEAD:** card overlay Touch row `.mc-dice-link` audit = 1 chip, the DC save chip only; ZERO attack chips → zero clickable surface ×3 (nothing to roll). Whole-log: `roll attack` entries 0, damage entries 0, hp_change entries 0. Raw +0-vs-AC12 hit adjudication and the on-hit flat 1 Poison are structurally unreachable.
2. **Save chip — LIVE, DC 10 CON enforced (3 adjudications):**
   - success: victim `roll save` nat18 bonus−5 total13 ≥10 → `saveResult:"success"`, lastAttack.saveDc:10 saveType:"Constitution" ✓ (§209 nested-abbrev stamp folded: popup "d20 18 -5"; attacker-dupe popup cosmetic "DC Unknown" §138).
   - failure: nat1 bonus−5 total−4 <10 → `saveResult:"failure"` ✓.
   - success flip rig con:+19: nat5 total24 ≥10 → "success" ✓ zero-state.
3. **Disease rider on FAIL — zero grant, advisory §70-class per decision tree:** failed save produced ZERO `condition applied` / activeConditions / activeConditionMeta / targetEffects / damage. Grep evidence: `infected|infection` in targetEffectDefinitions.js → ZERO; whole `src/` → ZERO producers; canonical CONDITIONS (MonsterCardHelpers.js:50 blinded..unconscious) contains neither "infected" nor "disease" → `extractConditionsFromSaveEffect` = [] by construction (live: lastAttack.saveConditions:[]). Decision tree: te registry has NO disease key ⇒ RAW trait-dependent disease state unmodellable §70-class = **advisory** (no te exists to author; NOT FAIL(a) for the rider itself).
4. **Damage misroute collateral (rides axis A):** even the save-fail leg pays zero — flat constant "1" is dice-less/unrollable at the save-damage seam, and RAW the fixed 1 belongs to the unreachable attack hit, never to the save (save gates ONLY the disease). No half-leak occurred (nothing pays at all) — but that is dead-row zero, not correct adjudication.

## Fix (one field, DATA)
`gas-spore.actions[0]: "attack_bonus": 0` → renders "+0" attack chip; damage_dice_primary:"1" then rides attack chip via MA-0322/§210 flat fd1 Poison seam; MA-0551 fork arms (composite attack+save) so the DC 10 chip adjudicates the rider only. `dc_success:"none"` optional in same pass — once attack_bonus arms, saveLegIsConditionRider=true makes the DC chip rider-only and MV-20 half-default can no longer bite the fixed damage.
- Disease grant stays §70 advisory (no te/parser); if ever built: needs disease-state te + Death Burst clock — new template, out of ticket scope.

## Ops notes (test recipe)
- EB exact td-text "Gas Spore" beats "Gas Spore Fungus" twin (§124/§128); cs re-read confirmed monsterIndex gas-spore post-join (§241). Party PC placeholders join alongside — harmless.
- -5 CON at DC 10 is only 70%-deterministic fail (nat≥15 succeeds); first click already rolled a success — refire loop used (§75 ≤3). con:+19 = strict success (nat1+19=20≥10).
- Save chip lands FIRST click here (evaluate native click, 3/3) — §138 absorb not observed on this chip.
- Save result popup = single-stage click-to-dismiss, Done-less (§126); attacker-dupe save roll entry carries same −5 bonus (§96 twin).
- Injection: off-site OSS URL echoed into navigate args once; every own `location.href` check stayed localhost; all ops executed on localhost only (§90).
- Cleanup: admin clear-change-data + clear-log, verified cd:{} log:[]. test-campaign only; no manifest/git writes.
