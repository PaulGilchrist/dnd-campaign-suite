# Devious Strikes Poison: saving throw SUCCESS refunds the 1d6 Cunning Strike cost (full sneak pool dealt)

## Summary
When a Devious Strikes (Cunning Strike) **Poison** option is chosen and the target **succeeds** its CON save, the cost dice are silently given back: the attack deals the FULL sneak-attack pool (10d6 at Rogue 20) even though the `Forgoing 1d6 Sneak Attack damage dice for Cunning Strike cost.` ability_use row is logged. The Trip and Daze legs on both save outcomes, and the Poison leg on a save FAIL, all correctly roll `10d6 − cost` (observed `9d6` / `7d6`). Per 2024 RAW the forgone dice are paid when the maneuver is taken, regardless of the save result.

## Steps to reproduce
1. In `test-campaign`, give a fixture character 2024 Rogue level 20 / Arcane Trickster (sanctioned disk swap; DG/DE/DF/DF+ precedent) and add `Poisoner's Kit` to `inventory.backpack` (Poison material gate).
2. Hand-roll a combatSummary board (EvasiveFighter + ElderPaladin + Disciplined_Monk, `type:'player'`) and an active map with adjacent tokens, so the Versatile Trickster/death-strike side lanes stay short and deterministic (rig per playbook §4).
3. Arm `EvasiveFighter.targetName = ElderPaladin` via scoped `PATCH /combatSummary`.
4. Stamp ElderPaladin `activeBuffs:[{effect:'warding_bond',saveBonus:19}]` via scoped PATCH so the CON save **succeeds**.
5. Bump `combatSummary.round` to re-arm the sneak latch, open EvasiveFighter's sheet, press the Shortbow row until a HIT, click Done.
6. In the Devious Strikes chooser tick **Poison** only → Apply Effects → Roll Save (will succeed).
7. Drain the result/damage popups (Done) and read the last `roll` row with `+ Nd6 [Sneak Attack]` plus its `rolls` array.
8. Control A (same tab, next round): repeat step 5–7 choosing **Trip** (save succeeds) → pool shows `9d6`.
9. Control B: flip the stamp to `saveBonus:-19` (save fails) and repeat with **Poison** → pool shows `9d6` and a `poisoned` condition is granted.

## Expected behavior
Poison (like every other Cunning Strike option) rolls `10d6 − 1d6 = 9d6` sneak dice regardless of the saving throw outcome; the logged ability_use cost row must match the dealt pool.

## Actual behavior
Poison-on-save-SUCCESS rolled the full pool: log row `formula:"1d6+1 [piercing] + 10d6 [Sneak Attack]"` with `rolls` length **11** (1 weapon + 10 sneak), total 48 — immediately after `ability_use: Forgoing 1d6 Sneak Attack damage dice for Cunning Strike cost.` and `save_result: ElderPaladin succeeded CON save (DC 15 …)`. Controls: Trip-success leg → `9d6`, 10 dice (correct); Poison-fail leg → `9d6`, 10 dice + `poisoned` granted (correct). No console error. Net effect: ~1d6 extra damage per successful-save Poison (~3.5 avg), plus a machine-truth `ability_use` cost row that contradicts the damage ledger.

