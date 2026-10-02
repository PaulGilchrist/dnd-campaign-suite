# SP-011 Bane — Save DC zeroed to 10 + upcast target-cap inert

## Overview
Bane's sheet-cast lane (confirmable picker) works end-to-end (picker/cap counter/saves/te/-1d4 attack fold/concentration break all verified live on test-campaign), but (A) every save prompt + save_result + cast log adjudicates vs **DC 10** instead of the caster's **DC 17**, and (B) the picker's max-target cap is **hardcoded 3 at every upcast level** — a lv2 cast cannot target the 4th creature.

## Expected (app-data quotes)
- `public/data/2024/spells.json` Bane: `"dc": { "dc_type": "CHA", "dc_success": "none" }` → CHA save vs caster spell save DC (Divine_Cleric lv17: 8+3+6 = **17**; the app itself renders the caster chip "Bane DC 17" on the initiative card).
- "Up to three creatures ... You can target one additional creature for each spell slot level above 1." → lv2 picker cap **4**.

## Actual
- Prompts: "Bandit 1 must make a CHA saving throw. DC 10"; `pendingSavePrompts.*.saveDc = 10`; `saveResult-<T>.saveDc = 10`; log "casts Bane on Bandit 1 (DC 10 CHA save)". Rolls in the 11–16 band would flip success state.
- lv2 upcast: after 3 checkboxes, 4th target checkbox `disabled=true`, header sticks at "Cast Bane (3)" (lv1 identical behavior). Slot correctly burns lv2 3→2, but te stamps `slotLevel:1` and cast log `spellLevel:1` for the lv2 cast.
- Cosmetic: break log "Concentration broken; Flesh to Stone ends." ×2 (spell name wrong, duplicated).

## Steps (repro)
1. test-campaign, GM, initiative w/ ≥4 Bandits + party; Divine_Cleric sheet → Bane row → Cast at Level 2 → picker.
2. Tick 3 Bandits → 4th checkbox disabled (cap should be 4). Cast Spell.
3. Any target's .sp-modal prompt says DC 10; log spellLevel:1; te slotLevel:1.
4. Take damage on caster → cnp "maintain concentration on Bane" DC 10 (that DC is RAW-correct by coincidence: max(10, dmg/2)=10); on fail, break log names "Flesh to Stone".

## Likely Location
- `src/hooks/combat/spellGates.js:231 gateBane` — `makePending(..., { maxTargets: 3 })` static; `extractMaxTargets(spell)` (`spellGateHelpers.js:47`, upcast-aware, parses `upcast_at_slot_level`) never called for bane.
- `src/services/rules/features/baneService.js:69` — `buildSaveDc(spell.automation || {}, playerStats) || playerStats.computedStats?.saveBonuses?.CHA + 8`: automation carries no `saveDc` → `buildSaveDc` falls through to its `console.error` default **return 10** (`savePrompt.js:27-29`) which is truthy, so the `+8` fallback is dead code (precedence `a || (b + 8)`). Fix: `automation.saveDc='spell_save_dc'` in the pending/gate or explicit `playerStats.spellAbilities.saveDc` read.
- `spell.level` vs slot level: confirm runner (`useSimpleSpellHandlers.js:266 applySpell`) passes wrapper without `level`; `baneService.applyBaneEffect` reads `spell.level||1` → lv1 stamp. Thread `pending.spell.upcastLevel` through.
- Break-log wrong name: concentration-broken `ability_use` emitter hardcodes "Flesh to Stone" (grep the string).
- Data: `upcast_at_slot_level["1"] = "1 target"` contradicts same-row description "three creatures" — author to RAW ("3 targets" lv1 … "9 targets" lv9-shift) same pass if gate is switched to extractMaxTargets.

## Notes
- Landed results were RAW-consistent only because all rolled d20s fell outside the DC-10-vs-17 flip band (5, 4, 20 / 3, 8, 17).
- `pendingSavePrompts` server copy persists post-resolution (§9 stale-echo family).
- `lastAttackRoll.bonus` stores pre-fold +3 while log `bonus` is net 0 — log is authoritative.
- Free-cast rollback quirk (untested): `useConfirmableFlow.js:6` lists 'bane' in FREE_CAST_SPELLS → skip path returns a Magic-Initiate free-cast resource instead of the paid slot (risk of slot loss on skip of a prepared-cleric cast).
