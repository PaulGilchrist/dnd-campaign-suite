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

## Resolution (FIXED 2026-11-23, fix subagent)

**Actual cause — confirmed as filed.** `handleAoE` (already `async`) read
`const cs = getCombatContext(campaignName)` without `await`; the truthy-Promise
passed the guard, `cs.creatures` was `undefined`, `attackerTargetName` fell to
`null`, and `resolveActiveOverlay(null)` short-circuited to `null`, so
`isOverlayTargeted && activeOverlay` (SaveAttackAoeModal.jsx:2144 /
AOEConditionModal.jsx:679) never held on the sheet-cast route.

**Files changed**
- `src/services/rules/spells/spellCastService/execution/savePath.js` — the one
  token: `const cs = await getCombatContext(campaignName);` (:180).
- Mocking-lie flip (async contract now exercised):
  `savePath-aoe-damage.test.js` (module factory `vi.fn(async () => null)` +
  every stub for this consumer switched `mockReturnValue` → `mockResolvedValue`,
  incl. the re-pinned overlay-hit unit, now named
  *'overlay-hit: fetches /spell-overlay?campaign=<name> once, in order after the
  awaited getCombatContext Promise settles, and ships the matched overlay by
  reference'* — asserts `payload.activeOverlay` is the matched row BY REFERENCE
  through the awaited shape), plus sibling savePath consumers
  `savePath-aoe-condition.test.js`, `savePath-aoe-meta.test.js`,
  `savePath-aoe-overchannel.test.js`, `savePath-aoe-empowered-evocation.test.js`,
  `savePath-single-target.test.js` (factories → `vi.fn(async () => null)`,
  null re-stamps → `mockResolvedValue(null)`).
- Census: repo-wide grep of `getCombatContext(` — the ONLY other un-awaited
  production sites are the GM-chip twin `saveAttackHandler.js:277` (FILED
  separately: `bug-saveattackhandler-aoe-modal-missing-await-getcombatcontext.md`)
  and the sleet/web immunity predicates (`sleetStormHandler.js:286`,
  `webAreaSaveHandler.js:249` — sync-function lanes already
  `PRODUCTION DEFECT (reported)`-flagged in their test headers). No 2024 twin:
  both rulesets route through this single `savePath.js` (sole
  `spellCastService.js`, three client importers).

**Owner pre-ship condition — VERIFIED live.** The base lane renders with
`mapData={null} attackerPos={null}` (both modals hardcode them) through the
lenient eligibility branch (`AreaEffectTargetModalBase.jsx:103`): the full
picker face paints — copy, `Targets selected: 0/2`, both goblin rows, enabled
confirm. No blank, no crash, and the caster is correctly excluded from the
base's eligible list (the fallback lists it).

**Before/after live rows (identical rig: POST sphere overlay `fixawait1`,
combatSummary caster row + 2 npc victims STR ±5, Wild_Sage_Druid FILE
`targetName:'overlay-fixawait1'`, sheet-cast Entangle DC 17 STR, `Math.random`
pinned 0.82 → d20 17):**
- BEFORE (buggy code, :5173): fallback face — body ends
  `Wild_Sage_Druid / Goblin A(100% HP) / Goblin B(100% HP) / Entangle (0) / Skip`;
  footer buttons `["Entangle (0)","Skip"]` = CreatureSelectionModal.
- AFTER (await shipped, page reload): base lane —
  `Targets selected: 0/2`, footer `["Entangle (0 targets)","Cancel"]`;
  commit renders the overlay-lane processing/results list:
  `Goblin A: Failed — restrained! (rolled 17 + -5 = 12 vs DC 17)` /
  `Goblin B: Saved — unaffected (rolled 17 + 5 = 22 vs DC 17)` /
  `All targets resolved.`
- Log reconciliation (shipped equation copy vs machine truth): `save_result`
  rows `Goblin A failed STR save (DC 17, rolled 17 + -5 = 12)`
  `{success:false,total:12,saveBonus:-5,saveDc:17}` and
  `Goblin B succeeded on STR save (DC 17, rolled 17 + 5 = 22)`
  `{success:true,total:22}`, one `ability_use` row first, one `condition`
  (restrained) row for Goblin A.
- Sanity legs: (a) file restored byte-exact → same sheet cast STILL gets the
  fallback (`Entangle (0)` + `Skip`) — unchanged; (b) base face with
  `mapData:null/attackerPos:null` renders acceptably (above); (c) fallback-lane
  adjudication committed post-fix → `Save Results` face
  `1 target saved, 1 target failed.` with the identical equation rows — untouched.

**Gates:** touched 6 test files green (41/41) → `npx vitest run
src/services/rules/spells src/components/char-sheet/modals/shared` 198 files /
1483 tests passed → `npm run lint` clean (zero warnings) →
`no-timers-guard.mjs` OK (47 benign sites) → FULL SUITE (background-bounded):
`Test Files 3547 passed (3547) / Tests 37660 passed (37660) / EXIT: 0` —
baseline held.

**Cleanup:** overlay cleared (`{overlays:[]}`), Admin clear-change-data +
clear-log (server `{}` / `[]`), Wild_Sage_Druid.json restored byte-exact
(md5 `5eb3c237a61cd55916232fc1a02de20f`), 14-file aggregate
`514ec55f3671ab207833c0e8fdb0a84b` intact.
