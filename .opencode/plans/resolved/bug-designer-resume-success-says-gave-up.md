# Successful AI-designer resume generate row logs "gave up after retries"

## Summary
When the batch blueprint fails and the per-entity resume succeeds, the `ai_designer` generate audit is written with `attempts: 0`, and the Log view's readable summarize collapses `attempts = 0` into the phrase **"gave up after retries"** — on a row that shows a full success payload ("created … encounters 1 … restore point …zip"). Right feature, wrong verdict text.

## Steps to reproduce
1. In test-campaign, configure AI against a local endpoint whose full-blueprint call fails (the oMLX + `Qwen3.8-Flash-Next-oQ4e-mtp` build degenerates on the batch prompt — reproducible today; the per-entity lane succeeds).
2. AI Designer → chat a short prep ask → "Propose build plan" → set encounters count 1 → "Generate drafts".
3. Wait for "Drafted 1 entities — restore point …" and open the Log view.

## Expected behavior
The successful generate row should read something like "Designer generate — created … encounters 1 … — restore point … (via per-entity resume)" — the run DID produce drafts and land them.

## Actual behavior
The row renders:
`Designer generate — created factions 0, settlements 0, npcs 0, quests 0, sessions 0, encounters 1, maps 0 — restore point test-campaign-2026-10-31T22-40-56-044.zip — gave up after retries`
(verified live 2026-10-31, test-campaign Log view; row id c2f111ca-963d-…, `attempts: 0`, no `errors` field).

## Likely location
Confident, two contributing sites:
- `server/services/ai/authoring/designer.js:205` — `resumeEntityGeneration` ends with `finalize(campaign, blueprint, log, 0)`; `finalize` (line ~175) then writes `attempts: attempt` = 0 on a SUCCESS audit. The batch-fail fallback row (line 168) legitimately logs 0, but the resume success shouldn't.
- `src/components/log/log-utils.js:119-124` — `attemptsPhrase(0)` → "gave up after retries" unconditionally; `describeDesigner` appends it to the success line too (line ~179 `parts.push(attemptsPhrase(entry.attempts))`), even when there is no failure text.

## Suggested fix
Either (a) stamp the resume success with a truthful marker — e.g. `finalize(campaign, blueprint, log, 0)` → pass `attempts: 1, resumed: true` (or stage `generate-resume-ok`) and render "(via per-entity resume)"; or (b) in `describeDesigner`, omit `attemptsPhrase` on the success path when the row has `created` totals > 0 and no `errors` — minimal change: only push the attempts phrase when `failure` is truthy or `n >= 1`. Add a LogAiAudit test case for `attempts: 0` + `created: {encounters: 1}`.

## Severity
Minor UX issue — the log's AI audit verdict contradicts its own success payload; could mislead a GM into re-running a generation that actually landed.

## Resolution
FIXED 2026-10-31 (subagent AR-2). Both suspected sites confirmed against the live code — the diagnosis was accurate.

**What was wrong (both contributing sites, fixed):**
1. `server/services/ai/authoring/designer.js` — `resumeEntityGeneration`'s full-success path called `finalize(campaign, blueprint, log, 0)`, stamping `attempts: 0` with no marker that the per-entity lane produced the success. Fix: `finalize` takes an optional `extra` payload and the resume success now audits `{ …, attempts: 0, resumed: true }`. The batch success path passes no extra, so its payload stays byte-clean (pinned by the existing keys-exact test).
2. `src/components/log/log-utils.js` — `describeDesigner`'s success branch appended `attemptsPhrase(entry.attempts)` unconditionally, and `attemptsPhrase(0)` = "gave up after retries". Fix: on the success branch the verdict phrase is now `resumed ? '(via per-entity resume)' : attempts >= 1 ? attemptsPhrase(attempts) : <omit>`. Omitting (not guessing) for legacy un-marked `attempts: 0` success rows already on disk keeps them from rendering the contradictory phrase. The failure branch (`stopped — … (gave up after retries)`) is untouched — it stays honest for plan stops, batch-fallback rows, and mid-resume stops.

**Repro route (bounded-AI exception):** the full live funnel (chat → plan → batch-fail → per-entity resume) takes minutes of oMLX calls, so the equivalent `ai_designer` row was seeded via `POST /api/campaigns/test-campaign/log` with the exact broken shape (`attempts: 0`, `created: {… encounters: 1 …}`, no `errors`) and **viewed broken in the browser Log view first**, matching the filed text verbatim ("… — gave up after retries"). After the fix, the Log view shows all five seeded faces rendering correctly:
- new resume-success row (`resumed: true`): `Designer generate — created factions 0, …, encounters 1, maps 0 — restore point …zip — (via per-entity resume)` (Expected, verbatim)
- legacy broken row (old shape): same success payload with **no** give-up phrase
- batch success (attempts 2): `… — after 2 attempts` (unchanged)
- plan-stop and batch-fallback-stop failure rows: `stopped — … (gave up after retries)` (unchanged)

**Files changed:**
- `server/services/ai/authoring/designer.js` — finalize `extra` param + `resumed: true` on resume success
- `src/components/log/log-utils.js` — honest verdict phrase in `describeDesigner` success branch
- `server/services/ai/authoring/designer.test.js` — regression test: resume success audits `resumed: true` + no `errors` key
- `src/components/log/LogAiAudit.test.jsx` — regression tests: resume-success renders "(via per-entity resume)"; legacy un-marked `attempts: 0` success renders no give-up phrase

**Verification:** `npx vitest run` on both touched test files (41 passed) → touched folders `src/components/log` + `server/services/ai/authoring` (31 files / 355 passed) → full suite `npm run test:run` (2975 files / 32720 passed, 3 expected-fail — pre-existing) → `npm run lint` zero warnings → `no-timers-guard` OK. test-campaign log + change-data cleared via Admin panel afterwards (GET-verified `[]` / `{}` with the tab closed).

