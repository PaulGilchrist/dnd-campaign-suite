# Race: scoped arm PATCH lands after the swap-clear full POST — new controller starts ARMED and the `control_arm_cleared` audit row is falsified

## Summary
The owner-law "a direct controller→controller swap never inherits the previous controller's armed target" (shipped `a97b47863`) holds for sequential writes, but is silently defeated by a cross-tab race: a concurrent armed-target write (scoped PATCH arm lane, coalesced ~100 ms) can land ~100 ms AFTER the swap's full-board POST, re-arming the row under the NEW controller. The swap audit row (`control_arm_cleared`) still fires and names the OLD stale arm as "cleared", so the log claims a clear that the live board contradicts. Live-confirmed MB-2 era PT4 was the open leg ("genuine two-tab race leg is unridden").

## Steps to reproduce
Start from a fresh dev pair (`CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' npm run dev`), two localhost GM tabs (plus optionally a LAN tab) all in **test-campaign** on Initiative, with a Goblin on the board (Encounters → search Goblin → `input[aria-label="Select Goblin"]` → Join Encounter):

1. In tab A (GM): on the Goblin card, `select[aria-label="Assign who controls Goblin"]` → `AasimarTest`, let it settle (~1 s).
2. In tab A: `select[aria-label="Goblin target"]` → `AasimarTest` (GET `/api/campaigns/test-campaign/change-data` → cs Goblin row `targetName:"AasimarTest"`, `controller:"AasimarTest"`).
3. Open tab B (second GM tab, same campaign, Initiative). Verify its Goblin card mirrors `arm=AasimarTest, ctrl=AasimarTest`… (set tab B's control select to `HeroesFeastBard` first and let it settle so the two tabs are synced with ctrl=HeroesFeastBard, arm=AasimarTest).
4. Fire the race from Playwright (or two humans): in tab B select control `HeroesFeastBard → AasimarTest` (one gesture) while at the SAME moment tab A changes the Goblin target select `AasimarTest → FeyRanger`.
5. Wait 4 s. GET change-data and the log.

## Expected behavior
Per the shipped swap law (unit-pinned in `createCreatureHandlers.control.test.js`): after any direct A→B swap the Goblin row carries NO `targetName` (key ABSENT) and the new controller's card opens unarmed (`value:''`).

## Actual behavior
Both reproductions ended with BOTH writes landed and the arm alive under the new controller:
- Race 1: final cs row `controller:"AasimarTest"`, `targetName:"FeyRanger"`; both tabs' arm selects live-render `FeyRanger`; log tail: `control_assigned` + `control_arm_cleared` — "Goblin handed directly from HeroesFeastBard to AasimarTest — armed target **AasimarTest** cleared on the handoff (the new controller starts unarmed)" — yet the live board is armed on FeyRanger.
- Race 2: final cs row `controller:"HeroesFeastBard"`, `targetName:"HexWarlock"`; same audit pattern, cleared-row naming the stale `FeyRanger`.
- Practical face: a LAN visitor tab whose `mc-overlay` was open on the Goblin showed `armValue:"HexWarlock"` — the delegated device really does start armed.
- Wire capture: the swap's full-board `POST /api/campaigns/test-campaign/combatSummary` fired at T+0 ms (composed from tab B's pre-race mirror), the arm's scoped `PATCH` (same bucket, name-keyed record merge) landed at T+107…109 ms and merged its field into the already-swapped board. Server merge doctrine (`campaigns-changedata.js` mergePatchFields) is honored — neither write errored; the law only lives in the client handler, so the late PATCH re-arms freely.

## Likely location
Confident on the lane, guessing on the best guard point:
- `src/components/initiative/createCreatureHandlers.js` — `handleControllerChange` writes the full board via UNGUARDED `storage.set('combatSummary', combatSummary, campaignName)` (no `baseVersion`; ~L453), while the arm lane at ~L385 uses coalesced `storage.patch('combatSummary', {creatures:[{name, targetName}]})`. Cross-tab there is no ordering/serialization — the server just applies whichever write arrives last per-field-merge on top of whichever full replace arrived before it.
- `server/routes/campaigns-changedata.js` PATCH merge lane has no concept of the swap law.

