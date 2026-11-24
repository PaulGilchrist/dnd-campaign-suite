# Bug: GM-monster/automation AoE modal builder reads async `getCombatContext` without `await` — overlay lane dead on the chip-cast route too

## Summary

`src/services/automation/handlers/combat/saveAttackHandler.js:277` (inside the
already-`async` `buildAoeModal`) reads `const cs = getCombatContext(campaignName);`
— but `getCombatContext` (`src/services/rules/combat/damageUtils.js:41`) is
**async**. `cs` is a Promise, so `getAttackerTargetName(cs, playerStats.name)`
finds no creature row, `isOverlayTargeted` is false, and `activeOverlay` is
always `null` in the `saveAttackAoe` payloads this builder produces. The
`isOverlayTargeted && activeOverlay` overlay lane in `SaveAttackAoeModal.jsx:2144`
is therefore dead on THIS producer route as well, exactly mirroring the
sheet-cast route fixed by
`bug-spellcast-overlay-lane-missing-await-getcombatcontext` (resolved 2026-11-23).

## Evidence (code-confirmed 2026-11-23 during the savePath await fix)

- Same file, sibling builders `await` the call correctly: `:213` and `:248` both
  read `const cs = await getCombatContext(campaignName);`. Only `:277` drops it.
- The chain supports the await: `buildAoeModal` is `async` and already awaits
  `fetchSpellOverlays` at `:284`.
- Discovered by the repo-wide census demanded by the sheet-cast bug's fix
  ("every `getCombatContext(` call site must await/`.then`"): the only
  un-awaited call sites left in production code after the savePath fix are
  this one plus two immunity-check sites already flagged in-test (below).

## Expected behavior

`const cs = await getCombatContext(campaignName);` — an overlay-armed
monster/automation AoE press resolves the real `activeOverlay` and the base
picker lane (`AreaEffectTargetModalBase`) opens instead of silently degrading
to the `CreatureSelectionModal` fallback.

## Actual behavior

`activeOverlay:null` always on this route; overlay-armed chip casts always get
the fallback picker.

## Suggested fix

One token: add `await` at `:277`. OWNER-DECISION FLAG (same class as the
sheet-cast flip, NOT yet ratified for this lane): landing it FLIPS
overlay-armed chip-cast AoE modals from the fallback to the base picker face —
verify the chip route's payload carries everything the base lane needs and
that the owner accepts the behavior change before shipping.

## Live repro (not yet performed — needs the sheet-cast rig on a chip producer)

Arm an overlay target for a monster-capable attacker (`overlay-<id>` on its
combatSummary row), POST a sphere overlay, press a save-AoE chip that routes
through `buildAoeModal`; face discriminator per playbook: fallback footer
`"<Name> (N)"` + `Skip` vs base lane `"<Name> (N targets)"` + `Cancel` +
`Targets selected: N/M`.

## Related known siblings (already flagged in-test, do NOT double-file)

- `src/services/automation/handlers/spells/sleetStormHandler.js:286` and
  `src/services/automation/handlers/spells/webAreaSaveHandler.js:249` —
  same un-awaited pattern inside SYNC functions (immunity branches
  unreachable in prod); both carry `PRODUCTION DEFECT (pre-existing,
  reported)` flags in their test-file headers (`sleetStormHandler.areaSave.test.js`,
  `webAreaSaveHandler.areaSave.test.js` #1989 cross-ref). Fixing those two
  requires making the sync predicates async — a separate adjudicated change.

## Severity

Functional-latent (identical profile to the sheet-cast twin): no data
corruption — the fallback lane adjudicates correctly — but an authored UI lane
never renders live on this producer route.
