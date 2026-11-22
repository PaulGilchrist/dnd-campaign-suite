# bug-designer-generate-malformed-scope-500

## Summary
`POST /api/campaigns/:c/ai/designer/generate` does not schema-validate the request `scope` — only `scope && typeof scope === 'object'`. A malformed-but-object `scope` (e.g. `entityPlan` as an object instead of the canonical array) sails past the guard, consumes a model call in the batch leg, writes an `ai_designer` fallback audit row, then crashes deep in `resumeEntityGeneration` with an unhandled `TypeError: (scope.entityPlan || []).filter is not a function` → generic 500. The lane leaves a half-written failure state (audit row + design-notes `lastError`) instead of refusing 400 with plain-English copy before any side effects.

## Steps to reproduce
1. Run the API (`npm run api` or dev pair) on localhost; in `test-campaign` seed `aiConfig` with any endpoint (a dead one makes the ride fast): `POST /api/campaigns/test-campaign/aiConfig {"value":{"mode":"suggest","endpoint":"http://localhost:9/v1","model":"x","provider":"openai"}}`.
2. `POST /api/campaigns/test-campaign/ai/designer/generate` with body `{"scope":{"scope":"bespoke","entityPlan":{"npc":1},"levelRange":{"min":1,"max":2}}}` (note: `entityPlan` is an OBJECT, not the canonical array of `{kind,count}` rows).
3. Observe the response and server console.
4. `GET /api/campaigns/test-campaign/log` and inspect `data/design-notes.json` `lastError`.

## Expected behavior
A 400 with a plain-English error naming the offending field (the codebase's established doctrine: `aiConfig.mode` enum 400, `activeConditions` array-entry 400 via `keyValidators.js`, whole-doc map PUT erasure guard "one 400 names every offender") — with ZERO side effects: no model call, no `ai_designer` audit row, no design-notes `lastError`.

## Actual behavior
Response: `500 {"error":"ai designer generation failed"}` (generic).
Server console:
```
[ai-designer:generate] TypeError: (scope.entityPlan || []).filter is not a function
    at resumeEntityGeneration (server/services/ai/authoring/designer.js:206:43)
    at generateBlueprint (server/services/ai/authoring/designer.js:180:12)
    at async server/routes/ai-designer.js:121:24
```
Side effects that landed BEFORE the crash: one `ai_designer` audit row with copy `AI designer generate fell back to per-entity resume — AI_UNAVAILABLE: local model endpoint unreachable` (attempts:1) — which half-misleads, since the resume never executed any entity — plus a design-notes `lastError` ("ai designer generation failed"). (Witnessed live 2026-11-21, NNN run; my batch-leg model call hit a deliberately dead endpoint, so the audit wording was coincidentally about the endpoint, but the crash was purely the scope shape.)

## Likely location
Confident on the crash site: `server/services/ai/authoring/designer.js:206` (`resumeEntityGeneration` assumes `scope.entityPlan` is an array). Root cause is upstream: `server/routes/ai-designer.js:113` generate route does object-shape-only validation, and `generateBlueprint` (`designer.js:121`) only checks `scope?.scope` — the plan lane validates model output with `validateAgainstSchema(result.value, ENTITY_SCHEMAS.scope, …)` but the SAME schema check is never applied to a client-supplied scope on the generate lane.

## Suggested fix
At the top of the generate route (or in `generateBlueprint` right after the `scope?.scope` check), run `validateAgainstSchema(scope, ENTITY_SCHEMAS.scope, { schemas: ENTITY_SCHEMAS })` (the machinery already exists from the plan lane) and 400 with the joined errors BEFORE any model call or audit — mirroring the erasure-guard "refuse first, name every offender, zero writes" law. Defensive alternative at :206 (`Array.isArray(scope.entityPlan) ? … : []`) is NOT sufficient — it would still let a malformed scope burn model calls; validate fail-fast instead. Add a route test face: object-shaped `entityPlan` → 400, zero log rows, design-notes untouched.

## Severity
Minor UX issue / API-robustness gap — the lane is GM-localhost-only and the app's own UI always POSTs a plan-lane-validated array scope, so normal play never hits it; but the 500 + half-written audit violates the project's honest-400/zero-side-effect doctrine for malformed API bodies.

## Resolution
FIXED 2026-11-22 (fix subagent). Diagnosis confirmed: the generate lane accepted any object `scope`, so a malformed plan (e.g. `entityPlan` as an object) burned the batch model call, wrote the `ai_designer` fallback audit row, then crashed `resumeEntityGeneration` (`designer.js:206`) → generic 500 + design-notes `lastError`. Re-produced live pre-fix against a running API (dead endpoint `http://localhost:9/v1`): `HTTP:500 {"error":"ai designer generation failed"}`, one fallback audit row, `lastError` recorded, `[ai-designer:generate] TypeError: (scope.entityPlan || []).filter is not a function` in the server console — exactly the filed face.

**Actual fix** (matches the suggested location — the schema check lives in `generateBlueprint`, not the route, so it also honours the existing server-stamp law):
- `server/services/ai/authoring/designer.js` — `generateBlueprint` now runs `validateAgainstSchema(scope, ENTITY_SCHEMAS.scope, { schemas: ENTITY_SCHEMAS })` **after** `stripServerStamps` (critical: the rehydrated pending plan POSTs `savedAt`/`proposedAt` back and a route-top check would reject legitimate reload-then-regenerate). Replaces the old `scope?.scope` one-liner with a full schema refusal `{ ok: false, code: 'BAD_SCOPE', errors: shape.errors }` — before `loadNotes`, the story bible, any model call or audit row (mirrors the sibling `refine.js` `preflight` pattern: everything refusible before a model call).
- `server/routes/ai-designer.js` — generate route maps `code === 'BAD_SCOPE'` to `400 {"error":"Build plan rejected: <every offender, '; '-joined>"}` and returns BEFORE `setDesignerError`/`savePendingPlan` — zero side effects (the erasure-guard "one 400 names every offender" law).
- `server/routes/ai-designer.generate-scope-schema.test.js` (new) — regression test riding the REAL `designer.js` (peripherals mocked): object-shaped `entityPlan` → 400 naming `entityPlan` + no chat call + no `addEntry` + no design-notes write; multi-offender body names EVERY field in one 400; stamped rehydrated plan still passes the gate; valid array scope reaches the model lane (dead-endpoint fail-closed face unchanged).

**Live re-verification (post-fix, test-campaign, API on :80):** malformed ride → `HTTP:400 {"error":"Build plan rejected: $.entityPlan must be a array"}`, log row count unchanged (0 new), `lastError` byte-unchanged, zero console TypeErrors. Multi-offender ride → one 400 naming `scope` (required), `entityPlan[0].kind`, `entityPlan[0].count` and `bogusField`. Adjacent sanity: valid array scope + dead endpoint → honest `200 AI_NEEDS_HUMAN` fail-closed (ai_designer rows + honest AI_UNAVAILABLE copy + lastError moves), and a stamped rehydrated pending plan regenerates normally (HTTP 200 model lane, no self-reject). Cleanup: admin clear-log + clear-change-data (the aiConfig seed was swept by the change-data wipe), clear-conversation → design-notes restored byte-exact `d5e0f95c2eacf405226cac57e287d4c5`; server killed, port 80 dark.

**Tests:** `npx vitest run` — new test 4/4; `server/routes` full folder 123 files / 1892 tests green; `server/services/ai/authoring` 23 files / 192 tests green; `npm run lint` clean (zero warnings).

