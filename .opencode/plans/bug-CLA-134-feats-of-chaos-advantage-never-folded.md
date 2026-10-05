# Bug CLA-134 — Feats of Chaos: advantage flag armed/consumed but NEVER folded into d20 roll computation

## Title
Feats of Chaos (Wild Magic Sorcery): the arm/consume/refuse/re-arm latch economy and the Wild Magic Surge side-clause all work, but the feat's SOLE mechanical benefit — Advantage on one d20 test before rolling — is never applied: computeD20Roll/contextBuilder never read `featsOfChaosActive`, so armed attacks log mode:"normal".

## Overview
Verified 2026-10-04, test-campaign, host AberrantSorcerer lv20 (major swapped Aberrant→Wild Magic Sorcery via Edit wizard step-7, reverted after).

## Expected Behavior
Activate → next d20 test rolled with Advantage, consumed; re-armed by casting a Sorcerer spell with a slot or Long Rest.

## Actual Behavior
1. PASS legs: activation popup "Advantage on next D20 test" verbatim; stamps `featsOfChaosActive=true`, `featsOfChaosUses=0`; second activation refused "no uses remaining"; consumption on plain weapon attack (globalFeats.js:566); Long Rest nulls uses/active (re-arm).
2. FAIL core: armed attack ledgers `Fire Bolt rolls:[4,16] mode:"normal" total:4` and `Unarmed Strike [15,7] mode:"normal"` — two d20 rolled but LOW taken; grep: only consumers of the flag are consumeFeatsOfChaos (clear) + surge re-arm; computeD20Roll/contextBuilder never read it → inert.
3. Spell attacks (Metamagic modal path) bypass the consume seam — flag persists after Fire Bolt spell-attack (secondary defect: consumption lane wrong-scope).
4. Surge side-clause PASS: lv1 Magic Missile (slots 4→3) auto-fired surge popup (lv20 Controlled Chaos double-roll "Roll 1: 40 / Roll 2: 82", `wms-overlay--no-dismiss`); effect logged + `wildMagicSurgeEffects` stamped; cantrip no-surge gate clean; slot-cast re-arm featsOfChaosUses=1 verified.

## Steps to Reproduce
1. test-campaign; Wild Magic Sorcery lv20 sorcerer (long rest first — CLA-382 pinned-0 override pattern).
2. Activate Feats of Chaos → attack → ledger mode:"normal" (bug).

## Likely Location
- `src/services/rules/core/d20RollComputation.js` / contextBuilder — fold `featsOfChaosActive` into forcedMode:"advantage" at roll time (single consumer) + consume there; move consume off plain-attack-only seam (globalFeats.js:566) so spell attacks consume too.

## Notes
- `wms-overlay--no-dismiss` blocks clicks until Choose+Done; lv14 Controlled Chaos = always double-roll (single mode unreachable lv20). Target-required spell w/ no enemies → full-roster dart modal (not error).
- Major REVERTED Aberrant Sorcery (disk GET); Admin cleared, GET-empty. Verified 2026-10-04.
