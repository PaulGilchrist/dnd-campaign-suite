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

## Resolution (FIXED 2026-11-23, owner-ratified flip: "Land it — intended lane")

**Cause confirmed.** `buildAoeModal` read the async `getCombatContext` without
`await`, so `cs` was a Promise, `getAttackerTargetName` resolved nothing, and
every `saveAttackAoe` payload from this producer shipped `activeOverlay:null`.
One-token fix applied at `saveAttackHandler.js:277` (mirrors siblings `:213`/
`:248`).

**Producer-lane correction (found during the demanded routing inspection).**
NO monster-card chip routes through `buildAoeModal`: `MonsterCardModal`'s
breath/save chips mount `SaveAttackAoeModal` directly with a self-assembled
`conePicker` prop set that carries no `activeOverlay` key at all (that lane
never had the overlay face authored — separate concern, not this bug). The
lane's ONLY live producer is the sheet automation-chip route
`useCharActionsAutomation` → `executeHandler` (type `save_attack`, area shape
+ damage) → `handle` → `routeSaveAttack` → `buildAoeModal`. Census of every
`save_attack` data row: the only ones passing the `isAreaShape && damage &&
!healExpression && !conditionInflicted` gate are Dragonborn **Breath Weapon**
(`races.json`/`2024 races.json` — `shape:'variable'` defaults to cone at
`handle:355`, or cone/line via `optionDetails`) and 2024 classes.json Warping
Implosion — the latter is stolen earlier by the `sorcery_points+restoreCost`
fingerprint (`index.js:692`). Repro therefore rode `DraconicDragon`
(2024 Dragonborn lv20, sheet `b.clickable` "Breath Weapon:" row) — a real chip
press on a live client, exactly the bug file's intent.

**Live repro BEFORE (verbatim face text).** Armed rig: sphere overlay
`aoefix1` (`POST /spell-overlay {action:'add', overlays:[{id:'aoefix1',
shape:'sphere', startGridX:10, startGridY:10, radiusFt:20}]}`); hand-rolled
3-row board (`POST /combatSummary {value:{…}}`: attacker row
`targetName:'overlay-aoefix1'` + `Victim One`/`Victim Two` `type:'npc'` with
`saveBonuses.dex ±5`); `DraconicDragon.json` top-level `targetName` carrier
(backup + byte-restore; md5 `430f2d3b82fca3de08169b3259ad5839`, 14-file
aggregate pin `514ec55f3671ab207833c0e8fdb0a84b` re-proved after restore).
Fallback face (footer `Breath Weapon (0)` + `Skip`, caster LISTED):

    Breath WeaponSelect creatures in the area of effect. Each must make a DEX saving throw (DC 15).…DraconicDragonVictim One(100% HP)Victim Two(100% HP) Breath Weapon (0)Skip

**Live AFTER fix (same press, base/overlay lane; `mapData:null/attackerPos:null`
face renders fine, caster excluded):**

    Select creatures in the area of effect. … Targets selected: 0/2Victim One(npc)Victim Two(npc) Breath Weapon (0 targets)Cancel

Victim ticks via `.abjure-target-name` spans → `Targets selected: 2/2`;
`Math.random=()=>0.82` pin around the `Breath Weapon (2 targets)` commit:

    Breath Weapon — ResultsVictim One: Saved — takes 18 Fire damage (rolled 17 + 5 = 22 vs DC 15, halved)Victim Two: Failed — takes 36 Fire damage (rolled 17 + -5 = 12 vs DC 15) Close

Shipped `saveEquationText` equation copy confirmed on the results rows. Log
reconciliation (this lane emits `ability_use`+`roll`+`hp_change`; NO
`save_result` rows):

    ability_use  Breath Weapon: Selecting 2 target(s) for save (DC 15 DEX)
    hp_change    Victim One takes 18 damage (12/30 HP) — Bloodied
    roll         DraconicDragon rolls Breath Weapon damage: 36 (4d10) Fire → 18 final
    hp_change    Victim Two takes 30 damage (0/30 HP) — Defeated
    roll         DraconicDragon rolls Breath Weapon damage: 36 (4d10) Fire

**Sanity control.** With the attacker cs row re-targeted to plain
`Victim One` (no `overlay-` prefix) the press still got the fallback face
(`Breath Weapon (0)` + `Skip`, caster listed) — fallback adjudication
unchanged for non-overlay-armed chips.

**Payload sufficiency (owner duty).** The chip payload ships
`action/playerStats/campaignName/shape/range/damage/damageType/saveType/saveDc/
dcSuccess/activeOverlay`; the base lane consumes `saveDc/saveType/range` +
live `getCombatSummary` and tolerates `mapData:null/attackerPos:null` exactly
as proven by `2b8a16573` on the shared `AreaEffectTargetModalBase`.

**Mocking-lie repair + regression pins (this consumer's tests).**
`saveAttackHandler.handle.test.js` already held the async contract
(`mockResolvedValue({})`); `saveAttackHandler.handle-2.test.js` had the lie —
bare `getCombatContext: vi.fn()` (sync `undefined`) — flipped to
`mockResolvedValue(null)` in `beforeEach`. Added a 3-test overlay-lane block
to `handle.test.js`; the identity pin (`seen[0] toBe cs` +
`payload.activeOverlay toBe overlay`, shipped by reference) was proven to BITE:
with the `await` temporarily removed it fails 1/18, restored it passes.

**Census.** Re-grep `getCombatContext(` across `src/` after the fix: the only
un-awaited production sites left are the two in-test-flagged sync-predicate
sites (`sleetStormHandler.js:286`, `webAreaSaveHandler.js:249` — untouched,
separate adjudicated change).

**Files.** `src/services/automation/handlers/combat/saveAttackHandler.js`
(+1 `await`), `saveAttackHandler.handle.test.js` (+overlay-lane block,
+spellOverlayService mock), `saveAttackHandler.handle-2.test.js` (mock flip),
`docs/test-setup-playbook.md` (§152 correction + §4 producer-lane bullet).

**Cleanup.** Overlays cleared (`{action:'clear'}`), change-data + log
admin-cleared two-pass (exit: cd `{}`, log `[]`, overlays `[]`, log/overlay
disk files absent), char file byte-restored, aggregate pin held.

**Gates.** Targeted handler tests 65/65; producer+consumer folders 156 files
/ 1694 tests green; `npm run lint` clean; `no-timers-guard` OK (47 benign
sites). Full suite: `Test Files 3547 passed (3547)` / `Tests 37663 passed
(37663)` / `EXIT:0` — zero-failure baseline held (+3 tests = the new
overlay-lane pins; the FAIL grep returns 0 matches).

