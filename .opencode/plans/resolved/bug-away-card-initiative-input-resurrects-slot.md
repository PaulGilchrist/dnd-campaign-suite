# Bug: Away (split-party) creature can hold its initiative slot back by simply typing in the card's initiative input

## Summary
Split-party law says an away PC "holds NO initiative slot" and its card "parks at the back of the board (initiative is wiped on split)". But the initiative input on an away card is never disabled or guarded: stamping it through the ordinary `handleInitiativeChange` → `setInitiative` lane writes initiative back onto the away row AND re-sorts the board with the legacy raw sort, pulling the away card out of its parked back position into the middle of the tracker. The store then holds `away: true` rows with live initiative values, contradicting the feature's own invariant and the audit text ("removed from the initiative tracker").

## Steps to reproduce
Start from a settled Initiative page in test-campaign with the 13-PC placeholder board:

1. Stamp initiative via the card inputs: AasimarTest = 20, ElderPaladin = 15, FeyRanger = 10 (blur each).
2. Click **Split Party** → untick **FeyRanger** and **HexWarlock** → **Apply**.
   - Verified correct here: store rows get `away: true, initiative: ''` and both cards park at the back with the Away badge.
3. **Face A (stale display on split):** look at FeyRanger's greyed card — its Initiative input still shows `10` even though the store says `''` (uncontrolled `defaultValue` input is not reset on split; the keyed row is moved, not remounted, so DOM value survives).
4. **Face A2 (stale display on rejoin):** reopen Split Party → re-tick FeyRanger → Apply. Store + audit row are correct (`initiative: '15'`, "rejoined the party — initiative set to 15 (end of the round)"), but the card input STILL shows the stale `9` until the page is reloaded.
5. **Face B (slot resurrection + un-parking):** on **HexWarlock**'s away card, focus the Initiative input, type `12`, press Tab to blur (no click needed — keyboard-only).
6. Wait for the write to settle; GET `/api/campaigns/test-campaign/change-data`.

## Expected behavior
Per `src/services/combat/creaturePresence.js` module law ("no held slot while separated", "AWAY rows strictly last"):
- Either the away card's initiative input should be disabled/read-only (the slot doesn't exist), or stamping it should first rejoin the creature (with the end-of-round semantics), or be refused with feedback.
- The away row must never carry a numeric initiative, and the away card must not reorder to the middle of the board.
- The split toggle should clear/reset the input's displayed value so it doesn't show a wiped slot.

## Actual behavior
- After step 2 the away card still *displays* initiative `10` while the store holds `''` (misleading GM bookkeeping).
- After step 4 the store holds `HexWarlock { away: true, initiative: '12' }` and `FeyRanger { away: true, initiative: '9' }` (9/10 apart — the 9 was a spinner click in my first probe, keyboard-only repro gives the typed value) and both away cards jumped to mid-board: order became `[AasimarTest 20, ElderPaladin 15, HexWarlock(away) 12, FeyRanger(away) 9, <present unrolled…>, …]`.
- Turn navigation still skips them (the presence filter holds), so the tracker doesn't walk onto them — but the board display, the modal's `(Init n)` annotation, and the store all now violate the documented invariant.

## Likely location
Confident: `handleInitiativeChange` in `src/components/initiative/createCreatureHandlers.js` (line ~276) has an `isLocalhost` gate but no presence gate, and `setInitiative` in `src/services/encounters/initiativeService.js` (line ~130) does a raw `creatures.sort((a,b) => b.initiative - a.initiative)` with no `isCreaturePresent` tie-break — unlike the sibling `sortCreaturesForBoard` that owns the "away strictly last" law. The stale display face is `InitiativeControl` in `src/components/initiative/CreatureCard.jsx` (uncontrolled `defaultValue={creature.initiative ?? ''}`, no `key` bump on presence change). Secondary: `maybeGrantThiefsReflexesSecondTurn` runs inside `handleInitiativeChange` before any presence check, so a Thief's-Reflexes holder who is away could also be granted a `(Second Turn)` row from a blurred card input.

## Suggested fix
- In `handleInitiativeChange` (or `setInitiative`): when the target row is a player with `away === true`, either no-op (optionally with a toast "rejoin first") or route through `applyPresenceChanges` semantics — and in all cases re-sort with `sortCreaturesForBoard` (present-first, away-last) instead of the raw initiative sort.
- Disable the input on away cards: pass `isAway` into `InitiativeControl` (`disabled={!isLocalhost || isAway}`) and/or key the input on `${creature.name}-${creature.away ? 'away' : 'here'}` so the stale `defaultValue` remounts to `''` when split.
- Add an away guard in `maybeGrantThiefsReflexesSecondTurn`'s call site (skip when the holder row is away).

## Severity
Data integrity risk — the feature's central invariant (no slot while away, parked last) is silently breakable by a single ordinary GM keystroke on the very card the feature just greyed out; stores can persist contradictory `away + initiative` rows that every future consumer must special-case.