## Suggested fix
Decide which half of the law is authoritative:
1. Cheap: on echo adoption, any client rendering the target select re-validates — if the row's `controller` stamp CHANGED since the arm write was issued (or simply: if the adopted board's controller differs from the arming context's expectation), disarm locally and re-derive (`value:''`). This keeps the VISUAL law ("the card opens unarmed") true per-device even under the race.
2. Stronger: move the swap-clear to the merge lane — the server PATCH branch could drop `targetName` for a record when the patcher's `baseVersion`/seen-controller is stale, which means the arm lane needs to carry the board version it armed against (POST lanes already have the `baseVersion`/409 doctrine to copy).
3. Also consider stamping `boardVersion` on the control-write so a stale full POST at least 409s (this race's POST was NOT stale for the arm — it was merely early — so versioning alone does not close it; the echo-side re-validation in (1) is the honest closer).
Investigation needed: read how App.jsx `applyStoreUpdate` adopts `change-<c>-combatSummary` echoes to find where a controller-delta hook could disarm.

## Severity
Minor-to-moderate race (data integrity, silent): ~100 ms window, needs two writer devices clicking at the same moment, but the outcome directly contradicts an owner-ruled invariant AND leaves a falsified audit row (`control_arm_cleared` claiming a clear that didn't stick). Not a crash; no other data lost. The MB-2 "sequential swap face" is honestly fixed — this is only the concurrent leg (PT4).

## Resolution
FIXED 2026-11-12 (fix run) — option 2 from "Suggested fix" (server-side awareness) was the honest closer, not the echo-side re-validation the bug file leaned toward (option 1). Reasoning: the law's authoritative half is **board truth + audit consistency** ("after a direct swap the row carries NO `targetName`, and the `control_arm_cleared` row must never contradict the board"). An echo-side local disarm would have left the SERVER row armed — every future full-board POST would resurrect the stale arm, the visitor's `mc-overlay` render truth stays fed by the armed row, and the audit keeps lying to anyone reading change-data. So the swap/release wins server-side:

1. **`src/components/initiative/createCreatureHandlers.js` — `applyTargetSelection`**: a DELEGATED row's scoped arm PATCH now declares the controller context it was issued against — the record becomes `{name, targetName, seenController}` (e.g. `seenController:"HeroesFeastBard"`). GM/PC rows (no delegated controller at issue time) ship the exact legacy bytes — deliberately permissive so the blessed first-time-assign law ("an existing arm SURVIVES the first assign") keeps holding even under the race, and legacy unstamped writers merge byte-identically.
2. **`server/routes/campaigns-changedata.js` — new `dropStaleArmWrites`** in the PATCH lane (beside the merge doctrine): strips the wire-only `seenController` (never persisted) and, when the stored row's `controller` differs from the seen stamp at arrival time, drops that record's `targetName` — the row stays exactly as the swap POST left it (key ABSENT). Named server-log line (`PATCH combatSummary (<c>) dropped stale arm write(s) for: …`) plus response field `staleArmDropped:[names]` follow the lane's existing never-silent-success doctrine (applied/skipped). The full-board echo then re-derives every tab's arm select to `''`, so the VISUAL law holds too without a client-side guess, and the audit row's claim finally matches the board. The `null`-seen pass is exempt (first-time-assign face). The coalesced burst (multi creature records) is handled per-record: only the context-stale record loses its arm.

Ordering analysis (why this closes the race in BOTH interleavings): PATCH-first → applies against the still-old controller, then the swap's full-POST REPLACES the board with its arm-free composition → unarmed; POST-first (the 2/2 observed face, +107…124 ms) → seen stamp is stale → targetName dropped → unarmed. Node handles each request synchronously check-then-set, so there is no intra-handler interleaving.

### Verification
- **Live re-run of the exact repro (fresh dev pair, two localhost GM tabs, test-campaign, Goblin EB-joined)** — race 1 (swap HFB→AasimarTest × arm→FeyRanger): wire POST@+25 ms / PATCH@+124 ms carrying `seenController:"HeroesFeastBard"`; final cs row `controller:"AasimarTest"`, `targetName` key **ABSENT**, no stamp leak; BOTH tabs' arm selects live-render `''`; log tail `control_assigned` + `control_arm_cleared` now TRUE against the board; server log named the drop. Race 2 (reversed: swap AT→HeroesFeastBard × arm→HexWarlock) — same honest end state (2/2 faces).
- **Adjacent faces re-ridden live:** sequential swap clears (key ABSENT), sequential delegated arm (matching context) LANDS, release strips controller+arm (key ABSENT) with the `control_released` row, and the blessed GM-pre-arm → FIRST-TIME assign face keeps the arm (`targetName` survives, no extra clear row).
- **Tests:** new `server/routes/campaigns-changedata.combatsummary-stale-arm.test.js` (7: swap-drop, release-drop, matching-context-apply, explicit-unarm apply, null/absent-seen permissive + legacy bytes, per-record burst granularity, neighbours+scalars survive) and `src/components/initiative/createCreatureHandlers.arm-race-context.test.js` (6: stamp on delegated arm/unarm/FF-confirm lane, legacy bytes for GM/PC rows, unknown creature inert). The unit-pinned swap contract `createCreatureHandlers.control.test.js` unchanged and passing. Folder runs: `server/routes/**` 1549/1549, `src/components/initiative/**` + storage 828/828. `npm run lint` 0 warnings; `npm run guard:no-timers` OK.
- **Session hygiene:** ride tabs closed, closed-tab two-pass API clears → change-data `{}` + log `[]` (zero rehydrations), overlays `[]` (none seeded), no monsters left joined, disk change-data/log files absent.
