# Bug: sheet-cast AoE overlay lane is live-dead — `savePath.js` calls async `getCombatContext` without `await`

## Summary

`src/services/rules/spells/spellCastService/execution/savePath.js:180` reads
`const cs = getCombatContext(campaignName);` — but `getCombatContext`
(`src/services/rules/combat/damageUtils.js:41`) is **async** (every one of its
~15 other consumers awaits or `.then()`s it). `cs` is therefore a Promise: the
truthy check passes, `cs.creatures` is `undefined`, `attackerTargetName` is
`null`, `resolveActiveOverlay` short-circuits (`overlayTargetId(null)` → null)
and **`activeOverlay` is always `null`** in the `saveAttackAoe` / `aoeCondition`
sheet-cast modal payloads. The `isOverlayTargeted && activeOverlay` overlay lane
(`AreaEffectTargetModalBase` picker) in `SaveAttackAoeModal.jsx:2144` /
`AOEConditionModal.jsx:679` NEVER opens on a live sheet cast — every
overlay-armed AoE cast silently lands on the `CreatureSelectionModal` fallback
lane.

## Steps to reproduce (live-verified 2026-11-23 during the brace-literal fix)

1. `POST /spell-overlay?campaign=test-campaign` a valid sphere row (id `X`).
2. Seed a combatSummary whose caster row carries `targetName:'overlay-X'`.
3. Give the caster's character FILE a top-level `targetName:'overlay-X'`
   (the only carrier that reaches `playerStats` — `rules.getPlayerStats` clones
   the file into stats; no runtime lane writes it).
4. Sheet-cast Entangle on Wild_Sage_Druid → the modal footer renders
   `Entangle (0)` + **`Skip`** = the CreatureSelectionModal fallback, NOT the
   base lane (the base shows **`Cancel`** + `Targets selected: N/M`).
5. A/B proof: adding `await` to line 180 in the live dev source (Vite serves it
   immediately) and repeating steps 1–4 flips the SAME rig to the base lane
   (`Cancel`, renderBody picker, overlay-lane processing rows) — cast adjudicates
   identically.

## Why the suite doesn't catch it

The unit lane mocks `getCombatContext` with a SYNC return (`vi.fn(() => ({creatures:[…]}))`),
so `savePath-aoe-damage.test.js`'s find-by-id leg ("fetch fired only past the
prefix gate") reads true against a shape the browser can never produce.

## Expected behavior

`const cs = await getCombatContext(campaignName);` — an overlay-armed sheet cast
resolves the real `activeOverlay` and the overlay-targeted picker lane opens
(the lane `SaveAttackAoeModal.overlay-auto-select`/`AOEConditionModal.overlay`
unit tests were written for).

## Actual behavior

`activeOverlay:null` always; the base lane is dead code on the sheet-cast route;
users only ever get the fallback picker (whose overlay auto-select twin
`getCurrentOverlayTarget` works — it uses the SYNC `getCombatSummary` cache —
which is why the gap went unnoticed).

## Suggested fix

Add the `await` (one token). Re-pin one overlay-hit unit with the mock returning
a PROMISE so the async contract is actually exercised. NOTE (owner-decision
flag): landing the fix FLIPS overlay-armed sheet casts from the
CreatureSelectionModal fallback to the `AreaEffectTargetModalBase` picker face —
verify both modals' base lanes render acceptably with `mapData:null /
attackerPos:null` (the lenient `if (!mapData || !attackerPos) return true`
eligibility branch, `AreaEffectTargetModalBase.jsx:103`) before shipping.

## Severity

Functional-latent: no data corruption (the fallback lane adjudicates correctly;
range/overlay auto-select still feeds via `getCurrentOverlayTarget`), but an
entire authored UI lane never renders live and its unit coverage runs against a
mock shape production can't produce. Found incidentally while reproducing
`bug-aoe-condition-results-row-brace-literal-leak` (2026-11-23) — that face is
only reachable through THIS lane (temp `await` shim).