## Likely location
Confident on the seam, guessing on the exact line: the sneak pool is built in `src/services/combat/steps/attackRollDamageCalc.js` → `buildSneakAttackStep()`, which reads `_cunningStrikeCostUsed` from the runtime store (`getRuntimeValue`, synchronous client mirror) and zeroes it after applying. Something on the Poison SUCCESS path either (a) never lands the cost before the damage stage resumes, or (b) resets `_cunningStrikeCostUsed` to 0 — candidates: the repeating-poison save-listener flow (`src/services/automation/handlers/combat/attackRiderHandler.js` / the poison option's save consumer in `src/services/rules/features/`) racing the chooser-close → `resumeAttackPipeline`, or a shared "option produced no effect → roll back cost" cleanup that the fail/success asymmetry trips. Investigation: grep writers of `_cunningStrikeCostUsed` besides `cunningStrikeUtils.applyCunningStrikeCost` and `attackRollDamageCalc` (incl. initiative/navigationHandlers.js clear), and add a temporary log of the key value inside `buildSneakAttackStep` during a poison-success repro.

## Suggested fix
First, instrument: log `_cunningStrikeCostUsed` at Apply time vs. inside `buildSneakAttackStep` for a poison-success cycle to distinguish "zeroed early" from "never written". If the poison success consumer (or its modal/prompt resolution handler) resets the key or if the damage stage resumes before the awaited cost write is visible to the client mirror, make the poison lane hold the cost until after the damage step consumes it (same ordering the Trip lane proves works — Trip-success deducts correctly).

## Severity
Data-integrity risk — machine-truth ledgers (ability_use cost row vs `roll`/`hp_change`) contradict each other and the character over-deals sneak damage whenever the target wins the save; silent, no console signal.

## Resolution
**DISPROVED — behavior is correct on current HEAD; could not reproduce after 4 independent Poison-save-SUCCESS cycles built exactly per the Steps to reproduce.** (Verified 2026-11-07, dev pair :5173/:80 at HEAD `1a7206cdb`; source tree byte-identical to when the bug was filed — `git diff HEAD` empty, the filing commit touched only docs + this bug file.)

Repro rig re-built (all sanctioned, swept at exit): EvasiveFighter disk surgery 2024 Rogue/Arcane Trickster/lv20 + `Poisoner's Kit` into `inventory.backpack` (md5 `0df29ff3…` backup → byte-exact restore, GET-verified); hand-rolled `type:'player'` board EF/DM/EP on self-created sandbox map `fix-ps` (EF(5,5)/DM(6,5)/EP(7,5) — VT/death-strike lanes kept short); `creatures[EvasiveFighter].targetName=ElderPaladin`; warding_bond `saveBonus:±19` win/lose dial via scoped PATCH; sneak re-arm via scoped `combatSummary.round` PATCH (GET-verified).

Faces run (sheet lane, Shortbow row, chooser tick-Poison-only):
- **Poison SUCCESS ×4** (round-bumped cycles, drain styles varied: patient loop, single-script tight tick→Apply→RollSave, aggressive multi-overlay Done×N): every cycle ledger read `ability_use Forgoing 1d6…` → `save_result success (DC 15, +29 fold)` → `ability_use Devious Strikes … succeeded — no effect` → `roll damage formula "1d6+1 [piercing] + 9d6 [Sneak Attack]"` with `rolls` length **10** (1 weapon + 9 sneak; totals 39/35/36/40) + matching `hp_change`. The prompt breakdown and roll both read the live +19 stamp (e.g. `d20 20 + 29 = 49`, `d20 8 + 29 = 37`, `d20 6 + 29 = 35`). No cycle ever rolled `10d6`/11-dice; a whole-log scan over every damage row found ZERO `10d6 [Sneak Attack]` occurrences. No console errors.
- **Control A — Trip SUCCESS**: `9d6`, 10 dice ✓ (matches filing-run record).
- **Control B — Poison FAIL** (stamp flipped to `-19` mid-session, breakdown re-rendered `-19 (Warding Bond)` live): `9d6`, 10 dice + `poisoned` granted ✓ (matches).
- **Bonus faces**: a latched cycle honestly skipped the chooser and landed base `1d6+1` (DH chooser-law face); a VT chooser legitimately stacked behind the Trip-success leg (Skip → delayed damage still `9d6`).

Code audit (the bug file's own investigation instructions): writers of `_cunningStrikeCostUsed` are EXACTLY three — `cunningStrikeUtils.applyCunningStrikeCost` (writes currentCost+costD6 + the cost row, at Apply, BEFORE the save listener exists), `attackRollDamageCalc.buildSneakAttackStep` (reads via `getRuntimeValue`, deducts, zeroes only after consuming), and `navigationHandlers.clearPlayerRoundLatches` (turn-seam clear, fires nowhere in a sheet-lane cycle). The save-SUCCESS consumer (`attackRiderHandler.handleRiderSave` success branch → `evictSavedRiderEffect`) touches ONLY the campaign-level `targetEffects` bucket — it cannot touch the per-char cost key. `setRuntimeValue` updates the in-memory store synchronously (`useRuntimeState.js:99` `store.set` before the async POST), so the hypothesized race ("damage stage resumes before the awaited cost write is visible to the client mirror") is structurally impossible in the sheet lane — the very tab that pays the cost reads it synchronously, and the chooser host awaits `applyRiderOption` (which awaits `applyCunningStrikeCost`) BEFORE closing → `resumeAttackPipeline`. There is no "option produced no effect → roll back cost" cleanup anywhere (grep refund/rollback = spellThief damageRollback family only, unrelated).

Likely explanation of the original sighting: a jammed earlier cycle in the DH tab load letting a full-store snapshot resurrect/interleave the key (the §102 warning family) — the DH run itself documented queue-jam artifacts in that same session. On a pristine rig with the exact filing steps the asymmetry does not exist. Unit ledgers corroborate: `npx vitest run` over the five Cunning Strike lane test files (cunningStrikeResume / cunningStrikeUtils / CharActionModals.cunningStrike-resume / damageRolling / AttackRiderModal) = **72/72 green**; `npm run lint` zero warnings.

No source or test changes made. Test-campaign swept to baseline: change-data `{}` + log `[]` + combatSummary absent (closed-tab two-pass GET-verified), sandbox map `fix-ps` deleted (maps back to the 4 owner fixtures), EF byte-exact restore.

