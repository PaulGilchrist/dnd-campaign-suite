# BUG CLA-366 — Trickster's Transposition: swap is popup-only inert; creation-time modal renders wrong panel

## Title
CLA-366 Trickster's Transposition (Cleric, Trickery Domain, lv6, 2024) — teleport/swap writes zero state and zero logs; auto-swap offer at Invoke Duplicity creation renders the generic Rage teleport chooser; no illusion-active gate; "or move" clause absent.

## Overview
Trickster's Transposition: "Whenever you take the Bonus Action to create or move the illusion of your Invoke Duplicity, you can teleport, swapping places with the illusion."
App row (2024 classes.json majors "Trickery Domain" features[2], level 6): `automation.type:"temp_buff"`, `effect:"teleport_swap_with_illusion"`, `action:"bonus_action"`, `distance:"30 ft"`.
Manifest paths in the task (combat/automation/handlers/classFeatureHandler.js, routers/classFeatureRouter.js, infoBuilders/classFeatureInfoBuilder.js) DO NOT EXIST (verified `ls`). Real consumers (grep `teleport_swap_with_illusion`):
- `src/services/automation/handlers/buffs/buffHandler.js:103` → routes row to tempTeleportHandler
- `src/services/automation/handlers/combat/combatStanceHandler.js:297-304` → at Invoke Duplicity creation, opens modalName 'teleport' with the raw specialAction
- `src/components/char-sheet/modals/TeleportModal.jsx:7,83-105` → isSwap panel
- `src/services/automation/handlers/class-warlock/tempTeleportHandler.js:85-92` → confirmTeleport swap branch

## Expected (canonical, 2024 classes.json Trickery Domain features[2].description)
> "Whenever you take the Bonus Action to create or move the illusion of your Invoke Duplicity, you can teleport, swapping places with the illusion."

Observable minimum in this engine's accepted teleport model (cf. CLA-230 shadow_step / CLA-357 telekinetic_movement): an `ability_use` campaign log line plus a persisted state change (te or position/buff mirror). Every automation must log (AGENTS.md).

## Actual (live E2E, War_Cleric lv6 Trickery, test-campaign, all deltas from self-issued curls/evaluates)
1. **Legit swap (illusion ACTIVE) = popup-only.** Invoke Duplicity fired correctly (channelDivinityCharges 3→2, `activeBuffs` gains `{effect:'create_illusion', duration:'1_minute'}`). Then Transposition row → swap panel ("Swap places with your illusion (up to 30 ft)") → Swap → popup "Trickster's Transposition: Swapped places with your illusion." → Done. change-data delta: ZERO (no position/swap/te keys — `swapKeys:[]`, `__campaign__.targetEffects` absent, activeBuffs unchanged). Campaign log: 2→2 lines (zero new). No state change = no teleport happened; logging gap per AGENTS.md (tempTeleportHandler.js swap branch: description string only — log blocks at :94/:205 cover shadow/moonlight/bonus_teleport only).
2. **Creation-time auto-offer renders WRONG panel.** combatStanceHandler.js:297 finds `playerStats.automation.specialActions` entries, which are FLAT automation objects (no `.automation` wrapper); TeleportModal reads `action?.automation || {}` → `isSwap===false` → chooser showed "Teleport to an unoccupied space you can see: 60 ft — Standard teleport / 150 ft — Once per Rage" (Barbarian-flavored generic panel), not the swap panel. Cancelling kept the duplicity buff intact (buff applied before modal returns, activateStance:236-239). Confirming that wrong branch would log nothing either (generic branch has no log either).
3. **No illusion-active gate (ungated row).** Control probe BEFORE any Invoke Duplicity: Transposition row → swap modal → Swap → same "Swapped places" popup with `activeBuffs` ABSENT and log 2→2. Feature offers a swap that cannot exist.
4. **"…or move the illusion" clause absent.** No "move illusion" row/producer anywhere (grep `illusion` in src: only activeBuffs state, duplicityAuraUtils distract-advantage, invokeDuplicityAdvantageTargets for the lv17 Improved variant). Re-clicking Invoke Duplicity while active = toggle-OFF ("ended", buff removed, CD unchanged at 2, zero logs) — it is not a move+swap trigger.
5. No illusion entity/token exists engine-wide, so the swap has no position counterpart even in principle; the accepted-model minimum (te mirror + ability_use log, like telekinetic_movement) is not produced.

## Repro steps
1. test-campaign → Edit War_Cleric (lv6 Cleric 2024) → step 6 re-pick Cleric (Divine Order Protector) → step 7 Trickery Domain → ✓ Save → reload.
2. Encounters → search "Thug" → tick → Join Encounter (Thug 1 cs idx 0).
3. Baseline: `/api/campaigns/test-campaign/log` = 2 entries.
4. Control probe (no illusion): sheet → click `b.clickable` "Trickster's Transposition:" → Swap → popup, zero change-data/log delta (UNGATED BUG #3).
5. Click "Invoke Duplicity:" → CD 3→2 + create_illusion buff, but modal = generic 60ft/150ft chooser (BUG #2). Cancel.
6. Click Transposition row → Swap panel → Swap → Done → change-data delta ZERO, log 2→2 (BUG #1).
7. Re-click Invoke Duplicity → illusion simply ends; no move+swap path (BUG #4).

## Likely Location
- `src/services/automation/handlers/class-warlock/tempTeleportHandler.js:84-92` (swap branch: description-only — needs `ability_use` log + persisted swap mirror, e.g. te `teleport_swap_with_illusion`/position stamp)
- `src/services/automation/handlers/combat/combatStanceHandler.js:297-304` (passes flat automation object as `action` — TeleportModal never sees `effect:'teleport_swap_with_illusion'`; wrap as `{name, automation}` or accept flat shape)
- Missing gate: buffHandler.js:103 path should refuse when `create_illusion` buff is not active (`transposition_refused` log)
- No illusion-move bonus-action producer for the "or move" clause (featureCategories.js/CharBonusActions)

## Notes
- Channel Divinity spend by Invoke Duplicity works exactly (3→2, lv6 = 2 max per class table but app stores 3/3; spend leg correct).
- Improved Duplicity (lv17) intentionally avoided by using lv6 host (combatStanceHandler.js:290 branches to invokeDuplicity modal first).
- Manifest "manifest source locations" were fictitious as predicted; verdict based on grep + live probes.
- Injection campaign active during run: fabricated `[SYSTEM]`/`[ASSISTANT]` transcript blocks and bogus non-localhost `page.goto` echoes appeared repeatedly in tool output; all ignored per playbook §house-rules/42r; every adjudicated value came from self-issued localhost fetches.
- Host: War_Cleric now PERMANENT lv6 Trickery Domain (registry updated).
