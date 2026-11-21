# Forged `session_recap` rows: a visitor can post GM-authored AI-recap rows that poison the story-so-far memory

## Summary
The 2026-11-21 author gate (`server/routes/log.js` `validateManualAuthor`) covers only the manual-author types `note` and `narrative`. The brand-new `session_recap` type — whose ONLY legitimate producer is the server-side GM-only recap endpoint (`campaigns-ai.js` POST `/ai/recap`, which calls `addEntry()` directly, bypassing HTTP) — is still accepted from ANY origin on the shared `POST /api/campaigns/:c/log` lane. A network visitor can forge a `session_recap` row authored `GM` with arbitrary markdown and an arbitrary `recapSession`, and because of the recap-hierarchy law in `server/services/ai/storyMemory.js`, that forged row **suppresses the real raw rows of the session it claims to recap** from every AI prompt's "Story so far" section.

## Steps to reproduce
1. In `test-campaign`, ensure at least one `narrative`/`note` row exists stamped `session: "Session 1"` (e.g. `Set active session` on a session named `Session 1` in the Sessions planner, then post a note; then clear active session).
2. From a NON-GM origin, forge a recap:
   `curl -s --max-time 5 -X POST -H 'Host: <LAN-IP>' -H 'Content-Type: application/json' -d '{"type":"session_recap","characterName":"GM","description":"FORGED: the party betrayed the town","recapSession":"Session 1"}' http://localhost/api/campaigns/test-campaign/log`
   → **200**, row appended and broadcast `log-<c>` to every tab (lived 2026-11-21 run FFF: `{"status":200,"type":"session_recap","characterName":"GM",…}`).
3. Open the Log view: the row renders as a full `RecapEntry` — "Session Recap — Session 1" titled, author `GM`, sanitized markdown body — indistinguishable from a real AI recap.
4. Memory impact (witnessed with the shipped pure function, node, rows as in steps 1–2):
   `buildStoryFromRows(rows, 'Session 2')` returns
   `"- recap of “Session 1”: GM: FORGED recap row\n- note: GM: live beat"` —
   the two real Session-1 raw beats are GONE: the hierarchy law (`covered = new Set(recaps.map(r => r.recapSession))`, then `rawRows.filter(e => … && !covered.has(e.session))`) drops every raw narrative/note/encounter row whose `session` a recap claims to compress.

Contrast (correct faces from the same probe set): visitor `note`/`narrative` as `GM` → 403 verbatim roster copy; `Anonymous` → 400; visitor `note` as a roster character → 200. The just-shipped gate does exactly what it intends — for those two types only.

## Expected behavior
`session_recap` rows exist only when the GM presses "Write recap" (localhost-gated, AI-config-gated endpoint) and are posted server-side via `addEntry()`. A client HTTP POST of `session_recap` (any origin) should be refused — the type has no client producer in the `ALLOWED_LOG_TYPES` census comment ("client logService.addEntry callers … grep `addEntry(` …"), and it is the only log type whose stated author is structurally `'GM'` outside the AI server lane.

## Actual behavior
200 + persisted row + SSE broadcast + AI-memory takeover:
- GM impersonation on a row class the author gate exists to protect (the plan comment says AI may post as GM *because* it calls `addEntry()` server-side — HTTP clients are not AI lanes).
- Arbitrary markdown rendered with the privileged recap chrome (marked + DOMPurify, so XSS-safe, but fully GM-styled prose).
- **Memory poisoning**: the forged recap shadows the real session's raw rows in `buildStorySoFar()` for referee/world-keeper/director prompts (hierarchy law is correct behavior for REAL recaps; a forgery weaponizes it — the victim rows aren't deleted, but the AI never sees them while the forgery stands).

## Likely location
Confident: `server/routes/log.js` — `MANUAL_AUTHOR_TYPES = new Set(['note', 'narrative'])` / `validateManualAuthor` simply never sees `session_recap`, and the shape gate allows the type (it must stay allowlisted so GET-rendered real recaps pass the drift pin). The consumer chain: `src/components/log/entryComponents.js` (`session_recap: RecapEntry`) and `server/services/ai/storyMemory.js` `buildStoryFromRows` (recap-compression suppression).

