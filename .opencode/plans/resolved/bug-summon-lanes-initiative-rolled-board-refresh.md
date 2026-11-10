# Summon lanes reuse `initiative-rolled` as a board-refresh signal — mid-combat summons fire new-combat wipes only when the matching view is mounted

## Summary

Five summon lanes — `src/services/encounters/monsterSummon.js:345`, `src/services/automation/handlers/class-ranger/primalCompanionHandler.js:308`, `src/services/automation/handlers/spells/animateDeadHandler.js:169`, `src/services/automation/handlers/spells/createUndeadHandler.js:179`, `src/services/automation/handlers/spells/summonSpiritHandler.js:471` — add summoned creatures to the LIVE board (inheriting the caster's initiative, re-sorting, saving combatSummary) and then dispatch `window.dispatchEvent(new CustomEvent('initiative-rolled'))` purely to make the UI adopt the new cards. But `initiative-rolled` is the app's *new-combat reset* signal, and its consumers are all mount-scoped:

- `Initiative.jsx:626` listener (Initiative view mounted): clears `pendingOAs`, `_Vex_appliedTarget`, EVERY player's round flags (`clearPlayerRoundFlags`), Hunter's Mark concentration, dominated expirations.
- `useInitiativeEffects.js:433` listener (that character's sheet mounted): clears the character's concentration, ~20 buffs (Haste, Invisibility, Pass Without Trace, …), once-per-turn trackers, and `restoreRegenerateTargets` (Regenerate targets to full HP).
- `CharSummary.jsx:529` (sheet): clears Wild Magic Surge effects.
- `BlindnessDeafnessModal.jsx:210`: only while that modal is open.

Result: casting Animate Dead in round 4 while sitting on the caster's sheet breaks their concentration and free-heals regenerating creatures; doing it from the Initiative view hands the party back once-per-round resources and drops OA markers; doing it from the Log page lands as a pure addition (the rules-correct outcome). Same click, three rules outcomes, decided by which view is mounted. Window events are per-tab, so visitor tabs already always get pure-addition — the GM's own tab is the inconsistent one.

Filed from the resolved-file backlog of `resolved/bug-new-initiative-roll-pendingoa-drop-never-fires.md` (fix run 2026-11-10, commit b570aa359).

**OWNER DECISION (Paul, 2026-11-10): Option A — a mid-combat summon is a PURE board refresh. It must reset nothing.** Replace the five dispatches with `combat-summary-updated`, the existing benign refresh event already used for summon joins by `src/services/combat/summons/summonedCreatureService.js` (Initiative.jsx has a listener that adopts a changed combatSummary with zero clears).

## Steps to reproduce

1. In test-campaign, start a combat via EB Join (Initiative view). GET change-data baseline.
2. Arm a state that one of the listeners would wipe — e.g. seed `pendingOAs` (`POST /api/campaigns/test-campaign/pendingOAs` with a marker), and/or stamp `_Vex_appliedTarget`, and/or put a Hunter's Mark concentration on a creature via change-data.
3. While STILL on the Initiative view, trigger any summon lane (simplest: monster-card Summon action via `monsterSummon`, or the sheet lane for a Ranger host FeyRanger's Primal Companion).
4. Observe: the freshly-seeded `pendingOAs`/`_Vex_appliedTarget`/Hunter's-Mark vanish even though no new initiative was rolled (the summon stole the new-combat wipes).
5. CONTROL: clear state, re-seed, repeat the same summon from the LOG view (Initiative unmounted): the markers SURVIVE. Same action, different outcome per view — that variance is the bug.

## Expected behavior

A mid-combat summon lands its cards on the board (all tabs) and clears NOTHING: no pendingOAs drop, no player round-flag reset, no Hunter's Mark concentration break, no `_Vex_appliedTarget` clear, no concentration/buff wipes, no Regenerate full-heal, no Wild Magic Surge clear. Board adoption works from EVERY view (not just when Initiative happens to be mounted).

## Actual behavior

Wipes fire only when the matching view is mounted (matrix above); from other views the same dispatch silently no-ops.

## Likely location

Verified 2026-11-10 (grep census): the five producer dispatch sites listed in Summary. Consumer listeners: `Initiative.jsx:626-654`, `useInitiativeEffects.js:433`, `CharSummary.jsx:529`, `BlindnessDeafnessModal.jsx:210`. Benign-refresh precedent: `src/services/combat/summons/summonedCreatureService.js` dispatches `combat-summary-updated`, and `Initiative.jsx` (~:657) has a `combat-summary-updated` listener that adopts a changed summary by clone-compare with zero side effects.

## Suggested fix (owner-ratified Option A)

1. In all five summon lanes, replace `window.dispatchEvent(new CustomEvent('initiative-rolled'))` with `window.dispatchEvent(new CustomEvent('combat-summary-updated'))`. Mirror `summonedCreatureService.js`'s exact shape.
2. AUDIT edge 1 — first-summon/empty-board: if a summon lane ever CREATES the board (no existing combat), confirm the board still adopts from the Initiative view via the `combat-summary-updated` lane (and SSE for other tabs). If any lane needs a real new-combat seam there, use the explicit producer-side pattern (`sweepNewCombatClocks`/`clearAllPendingOas` at the producer, per b570aa359), NOT the window event.
3. AUDIT edge 2 — Primal Companion RE-transform (companion swap): verify the sheet's companion affordances (primalCompanionType/Alive are synced runtime keys) re-render via SSE/useSyncedState without the initiative-rolled dispatch; if the transform path legitimately re-rolls the COMPANION's own initiative, that is a targeted per-creature write already done in-handler — do not reinstate a global event for it.
4. Check the `skipDomEvents` dep in `monsterSummon` (tests suppress DOM events through it) — keep the dep contract, just change which event fires.
5. Dual-ruleset: the summon handlers are ruleset-shared; confirm no 2024 twin dispatch sites exist (grep census says no).
6. Update every existing test that asserts the old dispatch (the census: `animateDeadHandler.confirm.storage.test.js`, `createUndeadHandler.confirm.storage.test.js`, plus any listener-count probes) and add regression tests pinning: each summon lane dispatches `combat-summary-updated` and NOT `initiative-rolled`; and a mounted Initiative + seeded `pendingOAs`/round-flags scenario survives a summon untouched.

## Severity

Rules correctness / determinism: a mid-combat summon can silently break concentration, reset once-per-round economies, drop Hunter's Mark, retire OA markers, or full-heal Regenerate enemies depending solely on which view the GM's tab has mounted. Not corrupting HP state directly, but the Regenerate-to-full heal and once-per-round resets are real combat-economy corruptions on some lanes.

## Resolution

FIXED 2026-11-10 (owner-ratified Option A — a mid-combat summon is a PURE board refresh).

**What was wrong (confirmed, matching the filed guess):** the five summon lanes dispatched `initiative-rolled` purely as a board-adoption signal after pushing + sorting + persisting combatSummary. Live repro in test-campaign (Playwright, pre-fix): with the Initiative view mounted, curl-seeded `pendingOAs` marker + `_Vex_appliedTarget` were both EVICTED by a monster-card Summon (Galeb Duhr "Animate Boulders" via `.mc-overlay [data-kind="summon"]`) even though no new initiative was rolled; the identical `monsterSummon` lane pressed from the Encounters page (EB "View details" modal, Initiative unmounted) landed the same summons (Treant 1/2 @ caster-init −0.1) with both markers SURVIVING — the view-dependent variance is exactly as filed.

**Fix:** swapped the dispatch to `window.dispatchEvent(new CustomEvent('combat-summary-updated'))` (the exact bare-CustomEvent shape of the `summonedCreatureService.js` precedent) at all five sites:
- `src/services/encounters/monsterSummon.js` (kept the `deps.skipDomEvents` guard around it — dep contract unchanged)
- `src/services/automation/handlers/class-ranger/primalCompanionHandler.js`
- `src/services/automation/handlers/spells/animateDeadHandler.js`
- `src/services/automation/handlers/spells/createUndeadHandler.js`
- `src/services/automation/handlers/spells/summonSpiritHandler.js`

New-roll producers (`encounterToInitiative.js` ×2, `npcCombatService.addNPC`, `initiativeProcessing.js`, plus the CharSheet Battle-Master maneuver-on-initiative dispatch at `CharSheet.handlers.js` — a real re-roll of the roller's own initiative, reviewed and left as-is) and all four `initiative-rolled` consumers stay untouched. No `clearAllPendingOas`/`sweepNewCombatClocks` added to summon lanes (they are not new-combat seams — b570aa359's law untouched). Dual-ruleset audit: no 2024 twin dispatch sites exist (grep census re-run; the five handlers are ruleset-shared).

**Audit edge 1 (board creation):** `monsterSummon.js` is the ONLY lane that can create the board (`getCS(campaignName) || { round: 1, creatures: [] }`); the four sheet lanes refuse with an info-popup when `getCombatSummary` is null. Both adoption listeners early-return on a null cache, so pre-fix a created board was never same-tab-adopted by the window event either — propagation was and remains the `storage.set` full-store POST + SSE echo (`handleCombatSummaryCache`/`sortCreaturesForBoard` run at adoption in every tab). Live-proved post-fix: with no caster row and a cleared world, an EB-view preview summon still landed its cards and a later-mounted Initiative view rendered them. Note: the empty-board fallback is practically UNREACHABLE on a loaded tab — campaign-select re-seeds the 13-PC party board within ~2.5 s of any admin clear. No lane genuinely depends on the new-combat wipes; nothing needed the explicit producer-side seam pattern.

**Audit edge 2 (Primal Companion re-transform):** zero render dependency on the removed event. `primalCompanionType`/`primalCompanionAlive` are awaited `setRuntimeValue` writes (server + SSE echo; both hit the synced runtime store), and NO component subscribes to those keys for render (grep census in `src/components` = zero consumers — readers call `getRuntimeValue` imperatively at affordance press). The re-transform path (`handle` → companion not on board → summon modal → `confirmPrimalCompanionSummon`) is the same lane as the initial summon, so the swap covers it. Not drivable live (no test-campaign character carries the Primal Companion feature — FeyRanger is a Gloom Stalker) — pinned by the handler regression test instead.

**Logging law:** every lane's existing `summons` `addEntry` untouched; live-proved post-fix the `summons` row still lands (GET /log).

**Tests:**
- Updated census: `animateDeadHandler.confirm.storage.test.js`, `createUndeadHandler.confirm.storage.test.js` now pin exactly one bare `combat-summary-updated` and never `initiative-rolled`.
- New pins: `monsterSummon.test.js` (live-event press dispatches `combat-summary-updated` ×1 / `initiative-rolled` ×0, `summons` log still lands; `skipDomEvents` press dispatches nothing), `primalCompanionHandler.test.js` + `summonSpiritHandler.test.js` (×1/×0 event pins), `initiative-init-rolled-handler.test.jsx` (consumer side: with the same mounted view + seeded Hunter's-Mark board and a live `pendingOAs` bucket, `combat-summary-updated` writes ZERO clears and still ADOPTS the changed board — an npc row only on the event-time board renders; non-vacuous contrast: the SAME mounted listener still evicts on real `initiative-rolled`).
- `npx vitest run` targeted 6 files: 154/154 pass; touched folders (`src/services/encounters`, `.../handlers/spells`, `.../handlers/class-ranger`): 250 files / 3577 pass; `src/components/initiative`: 103 files / 748 pass. `npm run lint` clean (zero warnings); `no-timers-guard` OK (42 benign sites).

**Live re-verification (post-fix, test-campaign):** EB-join Galeb Duhr → curl-seed `pendingOAs` + `_Vex_appliedTarget` → Summon chip from the mounted Initiative card → markers SURVIVE (server GET), boulder cards land live in the mounted DOM (Galeb Duhr 19 → boulders 18.9 sorted right after the caster), `summons` log row present. Adjacent-flow sanity: a REAL EB Join (Wolf) with a live `pendingOAs` marker still DROPS it (b570aa359 producer-side law intact; the mounted-listener `_Vex`/round-flag/HM clears for genuine in-view re-rolls are unit-pinned by the contrast assertion above). Zero app console errors across the session; exit ritual closed-tab admin clears GET-verified `{}` / `[]`, `git status --porcelain public/campaigns/` empty.

---
*Filed 2026-11-10 from the backlog of resolved/bug-new-initiative-roll-pendingoa-drop-never-fires.md; owner decision (Option A) recorded same day.*
