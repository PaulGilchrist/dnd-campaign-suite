# Bug: attack result popup over-reports pre-hit HP on lethal blows ("HP: 10 → 0" for a 7 HP goblin)

## Summary
The sheet attack result popup builds its "HP: old → new" line as `targetCurrentHp + finalDamage`.
When the killing blow deals more damage than the target had left, the clamp at 0 makes that
formula exceed the true pre-attack HP, so the popup shows phantom hit points the target never
had (e.g. a 7/7 goblin killed by 10 damage renders `HP: 10 → 0`). The ledger itself is honest —
the `hp_change` row for the same hit reads `delta:-10, currentHp:0, maxHp:7`.

## Steps to reproduce
1. In test-campaign, join a Goblin via Encounter Builder (aria-exact `Select Goblin` →
   `Join Encounter`). Goblin row is 7/7 HP (verified by `GET /api/campaigns/test-campaign/change-data`).
2. On the Initiative view, arm ElderPaladin's card target-select to `Goblin`
   (`[data-testid=target-select]`).
3. Open the ElderPaladin sheet and press the `Longsword` action row (`div.left.clickable`
   in `div.attacks`); confirm the to-hit stage (**Done**) so the damage leg rolls.
4. Read the damage stage popup line (any roll ≥ 7 — EP's row is `1d8+5 slashing + 1d8 radiant`,
   minimum 7, and the witnessed roll was 10).

## Expected behavior
The popup transition should read `(pre-hit HP) → (post-hit HP)`, e.g. `HP: 7 → 0` for a
7/7 goblin (clamped), matching the `hp_change` ledger row for the same hit.

## Actual behavior
Witnessed live 2026-11-16: `10 damage applied to Goblin — HP: 10 → 0` while the goblin was at
7/7 pre-attack (cs row bytes confirmed `currentHp: 7, maxHp: 7` immediately before the press;
GET immediately after shows `0/7`). The old-HP figure equals post-hit HP + damage (0 + 10),
not the true 7 — the 3 points of overkill damage appear as extra phantom HP.
Any non-lethal hit reads correctly (no clamp), so this misreports on kills only.

## Likely location
Confident — literal formula at the render sites:
- `src/components/char-sheet/DiceRollResult.jsx:457,459` (and :796 for the combined
  primary+secondary variant): `HP: ${targetCurrentHp + finalDamage} → ${targetCurrentHp}`.
`targetCurrentHp` is the ALREADY-clamped post-hit value; reconstructing `old` by adding
`finalDamage` ignores the `Math.max(0, …)` clamp applied in `applyDamage.js:485/504`.

## Suggested fix
Thread the true pre-hit HP (or the clamped `actualDamageTaken`) to the result panel instead
of reconstructing it: the damage pipeline already returns `{ oldHp, newHp, actualDamageTaken }`
(`applyDamage.js:498/517`) — surface `oldHp` on the attack-result state (wherever
`targetCurrentHp` is sourced) and render `${oldHp} → ${targetCurrentHp}`. Alternatively render
`${targetCurrentHp + actualDamageTaken}` if `actualDamageTaken` is available at the popup.

## Severity
Minor UX issue — transient popup misreport only; the persisted ledger (`hp_change`) and bucket
are byte-honest. But per the close-but-not-exact law, a transition line that cannot have been
true (target never held 10 HP) is a defect.

## Resolution
FIXED 2026-11-16 — root cause confirmed as filed: the popup rebuilt pre-hit HP as
`targetCurrentHp + finalDamage`, but `applyDamage.js` clamps HP at 0 (`Math.max(0, oldHp - damage)`),
so overkill damage resurfaces as phantom HP on kills.

**The fix:** the damage pipeline already returns the truth (`applyDamage.js` → `{ oldHp, newHp, … }`).
The fix threads that true pre-hit HP to the popup as a new `targetOldHp` byte (exact sibling pattern:
placed line-for-line next to every existing `targetCurrentHp: applyResult?.newHp`), and the three
defective render sites in `DiceRollResult.jsx` (primary line, reduced-damage line, combined
primary+secondary row) now render `${targetOldHp ?? targetCurrentHp + finalDamage} → ${targetCurrentHp}`.
The additive reconstruction survives ONLY as the fallback for feeds that never applied damage
(immunity popups where `finalDamage` is 0, and pre-apply fallbacks), where both sides of the
transition are already the current value — the existing additive byte-pins
(`DiceRollResult.combatDisplay/.secondaryDamage.test.jsx`) hold unchanged.

