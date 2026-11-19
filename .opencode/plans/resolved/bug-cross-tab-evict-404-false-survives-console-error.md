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

## Resolution

FIXED (NB 2026-11-18 fix run). The filed diagnosis was exact.

**What was actually wrong:** `deleteRuntimeKey` (`src/hooks/runtime/useRuntimeState.js`) checked `if (res.ok) return;` then fired the `console.error … the shared key survives server-side` UNCONDITIONALLY for every non-OK status, gating only the TOAST on 403 — even though its own adjacent comment (and the owner fail-loudly ruling recorded in the playbook) acknowledged that a 404 on the wildcard DELETE (`server/routes/campaigns-changedata.js` 404s vanished keys honestly) means the key is already gone (a concurrent tab won the evict — the documented cross-tab save-prompt rescue residual). The claim was false on exactly that lane.

**Fix:** the response leg now reads `if (res.ok || res.status === 404) return;` — a 404 is server-CONFIRMED absence, fully SILENT (no console.error, no toast; the local mirror was already evicted before the fetch, so nothing strands). This mirrors the established sibling doctrine `clearDeathSavePrompt` (`src/services/combat/conditions/savePromptService.js:151`, `death-save-prompt-evict-404-noise`: evict-confirm on 2xx/404, keep loud only for non-confirming answers) — no new abstraction, no warn-tier line (the sibling is fully silent; the harness console-error census is the stated victim). 403 keeps BOTH loud lanes (console claim + `runtime-evict-failed` → `EvictFailureToast`); other non-OK (5xx) keeps console-only loud, where "survives" is honestly TRUE. Comment block rewritten to state the branch doctrine. Dual-ruleset: N/A — this is the generic runtime store hook shared by both 5e and 2024 lanes; no twin module. Not an automation trigger, so no campaign-log row obligation (the existing `save_result`/`save_lapsed` audit rows are untouched).

**Files changed:**
- `src/hooks/runtime/useRuntimeState.js` — 404 branch + comments
- `src/hooks/runtime/useRuntimeState.deleteRuntimeKey.test.js` — NEW regression pin (7 tests: DELETE wire shape; has()-guard silence; 404 fully silent + mirror evicted + no event; 2xx silent; 403 console+event with byte-exact detail `{key, campaignName, status:403}`; 5xx console-only; undefined-campaignName guard)
- `docs/test-setup-playbook.md` — in-place corrections to the fail-loudly law (§2 visitor-DELETE bullet) and the consumerless-rescue bullet
- this bug file

**Verification (live, real two-tab rig in test-campaign, both before and after the fix):**
- PRE-FIX repro: cleared baseline → EB-join bare Goblin (7/7) → armed `select[aria-label="EvasiveFighter target"]` → sheet Glaive (MISS, retry, HIT 19 vs AC 15) → Done → Charge chooser Cancel → Shield Bash STR prompt `[data-testid=active-save-prompt]` parked; books server-side (`pendingSavePrompts{uuid}` + `pendingSaveListenerPrompts:[uuid]` + `savePrompt-Goblin-<uuid>`); tab B (same context, re-select) replayed the prompt → Roll Save (fail 8 vs DC 17) → Done → tab A’s in-page console.error witness captured BOTH verbatim bogus lines (…404… survives server-side) plus the browser’s own 2 network-resource 404 lines; GET proved both books ABSENT — the claim contradicted by the same breath.
- POST-FIX re-ride (full rig re-run from cleared baseline, HIT 25, save fail 11): tab A app-level witness = **zero console.error entries**, zero `runtime-evict-failed` events; error-level console census shows ONLY the 2 browser-own `Failed to load resource: 404` lines (the browser, not the app — expected per the brief). Server ground truth unchanged: both books ABSENT, no `savePrompt-*` keys, `_shieldBashBaseAttack: null`, documented dup-`save_result` pair + `save_lapsed` residual intact (no behavior change outside the diagnostic). Adjacent-flow sanity: the fail chooser still re-arms on the producer tab and Skip drains it clean (overlays 0).
- 403 lane re-proved loud on both lanes: phantom key `zz-evict-403-probe` mirrored, its DELETE route-mocked to 403 → console.error fires AND the claim is TRUE this time (GET shows `serverKeySurvived: true`) + `runtime-evict-failed` dispatched with byte-correct detail.
- Tests: `npx vitest run src/hooks/runtime/useRuntimeState.deleteRuntimeKey.test.js` 7/7; touched-folder `src/hooks/runtime/` 11 files/178 tests green; consumer sweep (savePrompt drain-evict/drop-pending/dismiss-detach + `src/services/combat/conditions/` + `Initiative.effectAdder-evict`) 23 files/882 tests green; `npm run lint` clean (zero warnings); `no-timers-guard` OK.
- Exit hygiene: all harness tabs closed → headless Admin clears GET-verified `change-data {}` + `log []`, overlays `{"overlays":[]}`; dev pair left running under `CAMPAIGN_LOCK=test-campaign`.

