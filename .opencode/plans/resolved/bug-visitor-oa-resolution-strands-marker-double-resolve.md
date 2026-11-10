# Delegated-visitor OA resolution writes rolls/logs to the shared store but its `pendingOAs` marker clear is 403-refused — the stale marker re-arms the chip and the same provocation resolves TWICE

## Summary

When a LAN visitor who controls a monster via 🎮 delegation presses its `Opportunity Attack on <mover>` chip, the attack rolls and its log/hp_change rows land on the shared store (visitor POSTs succeeded), but the visitor's clear of the shared `pendingOAs` bucket is refused with **403** (`DELETE/POST /api/campaigns/test-campaign/pendingOAs → 403` visible in the visitor tab console). The marker therefore survives resolution: the chip live-re-mounts on the GM's card, and a second press (by the GM, whose write succeeds) resolves the SAME provocation a second time — violating the documented one-charge law ("the resolution press consumes the marker"; `MonsterCardModal.jsx consumeOpportunityAttackContext`, and the chip's own docstring "a normal press is a zero-write no-op; a pending-OA press … consumes the marker").

## Steps to reproduce

1. In test-campaign, EB-join Wolf (+ any second monster) so a `monsterIndex` board is live; place a `gb-stack`-style active map (map-active state irrelevant — tokenless OA markers work off markers). Arm enforcement `{mode:'on',turnLock:false,actionEconomy:false,movementBudget:false,opportunityAttacks:true}`.
2. Curl-seed an OA marker: `POST /api/campaigns/test-campaign/pendingOAs {value:{Wolf:{defender:'Wolf',mover:'ElderPaladin',promptId:'<pid>'}}}`.
3. On the GM tab (localhost:5173, Initiative view) delegate Wolf: `[data-testid=control-select]` on the Wolf card → `AasimarTest`.
4. Open a LAN visitor tab (`isolatedContext:'lan'`, `http://<en0-ip>:5173`), select test-campaign, select character AasimarTest, go to Initiative, open Wolf's card (`img.avatar-image[alt="Wolf"]` — trusted click after `scrollIntoViewIfNeeded`). The `oa` chip renders: `Opportunity Attack on ElderPaladin`.
5. Press the chip on the VISITOR tab. Popup shows Bite HIT; log gains `automation` ("Wolf makes an opportunity attack against ElderPaladin…") + `roll` + `hp_change` rows — all from the visitor's writes.
6. GET `/api/campaigns/test-campaign/change-data` → `pendingOAs` STILL contains the Wolf marker. Visitor console shows `Failed to load resource: 403 … /api/campaigns/test-campaign/pendingOAs`.
7. On the GM tab, open Wolf's card → the chip is back/present → press it → SECOND `automation` + `roll` rows for the same provocation. (Only now, GM-origin, does the marker evict.)

Live-proved 2026-11-10 (run GB): visitor press rolled `d20 18 +4 = 22` (HIT, hp_change delta 0 only because ElderPaladin's runtime row was at 0 threshold — unrelated rig detail), marker still present afterwards; GM re-press rolled a second `Bite 7 (d20 3+4)`; marker then ABSENT. Direct origin probe from the LAN tab (same session): `POST pendingOAs {value…}` → 200, `DELETE pendingOAs` → 403 `Access denied: GM-only feature`.

## Expected behavior

Either (a) the visitor's OA resolution fully lands — including the `pendingOAs` eviction (the marker is shared-table state, same class as the roll/log writes the same press already performs), or (b) the visitor press is refused ENTIRELY with a visible error and writes nothing. A half-applied resolution (attack committed, marker stranded) creates a double-charge-free double-attack: two OAs for one provocation, one reaction spent.

## Actual behavior

As per steps: shared rolls/logs land; `pendingOAs` clear 403s; marker survives; chip re-mounts cross-tab; second resolution possible.

Secondary (uncertain) observation from the SAME first press: the visitor's roll row logged `mode:"normal"` with `rolls:[18,11]` (two d20s, total kept the higher 18) and the popup rendered both "Advantage" and "Disadvantage" lines, while the GM's second press on identical state rolled a single d20. Wolf's only conditional-advantage trait is Pack Tactics (needs an ally within 5 ft — board was tokenless/lenient). Per playbook §82 mode is the only adv/dis truth, so `mode:"normal"` + 2d20 keep-high is internally inconsistent. Not reproduced on the GM face; may be a visitor-context lane (stale mirror or lenient Pack Tactics pass on the visitor store) — flagging with bytes, needs a code-side look before a second bug file.

## Likely location

**ROOT-CAUSED + live-pinned 2026-11-10 — a route CAPTURE, not a pendingOAs gate.** `server/routes/campaigns-character.js:268` mounts `DELETE /api/campaigns/:campaign/:file` (character-file deletion, GM-only) as a WILDCARD single-segment route, and runs `refuseUnlessGm` (line 269) BEFORE the `if (file === 'log' || !file.endsWith('.json')) return next();` fall-through (line 272). Since `campaigns-character` is mounted before `campaigns-changedata` (server.js; AGENTS route-order law), a visitor-originated `DELETE /api/campaigns/:campaign/<anyKey>` is swallowed by the character-file guard with 403 `Access denied: GM-only feature` — it never reaches the change-data router's own ungated DELETE handler (which localhost deletes reach via `next()`, explaining why GM clears work). Probes: visitor-origin `POST` + `DELETE` on an arbitrary fresh key `gb-capture-probe` → POST 200 / DELETE 403 (same split as `pendingOAs`); POST never hits a colliding route.

BLAST RADIUS (structural, from the capture mechanism): **every** visitor/PC-device change-data DELETE 403s silently — `pendingOAs` marker clears (this bug's double-resolve), and the `savePrompt-*` drain-to-evict lane (`deleteRuntimeKey`, the §savePrompt drain precedent), meaning a real player's own resolved prompt key can strand server-side and REPLAY as a ghost overlay on their next connect (the duplicate-overlay replay law). Only the pendingOAs double-resolve is live-proved end-to-end; the prompt consequence is flagged as a structural sibling, worth one live face in the fix-verify.

## Suggested fix

Reorder the guard in `campaigns-character.js` DELETE: fall through FIRST (`if (file === 'log' || !file.endsWith('.json')) return next();`), THEN `refuseUnlessGm` for actual `.json` character files. One-line move restoring the intended authority split: character-file deletes stay GM-only; every change-data key delete behaves like POST already does (shared runtime store, CAMPAIGN_LOCK-gated) — which delivers the owner's Option A without inventing a new gate. Surface a toast on marker-clear failure regardless (silent-failure hygiene). Add regression pins: (1) visitor DELETE of a change-data key lands + null-echo evicts every tab; (2) visitor DELETE of a `<Name>.json` still 403s (guard preserved); (3) two-context test for this bug: visitor OA press ⇒ GET `pendingOAs` evicted, GM chip un-mounts via echo, reaction single-charge.

## Severity

Broken feature / rules-economy corruption — a shared reaction can be resolved once per tab that sees the stale marker (reaction spend is one, attacks are N); the visitor side also fails silently, so the GM has no signal the second chip is phantom.

## OWNER RULING (Paul, 2026-11-10): Option A — make the marker clear visitor-writable; the delegated resolution must be atomic

A delegated device may run the creature's card end-to-end (roll, target, saves, AND the shared-marker clear). The fix should make the `pendingOAs` DELETE lane behave like the writes the same press already performs (same-class shared-table combat state — consistent with the ratified delegation doctrine and the intentional visitor-writability of `/spell-overlay`), keeping CAMPAIGN_LOCK as the only gate. Keep the fail-loudly requirement from Suggested fix (toast/feedback on clear failure) so a future split gate can never strand a marker silently again. Pin the two-context regression: visitor press ⇒ GET `pendingOAs` evicted + GM tab chip un-mounts via echo; reaction remains single-charge across devices.

## Resolution

FIXED 2026-11-10 (fix run). The root cause in "Likely location" held against the real code: `server/routes/campaigns-character.js` ran `refuseUnlessGm` on its wildcard `DELETE /api/campaigns/:campaign/:file` BEFORE the `file === 'log' || !file.endsWith('.json')` `next()` fall-through, and the router mounts ahead of `campaigns-changedata` (`server.js` :200 vs :228) — so every visitor-origin change-data DELETE was captured with 403 while its POST siblings (PUT/PATCH/GET on the same router) already fall-through FIRST. Reproduced live pre-fix (two tabs, GM localhost:5173 + visitor `isolatedContext:'lan'` on the en0 IP): visitor OA press rolled + logged (`opportunity_attack` + `roll` rows), `DELETE pendingOAs` 403'd (visitor console), marker stranded; GM re-press then resolved the SAME provocation for a SECOND `opportunity_attack` row (2 OA rows, one reaction); fresh-key origin probe POST 200 / DELETE 403.

Changes:

- `server/routes/campaigns-character.js` — DELETE handler reordered exactly as Suggested fix: non-`.json`/`log` fall-through first, THEN `refuseUnlessGm` (`.json` character-file deletes stay GM-only and existence-blind), matching the GET/PUT/PATCH sibling shape; header comment records the authority split.
- `src/hooks/runtime/useRuntimeState.js` — fail-loudly: `deleteRuntimeKey` now checks `res.ok`; a refusal `console.error`s and, for 403 (authority refusal; a 404 honestly means a concurrent tab already evicted — nothing stranded), broadcasts `runtime-evict-failed`.
- `src/components/initiative/EvictFailureToast.jsx` (new) + `Initiative.jsx` (import + one JSX mount) — subscribed banner reusing the existing `.initiative-toast(-error)` CSS tokens; copy: `Failed to clear shared marker "<key>" — it will reappear`. (A direct `React.useEffect` in `Initiative` would have tripped the max-statements=60 ceiling, hence the component.)

Regression test: `server/routes/campaigns-character-delete-changedata-fallthrough.test.js` (mirrors `campaigns-character-delete-localhost-guard.test.js` supertest pattern, mounting BOTH routers in server.js order). Pins: visitor-origin DELETE of an existing `pendingOAs` bucket reaches the change-data router (200 + evict + null echo, every foreign host); fresh-key POST+DELETE both land; `savePrompt-*` sibling gets the router's honest 404, never the GM 403; visitor `.json` DELETE still 403s (disk-inert, existence-blind); localhost lanes unchanged. Proof the pins bite: temporarily reverting the order fails exactly the 4 fallthrough tests while the guard tests hold.

Live re-verification (post-fix, fresh faces): visitor OA press → popup rolls → `pendingOAs` ABSENT in the aggregate store (atomic), visitor console ZERO 403s, exactly +1 `opportunity_attack` + +1 `roll` row; GM tab re-open of Wolf's card shows NO `oa` chip (second resolution impossible); visitor `savePrompt-*` POST 200/DELETE 200 + ABSENT (structural sibling face owed in fix-verify, now paid); visitor DELETE of a `__GhostProbe__.json` still 403 GM-only; GM-origin change-data DELETE 200; plain (non-OA) Bite press rolls + logs honestly. Fail-loudly face: dispatched `runtime-evict-failed` on a settled Initiative tab renders the banner verbatim.

Tests: new file 8/8; `server/routes` folder 99 files/1517 tests green; full suite 3186 files/34,465 passed (+3 expected fails); `npm run lint` zero warnings; `no-timers-guard` OK (43 sites, new one is toast auto-hide). Exit ritual: tabs closed → admin clears → change-data `{}` / log `[]` GET-verified; servers killed by PID; `git status --porcelain public/campaigns/` empty.

The Secondary (uncertain) observation (phantom second die on the visitor press) is NOT touched here — it is the separate filed bug `bug-monster-attacks-log-phantom-second-die` (every monster press, GM and visitor alike).