## Resolution
FIXED 2026-11-08 (fix subagent). The black-box diagnosis proved correct on every point; live repro in test-campaign reproduced all faces before any code was touched.

**What was actually wrong (confirmed):**
1. `handleInitiativeChange` had only the `isLocalhost` gate — no presence gate — so a keyboard type+Tab on an away card wrote initiative back onto the wiped row, flipped the encounter phase, and reached `maybeGrantThiefsReflexesSecondTurn`, then persisted the contradictory `{away:true, initiative:'12'}` row (store-verified live).
2. `setInitiative` re-sorted with the legacy raw `b.initiative - a.initiative` sort (no away tie-break), un-parking the away card from last to mid-board (idx 2 of 13, live-verified).
3. `InitiativeControl` rendered an uncontrolled `defaultValue` input that never remounts on presence flips — split left the wiped `''` displaying the stale `10`, and a rejoin landing at `15` kept displaying the stale value until reload (both faces live-verified; store was correct in both cases).
4. Side-face confirmed: `PartyPresenceModal` annotated `(Init n)` for away rows (reads any non-blank initiative regardless of the away flag).

**Changes:**
- `src/components/initiative/createCreatureHandlers.js` — presence guard in `handleInitiativeChange` ahead of ALL writes (mirrors the sibling `!isLocalhost` gate idiom): an away target row is refused with a named `console.error` — no initiative write, no phase flip, and structurally the Thief's-Reflexes grant can no longer fire for a slotless holder (the unridden face closed too).
- `src/services/encounters/initiativeService.js` — `setInitiative` refuses away rows at the service layer (defense-in-depth) and both it and `rollNpcInitiative` now re-sort via `sortCreaturesForBoard` (present-first, away strictly last) instead of the raw sort — answering the exploration-map Priority-Target question: the raw sort is retired outright in both functions, same law as the mount-merge lane.
- `src/components/initiative/CreatureCard.jsx` — `InitiativeControl` takes `isAway`: input `disabled={!isLocalhost || isAway}` (a single-slot creature has no editable slot — matches the visitor-tab face where the input was already disabled), a rejoin-hint `title` on away cards, and the input is presence-KEYED (`away`/`present`) so the uncontrolled `defaultValue` remounts and re-syncs on every split/rejoin — both stale-display faces fixed without a reload.
- `src/components/initiative/PartyPresenceModal.jsx` — `(Init n)` annotation now only for present rows (legacy stale numerics can no longer masquerade as a held slot).
- Dual-ruleset: none of these modules has a 5e/2024 twin (presence is ruleset-agnostic) — nothing mirrored.

**Regression tests (all new pins fail pre-fix):**
- `createCreatureHandlers.away.test.js` — away stamp refused: initiative stays `''`, order unchanged, zero `storage.set`/`setCombatSummary`/`setSessionPhase`/Thief grant, named console.error; adjacent face: present-row stamp still lands and re-sorts with away parked last (real unmocked service).
- `initiativeService.test.js` — `setInitiative` away refusal + legacy-stale away row stays parked last on any stamp + `rollNpcInitiative` keeps away parked last when an NPC tops the board.
- `CreatureCard.away.test.jsx` — away input disabled for the localhost GM (+title), present stays enabled, split/rejoin remount re-syncs the displayed value to the store.
- `PartyPresenceModal.test.jsx` — `(Init n)` renders for present rows only.

**Verification:**
- Pre-fix live repro (test-campaign, dev :5173): stamp 20/15/10 → split FeyRanger+HexWarlock (store law correct) → stale `10` on the away card (Face A) → rejoin lands `15` in store, display stale `10` (Face A2) → keyboard-only `12`+Tab on HexWarlock's away card → store `{away:true, initiative:'12'}`, card mid-board idx 2 (Face B). Bug 100% reproduced.
- Post-fix live re-run of the exact repro: away cards park last with DISABLED inputs displaying `''` immediately on split; keyboard presses reach nothing; the handler lane re-probed with a trusted type+Tab after programmatically lifting the disabled gate → refused: store kept `initiative:''`, card stayed parked last, console error `[handleInitiativeChange] HexWarlock is away from the party — initiative slot not claimed (rejoin first)`; rejoin re-synced the input to `15` with no reload; the Split Party modal shows no `(Init 12)` leak. Adjacent sanity: present stamps still sort (18 lands between 20 and 15), Next navigation walks and still skips away rows, `party_split`/`party_rejoined` audit rows byte-unchanged.
- Tests: 4 targeted files 70/70 PASS; touched folders (`src/components/initiative` + `src/services/encounters` + `src/services/combat`) 357 files / 4905 tests PASS; full `npm run test:run` 3142 files / 34,130 passed + 3 expected-fail, exit 0; `npm run lint` zero warnings; `node .opencode/plans/no-timers-guard.mjs` OK.
- Exit ritual: change-data + log cleared via admin routes after closing the tab, GET-verified `{}` / `[]`; dev servers stopped.
