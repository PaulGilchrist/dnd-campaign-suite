# Bug: cross-tab evict race logs a FALSE "key survives server-side" console.error on the by-design 404

## Summary

When a parked save-prompt chain is answered from a SECOND live tab (the documented consumerless-rescue residual — by-design cross-tab resolution), the producing tab's `deleteRuntimeKey` drain-to-evict DELETEs `pendingSavePrompts` / `pendingSaveListenerPrompts` after the answering tab's write already emptied them server-side. The wildcard DELETE of a vanished key 404s, and `deleteRuntimeKey` logs `console.error … the shared key survives server-side` for EVERY non-OK status — including the 404 case that its own adjacent code comment says means "the key is already gone … nothing is stranded". The claim is false, the noise is deterministic per cross-tab resolution, and it contradicts the playbook's fail-loudly law ("a 404 honestly means a concurrent tab won the evict, silent").

## Steps to reproduce

1. In `test-campaign`, clear the board and EB-join a fresh Goblin (EvasiveFighter armed as the only dirty roster — any once-per-turn-clean state).
2. On tab A (EvasiveFighter sheet): arm `select[aria-label="EvasiveFighter target"]` → Goblin, press the `Glaive` sheet row, Done on the HIT face; on the Charge chooser press Cancel; STOP with the `[data-testid=active-save-prompt]` (Shield Bash STR) prompt parked — do not touch it.
3. Open tab B (new tab, same browser, `http://localhost:5173`), select `test-campaign`. The prompt REPLAYS mounted on B too.
4. On tab B: Roll Save → Done on the result face.
5. Observe tab A's console: two `Failed to load resource: 404` lines for `GET/DELETE /api/campaigns/test-campaign/pendingSaveListenerPrompts` and `…/pendingSavePrompts`, plus two `deleteRuntimeKey: server refused eviction of "<key>" (HTTP 404) — the shared key survives server-side` console.errors.
6. Ground-truth the claim: `GET /api/campaigns/test-campaign/change-data` — BOTH book keys are ABSENT (eviction fully landed), and the lastAttack/stash restore is idempotent (`_shieldBashBaseAttack: null`, `lastAttack` restored once).

## Expected behavior

Per the owner fail-loudly ruling (2026-11-10, recorded in `docs/test-setup-playbook.md` §7/change-data law): "a 404 honestly means a concurrent tab won the evict, **silent**" — only 403-class AUTHORITY refusals should be loud (toast + console). A 404 on a key that is already gone server-side must NOT log an error claiming the key survives.

## Actual behavior

- Console on tab A (verbatim, from this run):
  - `[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:5173/api/campaigns/test-campaign/pendingSaveListenerPrompts`
  - `[ERROR] deleteRuntimeKey: server refused eviction of "pendingSaveListenerPrompts" (HTTP 404) — the shared key survives server-side {campaignName: test-campaign}`
  - same pair for `pendingSavePrompts`.
- The 404 body from the wildcard route is `{"error":"Change-data key not found: …"}` (curl-proved against a phantom key: `DELETE /api/campaigns/test-campaign/zz-nb-phantom` → 404) — i.e. the key does NOT survive; the message asserts the opposite.
- Server state is correct; only the diagnostic lies. The duplicate-`save_result` + `save_lapsed` rows observed alongside are the separately DOCUMENTED by-design residual (playbook §2 rescue law) — not part of this bug.

## Likely location

Confident (read the code): `src/hooks/runtime/useRuntimeState.js:171-181` — `deleteRuntimeKey` checks `if (res.ok) return;` then fires `console.error` UNCONDITIONALLY for every non-OK, and only gates the TOAST on `res.status === 403`. The comment at `:174-176` already acknowledges 404 = already gone; the console.error simply never adopted that branch. Server side is honest-by-design (`campaigns-changedata.js` wildcard DELETE 404s missing keys).

## Suggested fix

In the `.then((res) => …)` of `deleteRuntimeKey`, treat 404 as success-silent, mirroring the toast gate:

```js
if (res.ok || res.status === 404) return; // 404: a concurrent tab won the evict — key already gone
console.error(`deleteRuntimeKey: server refused eviction …`, { campaignName });
if (res.status === 403) { …dispatch runtime-evict-failed… }
```

Optionally keep a `console.warn`-tier line for 404 to preserve observability without the false claim + without an error status (monitor/test harnesses that count console errors by severity are the real victims here). Pin: a 404 response logs zero console.error and evicts the mirror (mirror eviction at `:155` already precedes the fetch, so nothing strands); 403 keeps both lanes.

## Severity

Minor UX issue (diagnostic accuracy). No data-integrity risk — server state converges correctly and the restore is idempotent (both GET-proved live). But it turns every by-design cross-tab resolution into 2 bogus console errors, poisoning the console-error census that every exploration/verify run uses as an app-health gate, and the message text actively misinforms a debugging GM ("the shared key survives server-side" when it does not).
