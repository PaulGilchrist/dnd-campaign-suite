# Bug: AI Designer accepts a draft entity named after its kind ("npc") — the naming law is prompt-only, never validated

## Summary

The designer's `namingRule()` explicitly forbids kind-word names (NEVER "${kind}" or placeholders), but `validateEntity()` is pure schema validation (name = non-empty string), so a model that ignores the rule sails through: the per-entity resume lane drafted the harbourmaster NPC with `name: "npc"`, the Drafts card rendered "npc", and **Approve persisted a live NPC row literally named "npc"** into `npcs.json` with zero warning. The unique-name collision guard is also trivially bypassed for such rows.

## Steps to reproduce

1. On localhost, in `test-campaign`, ensure Admin AI is live (aiConfig mode≠off, working local endpoint — API seed: `POST /api/campaigns/test-campaign/aiConfig {"value":{"mode":"suggest","endpoint":"http://localhost:8000/v1","model":"Qwen3.8-Flash-Next-oQ4e-mtp","provider":"openai"}}`).
2. Sidebar `Drafts` → send a chat brief, e.g. "one memorable low-level NPC: a suspicious harbourmaster in a fogbound fishing town who secretly smuggles relics." Wait for the AI reply, press `Propose build plan`.
3. In the plan editor keep `npcs`=1, set `settlements`/`sessions` to 0 (Scope/Levels/Story-spine/kind-count controls all carry aria-labels since `1d8994c19`). Press `Generate drafts`.
4. The full-set attempt fails on the unique-name guard (the model reuses canon names — here "The Iron Consortium" faction + "The Lost Artifact" quest from the campaign) → audit row `AI designer generate fell back to per-entity resume — …`.
5. When the success banner lands ("Drafted 1 entities — restore point …"), click `Refresh` in the Campaign Builder drafts panel.

## Expected behavior

The kind-word/placeholder name law in the prompt (`namingRule()` in `src`… mirrored server-side `designerPrompts.js:59-61`: "Name it with a proper, unique in-world name … NEVER "npc" or the kind word, and NEVER a placeholder") should be **enforced** — a row named `npc` should fail validation, trigger the existing repair-turn ("Invalid: …"), and if it still fails, the entity should go to the honest stop/resume-failure lane. At minimum Approve should refuse/warn on a kind-word name.

## Actual behavior

- Draft row on disk: `npcs.json` gains `{ "name": "npc", "draft": true, … }` — every other field is properly grounded (Harbourmaster appearance/personality/goals/secrets/abilityScores/actions).
- The Drafts card renders the title "npc" (with `ct-draft-flag`), and `Approve` strips the draft flag → live NPC row `name: 'npc'`, `draft: None` (verified on disk + API `GET /npcs`).
- Audit trail only says `AI drafted 1 entity` / `AI designer drafted 1 entity via per-entity resume …` — no hint anything is off.
- Control: the same run's full-set leg enforced the UNIQUE-name guard (collisions refused fail-closed), so this is specifically the missing KIND-WORD/placeholder name check, not validation being absent wholesale.
- The model was told the law verbatim in the system prompt and still emitted `name:"npc"` — a law the lane cannot enforce is not a law.

## Likely location

- `server/services/ai/authoring/entitySchemas.js` `validateEntity()` (line ~449) — delegates to `validateAgainstSchema` only; `name` is a required non-empty string with no vocabulary gate. Confident (read the code).
- Fix belongs beside it: a shared `nameLawViolation(kind, name)` check (kind word, kind word inside snake/kebab, the prompt's placeholder list) applied in `validateEntity` (covers both whole-set and `generateOne` resume paths, since both route through it) so the existing repair-turn quotes it to the model.
- `designerPrompts.js` `namingRule()`/`NAME_EXAMPLES` is the prompt-side twin the server check should reuse (single source of truth).

## Suggested fix

Add the name-law check into `validateEntity` (or `generateOne`'s `res.errors` assembly) reusing the prompt's own forbidden set: `name === kind` (case-insensitive), name equal to the kind word pluralized, or any placeholder from the same list the prompt advertises ("placeholder", "example", "test", "TBD", "Untitled", "New <kind>"). Return it as a validation error so `generateOne`'s attempt-2 repair message carries it ("Invalid: name "npc" is the kind word — give the entity a proper unique name"). Also reject at approve time as a belt-and-braces guard on legacy drafts already on disk.

## Severity

Data integrity risk — approved rows become live campaign data (players could even see them), the name is what every CRUD/encounter/log lane keys on, and the unique-name guard double-acts as a quality gate this hole slips through (two separate sessions could each land an "npc"). Reproduced 1/1 live on the resume lane; the missing validator check is shared by the whole-set lane.