Feed sites threaded (each one line, mirroring its neighbor):
- `src/hooks/combat/handlers/handlePlainDamage.js` (`applyPopupApplyResult` — the witnessed sheet lane)
- `src/hooks/combat/attackPostProcessing.js` (graze + potent-miss builders)
- `src/hooks/combat/handlers/handleAutoMiss.js` (potent half popup)
- `src/hooks/combat/handlers/handlePlayerSaveDamage.js`
- `src/hooks/combat/handlers/handleNpcSaveDamage.js` — NOTE the leg-order asymmetry found while
  threading: this lane applies the SECONDARY leg BEFORE the primary, so the true pre-hit HP is the
  secondary apply's `oldHp`; `rollAndApplySecondarySaveDamage` now also returns `secondaryOldHp`
  and the caller overrides `targetOldHp` on dual-damage rows.
- `src/hooks/combat/saveProcessing.js` (primary-first order — the merged secondary fields keep the
  primary feed's `targetOldHp`, which is correctly the pre-both-legs value; builder split
  `resolveSavePopupTargetMaxHp` added to stay under the complexity-15 ceiling)
- `src/hooks/combat/useLoggedDiceRollSaves.js` + `useLoggedDiceRollEventHandlers.js`
- `src/services/automation/handlers/class-other/giantAncestryUtils.js` (+ `applyAncestryDamage`
  returns `oldHp`; the 6 popup call sites in `giantAncestryDispatch.js`/`giantAncestryTraits.js` pass it)

Deliberately NOT touched: the healing transition line (`HealOutcomeNotice`) shows the same
reconstruction shape and looks suspect on overheal clamps, but its `targetCurrentHp` semantics
differ (feed sites resolve `applyResult?.newHp` from healing) — filed as an ADJACENT FINDING for
the orchestrator to triage into its own bug file, not silently folded into this fix.
`empoweredSpellService.js` carries `targetCurrentHp` on its result payload but that lane renders
no HP transition (checked `EmpoweredSpellResult`), so no byte added there. Dual-ruleset: the popup
lane is ruleset-shared (`applyDamage.js` is the single implementation for both 5e and 2024), so no
2024 sibling module needed a parallel change.

**Verification:**
- Live repro (pre-fix, :5173, test-campaign): Goblin joined via Encounter Builder at 7/7, ElderPaladin
  card target-select armed `Goblin` (cs GET confirmed), sheet `Longsword` row → to-hit Done →
  damage stage read `12 damage applied to Goblin — HP: 12 → 0` (5 phantom HP; ledger honest
  `delta:-12, currentHp:0, maxHp:7`).
- Live re-verify (post-fix): same rig re-armed, Goblin revived 7/7 via scoped cs PATCH — killing blow
  of 17 now reads `17 damage applied to Goblin — HP: 7 → 0`, matching the `hp_change` row
  (`delta:-17, currentHp:0, maxHp:7`). Overkill clamp path exercised (10 overkill).
- Adjacent sanity (non-clamp): Goblin bumped 30/30, honest hit of 16 reads `16 damage applied to
  Goblin — HP: 30 → 14` — no regression to non-lethal hits. Console 0 errors / 0 warnings.
- New regression test `src/components/char-sheet/DiceRollResult.hpTransition.test.jsx` (5 tests)
  pins: threaded oldHp on primary/reduced/combined rows, non-clamp exactness, and the additive
  fallback when no `targetOldHp` is fed.
- `npx vitest run src/components/char-sheet src/hooks/combat src/services/automation/handlers/class-other`
  green (three giantAncestry popup-byte-pins updated to carry the new honest `targetOldHp: 20` byte —
  expected census bytes, not behavior failures); `npm run lint` clean (zero warnings);
  `node .opencode/plans/no-timers-guard.mjs` OK.
- Exit: test-campaign change-data `{}` + log `[]` GET-verified after headless Admin clears; `public/`
  porcelain-empty; dev pair left running.

