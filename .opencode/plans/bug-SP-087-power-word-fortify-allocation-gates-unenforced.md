# bug-SP-087 — Power Word Fortify: allocation sum ≤120 and ≤6 targets gates unenforced

Verdict: FAIL — core temp-HP distribution lane live-exact, but both quoted enforcement gates are unimplemented (playbook §1: unenforced trigger/gate = FAIL).

## Expected Behavior (canonical)
public/data/2024/spells.json (Power Word Fortify, 7th level, range 60 ft): "You fortify up to six creatures you can see within range. The spell bestows 120 Temporary Hit Points, which you divide among the spell's recipients."
Note: manifest/task wording "6th-level" was wrong — canonical data wins: **level 7** (confirmed live: `spell_slots_level_7` 2→1 consumed).

## Actual Behavior (live, 2026-10-07, HeroesFeastBard lv20 2024 Bard, test-campaign)
Works (exact):
- Thug 1 tempHp **100**, Bandit 1 tempHp **20** (runtime + card "Temp HP" lines).
- Modal "Pool: 120 HP", "Allocated: 120 / 120"; popup "120 temp HP distributed — Thug 1: 100, Bandit 1: 20".
- Concentration absent (cs `concentration: None`); lv7 slot decremented 2→1 (ledger + sheet popup diff).
- Logs: `spell` Power Word Fortify + two `hp_change` `isTempHp:true` deltas 100/20.

Defects:
1. **Sum ≤120 unvalidated** — inputs 100+100 → modal shows "Allocated: 200 / 120" and Fortify button remains ENABLED (probe not executed). Modal clamps each input 0..120 individually only (PowerWordFortifyModal.jsx:29/:36).
2. **≤6 target cap absent** — ticked 7 recipients, button reads "Fortify (7)" ENABLED; `maxTargets:6` payload ignored by picker.
3. Advisory: logged `formula:"120 + ((20 - 7) * 5)"` stamps caster LEVEL, not slot level (powerWordFortifyHandler.js:92 `auto.slotLevel || playerStats.level`) — upcast pool lane (+5/slot above 7) inert vs data intent.
4. Advisory: caster self-target excluded at powerWordFortifyHandler.js:31 (RAW-defensible; spell says "creatures you can see" — caster can see self).

## Steps to Reproduce
1. test-campaign, HeroesFeastBard (knows Power Word Fortify permanently via step-14), EB-join 7 NPCs, start initiative.
2. Cast Power Word Fortify → allocate 100/100 to two recipients → note "Allocated: 200 / 120" + Fortify enabled.
3. Tick 7 recipients → "Fortify (7)" enabled.

## Likely Location
- `src/components/**/PowerWordFortifyModal.jsx` :29/:36 (per-input clamp only; add sum gate + max-6 picker cap).
- `src/services/automation/handlers/buffs/powerWordFortifyHandler.js` :92 (slotLevel vs caster level for pool formula).
- Chain: automation/index.js:307 → triggerSpells.js:453 handleGenericAutomation → useSpellCastExecutor.js:76 → PowerWordFortifyModal.jsx → useCharActionsModalHandlers.js:207 → tempHpService.js (max-replace). Manifest handler paths (spellHandler/spellRouter) stale, grep-zero.

## Notes
- Pool math base is exact: parseInt of "120 + ((spellSlotLevel-7)*5)" → 120 at lv7.
- Recipes: wizard step-14 `.list-item-checkbox-trigger` click → Save; native confirms on `.npc-remove-btn`; cs mirror lags ~10-12s; pool-120 with 13-name picker = free 6-cap probe.
