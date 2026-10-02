# bug-CLA-055 — Clockwork Cavalcade Heal silently resolves 0 HP for PCs in combat (stub cs.maxHp:1)

## Overview
CLA-055 Clockwork Cavalcade (Clockwork Sorcery lv18, 2024) — the Heal leg opens a fully functional distribution modal (pool 100, correct per-target HP shown), accepts a 63+37 split, consumes the use, logs `hp_change` entries — but every healed delta is **0**. The caster's `clockworkCavalcadeUses` is still decremented, so one use is silently burned with zero benefit.

## Expected (app data, `public/data/2024/classes.json` Clockwork Sorcery → Clockwork Cavalcade, automation `{type:'clockwork_cavalcade', maxHeal:100, restoreCost:7}`)
> **Heal:** The spirits restore up to 100 Hit Points, divided as you choose among any number of creatures of your choice in the Cube.

## Actual (test-campaign, AberrantSorcerer host swapped to Clockwork Sorcery lv20, Bandit 1 joined)
- Picker listed all 15 combatants with TRUE HP: `AasimarTest (80 / 143 HP, 56%)`, `FeyRanger (40 / 89 HP, 45%)`.
- Allocated exactly 63 + 37 (= pool 100), confirmed via "Heal (2)".
- Result popup + logs: `AberrantSorcerer used Clockwork Cavalcade (Heal), restoring 0 HP across 2 creature(s): AasimarTest (+0 HP), FeyRanger (+0 HP).`
- Ledger: `hp_change {AasimarTest, delta:0, isHealing:true, note:'Clockwork Cavalcade'}`, `hp_change {FeyRanger, delta:0, isHealing:true}`; runtime `currentHitPoints` unchanged (80, 40). Use consumed (`clockworkCavalcadeUses 1→0`).

## Steps
1. Campaign-select `test-campaign` (this triggers the App campaign-select cs re-seed — see Likely Location).
2. Encounters → join Bandit → combatSummary has PCs as `{currentHp:1, maxHp:1}` stubs (GET `/api/campaigns/test-campaign/change-data`).
3. Wound AasimarTest to 80/143, FeyRanger to 40/89 via initiative-card HP inputs (runtime keys update; cs stubs stay 1/1).
4. Sorcerer sheet → Clockwork Cavalcade row → Heal → tick both → allocate 63/37 → Heal (2).
5. Observe 0-delta `hp_change` entries + uses consumed.

## Likely Location
`src/services/automation/handlers/class-sorcerer/clockworkCavalcadeHandler.js:126-137` (`healCubeTarget`):
`const maxHp = (creature && creature.maxHp) || playerStats.hitPoints || 0;` — for player targets the combatSummary stub's `maxHp: 1` is TRUTHY so the fallback never fires, `missingHp = max(0, 1 − runtimeCurrent) = 0`, `actualHeal = 0`.

Where the stub comes from: `src/App.jsx:252-256` campaign-select re-seed writes `{currentHp: c.computedStats?.hp?.current || c.hp?.current || 1, maxHp: c.computedStats?.hp?.max || c.hp?.max || 1}` and the server character JSON carries no `computedStats`/`hp` block (verified via GET) → all PCs seeded `1/1`. Player entries in `encounterToInitiative.js:62-70` are minimal BY DESIGN ("resolved at read time"), so consumers must read runtime/playerStats — exactly as `MassHealModal.jsx:56-57` (its own display) does. The Cavalcade resolver violates that contract for players while its picker displays runtime truth → "modal lies, resolver zeroes".

Same stub-trusting pattern exists in `massHealHandler.js:117` / `massHealUtils.js:206` (`creature?.maxHp || playerStats.hitPoints`) — those historical PASS runs happened while no cs entry existed (admin-cleared, no re-select) so the fallback saw `creature undefined`. Cavalcade structurally requires cs for its picker, so this fallback ordering is dead code for PCs the moment any combat exists.

## Notes
- Dispel, Repair, 7-SP restore, SP-insufficient refusal, uses gate, and LR re-arm ALL verified working the same session (see checkpoint-CLA-055.md); defect is confined to positive HP deltas for `type:'player'` targets.
- Fix shape: for `type === 'player'`, resolve maxHp from runtime max key / `playerStats.hitPoints` (never cs stub); keep current cs behavior for npcs.
- Cleanup done: subclass restored to Aberrant Sorcery (disk-verified), Bandit removed, change-data `{}` + log `[]` admin-cleared.
