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