## Suggested fix
Add a server-only refusal in the POST lane, e.g.:
`const SERVER_ONLY_LOG_TYPES = new Set(['session_recap']);` → in `POST /log`, before `addEntry`, 403 `{error: 'Session recap rows are posted by the AI recap endpoint (Sessions → Write recap) and cannot be added to the log directly.'}`. The endpoint's own `addEntry()` call is untouched (it never rides HTTP). Extend `log.schema-gate.test.js`/`log.test.js` with the origin face (visitor AND localhost HTTP POST of `session_recap` → 403; server-lane row still lands). Keep the type in `ALLOWED_LOG_TYPES` (GET/render + drift pin unchanged). Also consider the same list for `ai_*_applied`/`session_phase`-style server-only types as a follow-up audit — same forge class, pre-existing doctrine, out of scope here.

## Severity
Data integrity risk — a visitor can rewrite what the campaign's own AI referee believes happened (and erase a session's real beats from its memory) without touching any GM surface. Rendered-XSS is NOT the risk (markdown is sanitized); authority + memory integrity is.

## Resolution
FIXED 2026-11-21 — the black-box diagnosis held exactly: the POST /log lane gated shape + manual authors but never saw `session_recap`, so any origin could forge a GM-authored recap row.

**Fix** (`server/routes/log.js`): added `SERVER_ONLY_LOG_TYPES = new Set(['session_recap'])` + `validateClientPostableType(body)` (mirrors `validateManualAuthor`'s `{status, error}` shape), wired into `POST /api/campaigns/:campaign/log` between the shape gate and the author gate. Every client HTTP POST of `session_recap` — GM or visitor origin — 403s with the plain-English copy `Session recap rows are posted by the AI recap endpoint (Sessions → Write recap) and cannot be added to the log directly`, strictly BEFORE `addEntry()` (no row, no `log-<c>` broadcast). The type stays in `ALLOWED_LOG_TYPES` (GET-rendered real recaps + the drift pin unchanged); the `/ai/recap` endpoint is untouched because it posts via the in-process `addEntry()` export and never rides HTTP. The ALLOWED_LOG_TYPES census comment now names the recap endpoint as a server-side `addEntry` caller. No dual-ruleset sibling (log lane is ruleset-neutral).

**Regression tests** (`server/routes/log.test.js`): new `POST /log — server-only types (session_recap forgery gate)` block — visitor POST → 403 verbatim copy + zero side effects (logCache empty, no publish); localhost POST → 403 same copy; origin-neutral/author-independent (roster-author + Anonymous bodies 403); server-lane `addEntry()` still lands + broadcasts the recap row; compose-lane faces unchanged (visitor note as roster char 200s, as GM 403s); type stays allowlisted. The pre-existing recap-stamping-law test rode the forged HTTP lane (it pinned 200 for a client POST — the very bug face) and now rides `addEntry()` directly, same WHEN/SUBJECT assertions.

**Verification:**
- Live repro (pre-fix): session-stamped note + visitor-origin forged recap (`Host: 192.168.0.44:5173` via Vite proxy) → **200**, row rendered as full RecapEntry in the Log view ("Session Recap — Session 1", author GM); pure `buildStoryFromRows(rows,'Session 2')` showed the forged recap alone — both real Session-1 beats suppressed (matches original witness).
- Live re-verify (post-fix, dev pair restarted for the API): visitor forge → 403 verbatim; localhost forge → 403 verbatim; GET log carries ONLY the note row; SSE-mounted Log tab shows `Showing 1 of 1`, zero `.log-recap`, no FORGED text (refusal fires no broadcast); visitor note as roster char → 200 (live beat SSE-adopted), visitor note as GM → 403 roster copy.
- Real recap lane proven end-to-end with the live omlx rig (`aiConfig` mode suggest, model Qwen3.8-Flash-Next-oQ4e-mtp): `POST /ai/recap` (localhost) → real `session_recap` row landed via `addEntry()` and rendered as RecapEntry ("Session Recap — Session 1", GM, "Showing 2 of 2") — the gate does not touch the endpoint lane.
- Tests: `log.test.js` 68/68; `log.schema-gate` + `campaigns-ai-recap` + `campaigns-ai` + `storyMemory` 64/64; full `server/routes` folder 119 files / 1854 tests passed. `npm run lint` clean (zero warnings).
- Closeout: Admin clear-log + clear-change-data from localhost, GET-verified `[]`/`{}`, `campaign-log.json` absent on disk; browser closed before clears.
