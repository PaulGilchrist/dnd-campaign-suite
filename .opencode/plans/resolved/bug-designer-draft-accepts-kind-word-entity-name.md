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

## Resolution

**FIXED (2026-11-13).** The diagnosis held exactly: `validateEntity()` was pure schema validation (any non-empty string name), so a kind-word row passed every generation lane and `approveDraft` stripped the draft flag through the kind's normal save lane with zero warning — re-verified live pre-fix: the Drafts card rendered "npc" and Approve persisted a live `npcs.json` row named "npc" (banner empty, no log row).

What changed:

- **`src/services/ai/entityNameLaw.js` (NEW)** — the shared law predicate `nameLawViolation(kind, name, field)` + `NAME_PLACEHOLDERS`. Compares FLATTENED names (lower-cased, non-alphanumerics stripped) with EXACT equality against every kind word (±plural, `new<kind>`) and the prompt's placeholder list — so the shape-leak spellings ("npc", "NPCs", "map-plan", "map_plan", "New npc", "Untitled", "TBD") are refused while names that merely CONTAIN a law word ("Testament", "The Testing Grounds Guild") can never false-positive. Lives on the `src/services/ai` shared-layer seam already used by `refine.js`/`dressMap.js` (server imports client pure logic), so server validator and client approve guard share ONE source of truth.
- **`server/services/ai/authoring/entitySchemas.js`** — `validateEntity()` now appends the law errors after the schema verdict. Because whole-set (`apply.js collectBlueprintErrors`), per-entity resume (`designer.js generateOne`) and refine (`refine.js` preflight + replacement) ALL route through `validateEntity`, the fix covers every authoring seam at once and the existing repair turns quote it verbatim ("Invalid: name "npc" is a kind word — give the npc a proper, unique in-world name…"). mapPlan's `displayName` is checked as the second name-bearing field.
- **`server/services/ai/authoring/designerPrompts.js`** — prompt `namingRule()` copy kept BYTE-IDENTICAL (pinned by `designerPrompts.test.js`) but the placeholder vocabulary it advertises is now imported/re-exported from the shared module — the prompt bans exactly what the validator checks. Stale "SOFT prompt fix only" owner-ruling comment corrected in place.
- **`src/services/campaign/draftActions.js`** — belt-and-braces: `approveDraft` refuses (throws, CampaignBuilder surfaces it in its error banner) any draft row whose name breaks the law, guarding legacy kind-word drafts already on disk from before the validator grew the check. No new server endpoints, no new write semantics.

Tests (new, all co-located):
- `server/services/ai/authoring/entitySchemas.name-law.test.js` — refuse faces per kind + casing/plural/kebab/snake + placeholders + mapPlan displayName; compliant names and EVERY real test-campaign row still validate; ENTITY_KINDS↔law-word parity pin.
- `server/services/ai/authoring/designer.name-law.test.js` — the exact bug lane: resume attempt-1 `name:"npc"` fails validation, attempt-2 repair message starts `Invalid: name "npc" is a kind word`; a stubborn model honestly stops (`AI_NEEDS_HUMAN`, `generation stopped at npc #1/1`, zero apply, audit row) instead of drafting "npc".
- `server/services/ai/authoring/apply.name-law.test.js` — whole-set face: `collectBlueprintErrors` quotes `npcs[0] "npc": name "npc" is a kind word…` into the batch repair; `applyBlueprint` refuses before snapshot/draft write.
- `src/services/ai/entityNameLaw.test.js`, `src/services/campaign/draftActions.name-law.test.js` — predicate units + approve-gate refusal (no save lane touched) + control (properly-named draft approves byte-identically).

Live verification (test-campaign, localhost):
- Pre-fix repro confirmed: `validateEntity('npc',{name:'npc'})` → `{ok:true}` against the real server modules; a `draft:true` row "npc" rendered in the Drafts card; Approve → live `npcs.json` row, zero warning, zero log row.
- Post-fix: same row → Approve shows banner `Not approved — name "npc" is a kind word — give the npc a proper, unique in-world name, never its kind word or a placeholder. Reject this draft and regenerate…`, the draft STAYS a draft (disk verified `draft:true` throughout). Control draft "Zara Tidecaller" approved fine (flag stripped, no banner). Server lane driven directly: `validateEntity`/`collectBlueprintErrors` both refuse the "npc" row with the law text; `mapPlan` snake/kebab leaks and `displayName:"Untitled"` refused.
- Real-model designer generate (Qwen rig): the model returned a compliant (empty-entity) blueprint on attempts:1 — the law blocked nothing it shouldn't; no kind-word draft ever reached disk. (The repair-turn quote itself is pinned by the scripted-model designer test; forcing the model to leak again is nondeterministic.)
- Cleanup proven: all 9 canonical data md5s byte-exact (npcs `db6666c1`, design-notes `d5e0f95c`, …), own snapshot zip deleted (3 pre-existing kept), change-data `{}` + log `[]` + overlays `[]` GET-verified, disk cd/log files absent.
- `npx vitest run` touched folders 61 files/598 tests green; FULL suite 3263 files/35,213 tests green; `npm run lint` zero warnings; `no-timers-guard` OK.

Note: the 2026-10-31 owner ruling "SOFT prompt fix only — validators untouched" is superseded by this fix's own evidence (the prompt-only law failed 1/1) — enforcement now lives in the validator, exactly as this bug file's Expected section demanded.
