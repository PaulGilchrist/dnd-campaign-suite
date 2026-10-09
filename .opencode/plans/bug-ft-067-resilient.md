# FT-067 Resilient (feat) — VERIFIED FAIL 2026-10-08

## Manifest row
- ID FT-067, feat, trigger `save_proficiency`. Expected: gain saving throw proficiency with the chosen ability.
- Canonical data `public/data/2024/feats.json` Resilient: benefit "Saving Throw Proficiency" automation `{type:'save_proficiency', saveType:'Strength', fallbackTypes:[Dex,Con,Int,Wis,Cha]}` + ASI +1 (manifest row abbreviated; data is truth).

## What worked (first-computed character in a fresh app session)
Host DraconicDragon (lv20 2024 Barbarian, class saves STR+CON only):
- Edit wizard step-8 ticked Resilient (synthetic `.list-item-checkbox-trigger` click registers), step-9 `.bg-ability-select` chose Wisdom, Save.
- Disk GET: `feats:[Healer,GWM,Magic Initiate,Resilient]`, `featAbilityChoices:{"Resilient-0":{"assignment":"Wisdom"}}`, WIS `featIncrease:1` (9→10).
- Sheet after reload: WIS 10, +0, save -1 → **+6** (mod+PB folded, abilityCalc2024.js:24-28).
- LIVE forced save (DivinationWizard casts Fear DC19, PC prompt seam): `d20 (16) + 6` = 22 vs DC19 SUCCESS; machine truth `saveResult-DraconicDragon {saveBonus:6, success:true}` — PB carried. ✓

## FAIL — the resolver mutates the SHARED cached feats.json; grants are order-dependent and leak across characters
Root cause (code-exact):
- `featBuffService.js:326-335 parse2024SavingThrow` pushes `automation: auto` BY REFERENCE — the same object living in the app's module-cached `/data/2024/feats.json`.
- `featBuffService.js:620-629` then mutates it IN PLACE: `feature.automation.saveType = resolved; delete feature.automation.fallbackTypes;`
  (contrast line 617 ritual branch which correctly spreads `{...feature.automation, ...}`).
- After ANY Resilient-holder computes first, the cached feat automation is globally rewritten to that character's chosen ability with `fallbackTypes` removed. Every later computation's guard `fallbackTypes && fallbackTypes.length > 0` (:623) fails → NO re-resolution → the wrong saveType stands.

Live proof, same session, opposite order (fresh reload, HexWarlock opened first):
1. HexWarlock (holds `Resilient-1: Intelligence` on disk, class saves WIS+CHA) computed first → sheet INT save **+6 proficient** (correct), and cache poisoned to Intelligence.
2. Open DraconicDragon (disk choice Wisdom) → sheet `Wisdom 10 +0 save +0` — **proficiency LOST** — and `Intelligence save +5` (proficient) — **HexWarlock's Intelligence selection leaked onto the Barbarian**. Wrong ability granted + chosen-ability delta zeroed in one shot.
3. Forward order (earlier today, Dragon computed first) reproduced mirror-image: cache poisoned to Wisdom → HexWarlock `saveProficiencies:[]`, INT save **+0** (its own disk grant inert). Fiber probes: live cached `Resilient.benefits[1].automation === {type:'save_proficiency', saveType:'Wisdom'}` (fallbackTypes deleted) while disk feats.json serves `Strength + fallbackTypes` (fresh fetch byte-confirmed, cache:'reload' identical — HTTP cache clean, mutation is in-page module cache).
- In-page control: `computeAllFeatBuffs(HexWarlock disk, FRESH feats)` → Intelligence (correct). Same call with `dataLoader.loadFeatData('2024')` cache → Wisdom (wrong). Decisive.

## Severity
Multi-Resilient-holder campaigns are the normal case (registry already carries two holders). Whichever holder renders first permanently wins for the whole SPA session; every later holder gets proficiency for the wrong ability or none. Disk stays correct; the runtime silently lies. Fix = clone automation in `parse2024SavingThrow` (spread, mirroring :617) and/or resolve via `{...auto}` copies — do NOT mutate feats.json cache.

## Adjacent (not FT-067, cite-only)
- EvasiveFighter shows ALL six saves proficient: `Indomitable` (2024 Fighter lv9) automation `auto_reroll target:'saving_throw'` adds all six via `getAllSaveProficiencies` automationService.js:186-189 (over-grant family, pre-existing, existing cla396 test coverage).
- Aarakocra Aeromancer registry note claims Gust of Wind WIS DC13; app data/log: STR save ("spell save DC 13, STR") — registry stale.
- Host sheet STR/DEX "(Adv)" badges = pre-existing rig residue.

## Cleanup state
- DraconicDragon Resilient revert attempted via wizard step-8 (see session log; ASI featIncrease residue per FT-047 idempotency max-rule if wizard keeps it).
- Aarakocra Aeromancer removed; admin cleared change-data + log, GET-verified.
