# write_rejected audit + denied SSE missing on the scoped PATCH write lane

## Summary
cf8c33d7c made every server-validator refusal leave a persistent `write_rejected` log
row (plus a `denied-<campaign>-<key>` SSE moment) so the audit ledger shows what the
server refused even after the SSE moment passed (§10.4 rationale, stated unconditionally
in the commit message). It was applied to the wildcard POST handler only. The scoped
`PATCH /api/campaigns/:campaign/:key` lane pays the same `validateRuntimeWrite` chokepoint
on merged truth, but its refusal branch emits ONLY a server console.log — no log row,
no denied-* SSE. Same-class rejections are auditable on one lane and silent on the other.

## Steps to reproduce
1. In `test-campaign`, have any tab mounted so a character bucket exists (e.g. FeyRanger).
2. Refuse via PATCH (scoped lane):
   `curl -s -X PATCH -H 'Content-Type: application/json' -d '{"value":{"activeConditions":[{"key":"poisoned","name":"Poisoned"}]}}' http://localhost/api/campaigns/test-campaign/FeyRanger`
   → 400 with the plain-English reason; server console shows `[FeyRanger] BLOCKED PATCH test-campaign — …`.
3. `GET /api/campaigns/test-campaign/log` → NO `write_rejected` row added (live run: logCount stayed 17).
4. Same payload via POST (full-store lane):
   `curl -s -X POST -d '{"value":{"activeConditions":[{"key":"poisoned","name":"Poisoned"}]}}' http://localhost/api/campaigns/test-campaign/FeyRanger`
   → same 400 body, AND the log gains
   `{type:'write_rejected', origin:'server-validator', key:'FeyRanger', reason:'…'}`
   (live run: logCount 17→18), rendered by the dedicated `log-write-rejected` entry
   ("Write Rejected | FeyRanger | Server rejected write to …") in the Log view.

## Expected behavior
Per cf8c33d7c's own rationale ("denials are PERSISTENT audit"), every validator refusal
on EVERY write lane leaves the `write_rejected` row and broadcasts the `denied-*` SSE.

## Actual behavior
PATCH refusals are console-only: invisible in the Log view, absent from the on-disk
ledger, and no `denied-*` event fires, so open tabs get no live feedback either.

## Likely location
Confident: `server/routes/campaigns-changedata.js` — the PATCH handler's
`if (!validation.ok)` branch (logs `[key] BLOCKED PATCH …` then returns 400) lacks the
`publish('denied-…')` + `addLogEntry(campaign,{type:'write_rejected',…})` pair that the
POST wildcard handler carries a few dozen lines above. cf8c33d7c's diff only touched the
POST branch. (Could be an owner-scoping choice — but nothing documents it, and the
commit message is unconditional.)

## Suggested fix
Mirror the POST branch inside the PATCH refusal path with the same payload fields
(key, reason, description, origin:'server-validator') and the same `denied-${campaign}-${key}`
publish; extend `campaigns-changedata-l5-validation.test.js` with a PATCH-shape pin.

## Severity
Minor data-integrity risk — no gameplay state is corrupted, but the tamper/misuse audit
trail the fix set out to build is silently incomplete on the newer scoped lane, and
clients watching denied-* SSE never learn a write was refused there.
