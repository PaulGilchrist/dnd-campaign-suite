# Bug MA-0093 — Adult Copper Dragon "Giggling Magic": success deals half damage, 1d6 debuff never applied, once-per-turn gate absent

**Verdict: FAIL** (DC/type/fail-branch exact — but success branch wrong, debuff te inert, ungated same-turn refire)

## Row
- MA-0093 · Adult Copper Dragon (`adult-copper-dragon`) · `legendary_actions[1]` · category: legendary_actions · actionType: attack+save · DC 17 Charisma · 7d6 Psychic on fail · debuff "1d6 subtracted from target's future ability checks/attack rolls until end of its next turn" · once-per-turn latch ("can't take this action again until the start of its next turn").

## Data check (PASS, no drift)
- `public/data/monsters.json` `adult-copper-dragon.legendary_actions[1]`: `save_dc:17`, `save_type:"Charisma"`, `damage_dice_primary:"7d6"`, `damage_type_primary:"Psychic"`, save_effect prose matches row text verbatim. **No `dc_success` field authored** → engine default (see root cause). No `uses` on legendary header (MA-0092 family).

## Live probe (test-campaign, :5173, 2026-09-14)
Setup: EB Join → cs idx 0 `Adult Copper Dragon 1`; activeCreature=AasimarTest (valid legendary window); dragon card overlay open; `DC 17 Charisma` link clickable in Legendary Actions section (generic branch — no legendaryGate, MA-0092 fingerprint).

### PASS subset
- **Save prompt**: "ElderPaladin must make a CHARISMA saving throw. DC 17" — DC and type enforced exactly. ✓
- **Failed save = full damage**: re-armed target DivinationWizard (CHA 8, mod −1): prompt → Roll Save → SAVE FAILURE total 7 (d20 8 + −1) vs DC 17. `saveResult-DivinationWizard` {success:false, roll:8, total:7}. Log: `save_result` DC 17 Charisma fail + `save-damage` 7d6 rolls [1,2,3,2,4,2,2] total **16** + `hp_change` −16 (82→66, no resistance) = **full unscaled 7d6 Psychic applied**. ✓
- **Logging**: save, save-damage, hp_change, save_result all logged at fail. ✓

### FAIL branches
1. **Success deals half damage (should be NONE).** First firing: ElderPaladin SAVE SUCCESS total 26 vs DC 17 → popup STILL rolled `save-damage` 7d6 (rolls sum 28, total shown 14 = pre-halved "14") → "Damage Resistance — 14 halved to 7" → `hp_change` **−7** (224→217). Popup text verbatim: "7 damage applied to ElderPaladin (reduced from 14)". RAW: success = zero damage; the "Failure or Success" clause only consumes the action, deals nothing. The save prompt itself advertises the wrong rule: "Half damage on successful save".
2. **1d6-subtract debuff never applied.** After the FAILED save, change-data `targetEffects` = null; no badge on ElderPaladin/DivinationWizard cards; no te in any log. Grep: no `subtract`/1d6-penalty te in `targetEffectDefinitions.js` (closest: `bane_penalty` 1d4 attacks/saves only); `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:53) matches only condition keywords → saveConditions [] for this prose → `applyFailedSaveConditions` no-ops (saveProcessing.js:402). Zero producers AND zero consumers app-wide for this debuff.
3. **Once-per-turn gate absent (action-level).** 2nd click of the same `DC 17 Charisma` link in the SAME turn (still activeCreature=AasimarTest, no turn walk): opened a full fresh "Saving Throw Required … DC 17" prompt — Dismissed, no refusal popup, no latch, no spend log, no `*_refused` entry. Ungated `handleSaveRoll` path (MonsterCardModal.jsx:1024; legendary section rendered via generic fallback MonsterCardBody.jsx:57 because header lacks `uses` — MA-0092). No giggling-specific latch exists (`grep giggling src/` = zero; row lacks `uses` so `resolveAbilityUsesGate` passes).

## Root cause / Likely location
1. **dc_success default:** row has no `dc_success` field → `resolveBlockSaveDcSuccess` (MonsterCardModal.jsx, called from `executeBlockSaveRoll` :113) defaults to `'half'` → `applyDamage.js:90 dcSuccess==='half'` halves on success. Fix shape = DATA `dc_success:"none"` (precedent MA-0030 authored dc_success/success-immunity clauses) + verify the block-save seam honors `'none'` (zero-damage-on-success path; MA-0017 damageless-condition leg).
2. **Debuff te:** no registry entry — add e.g. `giggling_magic_debuff` (label/icon/group + until-target-next-turn expiry) to `targetEffectDefinitions.js`; producer at the failed-save seam (saveProcessing te-arm pattern, MA-0020/0030/CLA-383 precedent) + roll-modifier consumer for ability-check/attack paths (none exists today for per-roll 1d6 subtract on PC path).
3. **Once-per-turn gate:** rides the MA-0021 economy — author `uses:3` on the header (MA-0092 fix) and the "can't take again until start of its next turn" clause needs the MA-0021 round+turn latch (`monsterLegendaryUses.js` legendaryExpendGate / turn latch), which currently never runs for this dragon's rows.

## Steps to Reproduce
1. test-campaign → Encounters → check Adult Copper Dragon → Join; arm target on dragon's card.
2. Open dragon card → Giggling Magic → `DC 17 Charisma` → Roll Save. On success: popup claims half damage, HP still drops (−7 observed). On fail: full 7d6 applied but no debuff badge/te anywhere.
3. Click the same link again the same turn: fresh prompt opens, saves resolve unlimited — no refusal.

## Cleanup
- Only `test-campaign` touched. Admin clear change-data + campaign log at end (browser + POST localhost). No manifest `verified` edits.
