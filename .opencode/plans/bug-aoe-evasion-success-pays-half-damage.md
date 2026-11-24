# AoE save-attack lane: successful save by an Evasion holder pays half damage (evasion fold starved)

## Summary
Casting Burning Hands (DEX save AoE) from the character sheet with an overlay armed resolves the target's saving throw with the Evasion doctrine declared on the prompt ("No damage on success, half damage on failure"), the save succeeds, and the Results face + real HP commit still charge HALF damage. The CLA-124/125 evasion fold never fires on this live lane.

## Steps to reproduce
1. In `test-campaign`, open Initiative; quick-spawn a Goblin (`+ Monster` → `.qms-search` "Goblin" → row select → `.qms-spawn-btn`).
2. Activate `battle-arena` (Maps → Activate) and open the map view; arm the Spell wand (`[aria-label="Spell"]`), keep Sphere / 20 ft, click the board to place (overlay landed at (10,10)). Cancel spell mode.
3. Back on Initiative, set the DivinationWizard card's target select to the `overlay-<id>` option (`Sphere (20ft)`).
4. Open the DivinationWizard sheet, press `Burning Hands` → `Cast Spell` (level 1) → Cancel the Soulstitch chooser.
5. The creature picker opens with the overlay auto-preselect (FeyRanger — the only token holder inside the sphere at (9,8) on battle-arena). Confirm (`Burning Hands (1)`).
6. Skip the Leading Evasion chooser; on FeyRanger's "Saving Throw Required" prompt press `Roll Save`, then `Done`.

## Expected behavior
FeyRanger (2024 Ranger lv17 — Evasion derived live; the prompt itself prints "Evasion: No damage on success, half damage on failure") who SAVES (rolled 13 + 8 = 21 vs DC 19) takes ZERO damage; Results row should read "Saved — takes 0 … (Evasion)".

## Actual behavior
- Save prompt face honestly showed `SAVE SUCCESS — Total: 21 vs DC 19 — d20 (13) + 8` and the Evasion note.
- Results face: `.abjure-result-success` row `FeyRanger: Saved — takes 4 Fire damage (rolled 13 + 8 = 21 vs DC 19, halved)`.
- Disk truth: `hp_change` row `FeyRanger takes 4 damage (85/89 HP)`; damage roll row `9 (3d6 + 5 [Empowered Evocation]) Fire → 4 final`. The prompt's own `save_result` row even reads "succeeded DEX save (DC 19, rolled 13 +8 = 21 — full success)" — annotation, verdict and payment contradict each other.

## Likely location
Confident on the data-starvation leg, guessing on the fallback flag.
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx:1678` derives the adjudication roster as `const characters = combatSummary.creatures.filter(c => c.type === 'player')`. Live census (2026-11-24): all 15 combatSummary player rows are minimal stubs (`name,type,currentHp,maxHp,initiative,targetName,concentration`) — ZERO carry `computedStats`.
- `src/services/rules/combat/evasionUtils.js` (header comment) explicitly names this CLA-119 starvation: cs stubs "never contain computedStats, so the fold was inert"; the module's remedy is full PlayerStats + preferring `detail.evasionActive` from the prompt roller. But `adjudicatePromptEvasion` (SaveAttackAoeModal.jsx:474-475) is called with the starved `characters`, and `detail.evasionActive` evidently does not reach it on this lane (the roller clearly COMPUTED evasion — the prompt note renders it — so the flag is lost between roller and Done-commit).
- Unit pins (`SaveAttackAoeModal.cla124-evasion.test.jsx`) feed full stats — the same mock-mask pattern the 2026-11-23 `getCombatContext` fixes just rooted out elsewhere.

## Suggested fix
First: trace the Done-commit path from SavePromptModal's result detail into `adjudicatePromptEvasion` and confirm whether `detail.evasionActive` is stamped by the roller (compare `useLoggedDiceRollEventHandlers.determineEvasion` convention cited in evasionUtils). Either propagate `evasionActive` into the result detail (cheap, matches "detail.evasionActive is preferred when present"), or thread the REAL roster (rulesFactory getPlayerStats / characters store) into `characters` at SaveAttackAoeModal.jsx:1678 instead of cs stubs. Re-ride the exact steps above; expect `→ 0 final` + `takes 0 Fire damage … (Evasion)` and an `evasion` rollType ledger row.

## Severity
Data integrity risk — every Evasion/Circle-of-Power holder silently over-pays damage on sheet-cast save AoEs; the UI actively promises the zero and then contradicts it.
