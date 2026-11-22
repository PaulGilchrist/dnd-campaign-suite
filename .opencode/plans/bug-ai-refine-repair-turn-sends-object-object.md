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
