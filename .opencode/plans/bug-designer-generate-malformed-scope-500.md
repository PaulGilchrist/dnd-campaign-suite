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
