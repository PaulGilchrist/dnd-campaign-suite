# BUG SP-023 — Circle of Power: zero-on-save-success and advantage-mode FAIL at the monster save-AoE adjudication seam

**Verdict: FAIL** (clause 2 broken functionally; clause 1 works at prompt level but is lost in adjudication/log)
**Tested:** 2026-10-03, localhost, test-campaign, ElderPaladin (host) + HexWarlock (ally-in-aura), White Dragon Wyrmling 1 (Cold Breath: CON save DC 12, 5d8 cold, Success: Half damage, no recharge).

## Canonical spell text (public/data/2024/spells.json, index "circle-of-power")
> "An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have **Advantage on saving throws** against spells and other magical effects. **When an affected creature makes a saving throw against a spell or magical effect that allows a save to take only half damage, it takes no damage if it succeeds on the save.**"

- casting_time: "Action" | range: "Self" | components: V | duration: "Concentration, up to 10 minutes" | concentration: true | level 5 Abjuration | area_of_effect: emanation 30-foot | classes: Cleric, Paladin, Wizard
- 2024 ONLY — absent from 5e spells.json (verified).

## What works (PASS evidence)
- Cast lands: Lv5 slot 2→1; `circle_of_power` targetEffects stamped on ElderPaladin + HexWarlock (source ElderPaladin, duration "concentration") in change-data root `targetEffects`; `activeBuffs` "Circle of Power" on both; `spell_effect` log lines for both targets with both clause texts; concentration row "Circle of Power DC 19" + buff badges on both initiative cards; popup "2 target(s) gained advantage…".
- SavePromptModal prompts vs buffed ElderPaladin render **advantage mode with two raw d20s, max-taken**: run1 `d20 (9, 17) + 10 (+5 aura from ElderPaladin) (Advantage)` total 27; run2 `d20 (8, 13) … (Advantage)` total 23. Advantage advantage is attributable to Circle of Power (SavePromptModal.jsx:144 `isCircleOfPowerActive`), distinct from the +5 Aura of Protection bonus (CLA-021) which is shown separately.
- Control (pre-cast): HexWarlock CON save DC 12 rolled **normal mode** — `d20 (14) + 0`, log rolls [14], `dcSuccess:"half"`, finalDamage **10** (half applied), hp_change −10. Normal baseline correct.
- Evasion badge note appears on the prompt UI: "Evasion: No damage on success, half damage on failure" (SavePromptModal.jsx:549/262 include `isCircleOfPowerActive`).

## What FAILS (deterministic, reproduced twice)
Adjudication of the same saves applied **half damage, not zero**, and logged normal-mode raw rolls:

Run 1 (ElderPaladin, save success 27 vs DC 12, prompt showed d20 (9,17) Advantage + Evasion note):
```
roll save-damage "1d20+10" rolls:[17] total:27 success
roll save-damage "5d8" rolls:[6,2,7,7,8] total:14 dcSuccess:"half" saveResult:"success" saveRoll:17 saveRawRolls:[17,17] finalDamage:7
hp_change ElderPaladin delta:-7 (224→217)
```
Run 2 (ElderPaladin, save success 23 vs DC 12, prompt showed d20 (8,13) Advantage + Evasion note):
```
roll save-damage "1d20+10" rolls:[13] total:23 success
roll save-damage "5d8" dcSuccess:"half" saveResult:"success" saveRawRolls:[13,13] finalDamage:11
hp_change applied (−11)
```
Expected per canonical text: **finalDamage 0, hp_change delta 0** on save success, and save adjudication/log honoring advantage (`saveRawRolls` two distinct dice / "with Advantage" style marker, cf. SP-022 precedent). Neither happened. No `rollType:"evasion"` log entry either — evasion was silently dropped at adjudication despite the UI note.

## Root cause (grep evidence)
The monster save-AoE chooser result is adjudicated in **src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx**, which computes evasion from the target's OWN `computedStats.evasionEffects` only — Circle of Power is not consulted:
- `resolveEvasionFinalDamage` (:367-370): `evasionActive = hasEvasionForSave(evasionEffects, normalizeSaveType(saveType))` → false for CoP → `computeDamageAfterEvasion(rawDamage, success, 'half', false)` → **half damage**.
- Same own-only pattern at :179.
- `applyPlayerSaveDamage` (:440-512) writes exactly the observed log shapes: `rolls:[detailRoll]`, `formula:'1d20+bonus'`, then damage log with `saveRawRolls:[detailRoll, detailRoll]` (:1508) duplicating the max-taken roll → advantage info lost from log.
- SavePromptModal's own `evasionActive` (which IS CoP-true, :262/:549) dispatch is dropped: console shows the consumer path `App.saveResult … no pending prompt …, skipping re-dispatch` + `pendingSaveRegistry MISS mapSize=0` — the chooser lane never registers the prompt, so SavePromptModal's advantage/evasion dispatch detail never reaches a damage consumer.

By contrast, CoP IS folded in the other seams (proof the spell was implemented, just not on this adjudication lane):
- `circleOfPowerHandler.js` (activeBuffs + te + concentration + logs) — confirmed live.
- `useLoggedDiceRollSaves.js:79` `circleOfPowerAdvantage`, `:102`/`:332` `hasEvasion || isCircleOfPowerActive` (quick-roll lane), `logQuickRollEvasion` names "Circle of Power" (`:167`).
- `handlePlayerSaveDamage.js:129-133` `computePlayerSaveAdvantage` includes `isCircleOfPowerActive`.
- `saveProcessing.js:342` `resolveSaveEvasion` includes `isCircleOfPowerActive`.
- `conditionEffects.js:641-643` te → `saveAdvantage:'against_spell'` + reason "Circle of Power".

## Fix suggestion
Make SaveAttackAoeModal's PC-prompt evasion + log adjudication consult `isCircleOfPowerActive(targetName, campaignName)` (mirror `saveProcessing.js:342` / `useLoggedDiceRollSaves.js:102`), propagate/adopt `detail.evasionActive`, `detail.rawRolls`, `detail.mode` from the SavePromptModal dispatch (or register the chooser-lane prompt in `pendingSaveRegistry` so App re-dispatch carries it), and record `saveRawRolls`/advantage on the save-damage log lines.

## Repro steps
1. test-campaign, ElderPaladin (2024 Paladin lv20). Edit wizard step 14: tick Circle of Power, Save; disk-verify `spells[]`.
2. Encounter Builder: join **White Dragon Wyrmling**; arm `targetName` on its initiative card.
3. Wyrmling turn → open monster card → click Cold Breath "DC 12 Constitution" chip → select ElderPaladin → "Cold Breath (1)".
4. SavePromptModal: note "Evasion: No damage on success" + roll → advantage "(Advantage)" two dice displayed.
5. Done → adjudication applies HALF damage; log shows `saveRawRolls:[r,r]`, no evasion entry. Expected 0.
   (Pre-cast control on HexWarlock shows the same half-damage baseline — proving the adjudicator never saw CoP.)
