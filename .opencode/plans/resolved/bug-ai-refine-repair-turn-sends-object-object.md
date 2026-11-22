# bug-ai-refine-repair-turn-sends-object-object

## Summary
The AI-refine repair retry sends the model's rejected output back as the assistant turn, but the value is the **parsed object**, so `String(repairOf)` serializes to the literal `[object Object]` on the wire. The model asked to "fix every error" never sees its own previous output — it only sees `[object Object]` plus the error list.

## Steps to reproduce
1. Run the capture-mock rig (playbook §2 "AI PROMPT-WITNESS"): a tiny OpenAI-compatible server on `:8001` logging every `POST /v1/chat/completions` body to a JSONL; on the refine branch (system contains `You revise one D&D campaign entity`) answer a replacement JSON object carrying an unknown field (e.g. `bogusField`) so validation fails deterministically.
2. In `test-campaign`, seed `POST /api/campaigns/test-campaign/aiConfig` `{value:{mode:'suggest',endpoint:'http://localhost:8001/v1',model:'capture-mock',provider:'openai'}}`.
3. `POST /api/campaigns/test-campaign/ai/refine/npc` with an entity = Marta Copperkettle (strip `image`/`imageName`/`imagePath`/`updatedAt`) and an instruction that triggers the invalid answer (`TRIGGER-INVALID output please`).
4. Read the mock's JSONL: the SECOND chat request (the repair retry) carries `messages[3] = {role:'assistant', content:'[object Object]'}` — verbatim, witnessed 2026-11-22 (run RR). The lane then honestly returns `{"ok":false,"errors":[...]}` and logs an `attempts:0` row, which masks how degraded the retry prompt actually was.

## Expected behavior
The assistant turn of the repair retry should carry the model's actual rejected JSON text (the sibling dress lane does this correctly: `dressMap.js:354` uses `String(json(repairOf))`), so the model can see and fix its prior output.

## Actual behavior
The wire body shows the assistant message content is the literal string `[object Object]` (confirmed in the capture-mock JSONL). Any real model's repair round is effectively blind: it's told "That output failed validation… Fix every error" without its output in context. Consequence: second-attempt recoveries that should succeed instead burn the retry and land as `attempts:0` refusals — refine "fails" more often than the model actually errs.

## Likely location
CONFIDENT (code + wire evidence): `server/services/ai/authoring/refine.js:85` — `{ role: 'assistant', content: String(repairOf).slice(0, 20000) }` where `repairOf` is set at `:102`/`:105` to `replacement = parsed.value` (an OBJECT from `extractJsonObject`). `String(object)` → `[object Object]`. Compare `server/services/ai/authoring/dressMap.js:354` which wraps with `json(...)` first, and `designer.js:364` whose `lastContent` is a raw string — refine is the only broken twin.

## Suggested fix
One-liner: `content: JSON.stringify(repairOf).slice(0, 20000)` at `refine.js:85` (guard the null case — after a transport-failure `continue` at `:95-96`, `repairOf` is still null and `String(null)` sends the string `"null"`; either skip the assistant turn when `repairOf === null` or seed `repairOf` with the raw `content` string too). Add a pin on the repair path asserting the assistant turn is parseable JSON (or `'null'`-free), mirroring the dress-lane precedent.

## Severity
Minor UX issue / degraded feature: nothing is mis-written (the lane fails closed honestly), but the shipped repair round-trip is objectively corrupted, causing avoidable refine refusals against real models.

## Resolution
FIXED 2026-11-22 (subagent fix run). Diagnosis confirmed verbatim: pre-fix capture-mock JSONL witness on `test-campaign` (dev pair lock `test-campaign`, mock on :8001, Marta row stripped of image keys, instruction `TRIGGER-INVALID output please`) showed the repair retry's assistant turn content is exactly `'[object Object]'` — `String(repairOf)` where `repairOf` is the parsed object.

**What changed** (`server/services/ai/authoring/refine.js`): adopted the `designer.js` `lastContent` pattern — the repair-turn variable is now a TEXT variable `lastContent` (null initially), so the message line `String(lastContent).slice(0, 20000)` needed no change; the SEEDS carry the fix:
- schema-rejected and ref-collision legs now seed `lastContent = JSON.stringify(replacement)` (was the raw object);
- the extracted-not-JSON leg now seeds `lastContent = String(content)` (the model's raw rejected text) — previously it left the turn blind;
- a transport-failure first attempt keeps the designer/dress twin face (`String(null)` → `'null'` placeholder — no output existed to echo); the suggested skip-the-turn branch was NOT added, staying consistent with both sibling lanes.

Files changed:
- `server/services/ai/authoring/refine.js` — the repair-turn seeds (see above).
- `server/services/ai/authoring/refine.repair-turn.test.js` — NEW regression pin, 4 legs: schema-rejected turn is parseable JSON byte-equal to the rejected object (never `'[object Object]'`); ref-collision turn carries the rejected name; non-JSON answer echoes its raw text and attempt 2 recovers; transport-fail turn is the documented `'null'` twin placeholder. No sibling test pinned the repair-turn content before (that's how this hid).

**Verification:**
1. Repro-first: wire witness showed `messages` assistant content `'[object Object]'` verbatim (run before any code change).
2. Post-fix capture-mock re-ride: repair request's assistant turn is the parseable JSON `{"name":"Marta Copperkettle",…,"bogusField":1}`; with the mock upgraded to comply ONLY on a `That output failed validation…` request, the lane now returns `ok:true` with the corrected replacement and the audit row honestly stamps `attempts:2` (pre-fix that recovery was impossible — the retry was blind).
3. Refusal face unchanged: with an always-rejecting mock the response is the same `{"ok":false,"errors":[…]}` + `attempts:0` row (byte-identical errors).
4. Tests: `npx vitest run` on the new file (4/4), the authoring folder (23 files/188 tests), full suite `npm run test:run` (3484 files / 37,165 tests, all pass). `npm run lint` zero warnings.
5. Cleanup: admin clear-change-data + clear-log on test-campaign (exit GET `{}` / `[]`, both files ABSENT, npcs.json md5 `db6666c12` byte-exact); capture-mock rig + JSONL deleted; :80/:5173/:8001 dark.

Note: `dressMap.js` (`String(json(repairOf))`) and `designer.js` (string `lastContent`) were already correct — refine was indeed the only broken twin; no dual-ruleset (5e/2024) sibling exists for this server-side AI lane.
