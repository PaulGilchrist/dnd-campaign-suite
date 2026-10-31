# NPC editor "Refine with AI" always fails preflight validation — feature dead from the UI

## Summary
The AI Refine button in the NPC editor (Phase 6) never reaches the model: the client
passes the raw editor `formData` (which always carries `image`/`imageName`/`imagePath`
keys and string-typed `hitPoints`/`armorClass`) to `/api/campaigns/:c/ai/refine/npc`,
where the schema preflight (`additionalProperties: false`, numeric types) rejects it
every time. The same entity refined via the API lane succeeds, proving the model and
funnel work — only the editor wiring is broken.

## Steps to reproduce
1. In `test-campaign` (localhost, GM), configure AI in Admin (mode `suggest`, endpoint
   `http://localhost:8000/v1`, any live model) — confirmed working 2026-10-31.
2. Open the NPCs view, click an NPC name (e.g. `Sael Mourn`, or the baseline
   `Marta Copperkettle` — any NPC works) to open the editor modal.
3. Click **Refine with AI**, type any instruction (e.g. “Give him one nervous habit
   and make his speech less cryptic. Keep name and race.”), press **Apply to form**.
4. Observe the red `.ai-refine-error` strip instead of the form updating.
   Reproduced live 2026-10-31 against an AI-approved NPC.

## Expected behavior
The model returns a complete replacement NPC and it is dropped into the editor form
(no save until the GM presses Save — the never-write rule).

## Actual behavior
Refine fails before any model call with schema errors, e.g.:

    $.hitPoints must be a integer or a null · value has unknown field 'image' —
    not part of this entity's shape (server-owned fields like id/updatedAt are never
    sent) · value has unknown field 'imageName' …

Control probes (same campaign, same minute):
- POST `/api/campaigns/test-campaign/ai/refine/npc` with the **disk row** for Sael
  Mourn (no image keys, no hitPoints key) → `{ok:true, replacement:{…}}` — the funnel
  itself is healthy.
- The editor form always carries `image`/`imageName` (NPCFormModal sets them on
  upload/remove; loaded rows like Marta keep `image:'' imageName:'' imagePath:''`
  from npcs.json), and `NPCStatBlockForm` keeps `hitPoints` as the raw input string
  (`e.target.value`).

## Likely location
- `src/components/npcs/NPCFormModal.jsx:39` — `entity={formData}` passes uncleaned
  form state. The save lane at `src/components/npcs/NPCs.jsx:154` correctly routes
  through `cleanNPCData(formData)` first; refine skips it (and `cleanNPCData` itself
  would not strip the image fields either — they are legitimate for the CRUD lane).
- `server/services/ai/authoring/refine.js` `preflight()` — strips only
  `draft/updatedAt/savedAt/id` before `validateEntity`.
- `server/services/ai/authoring/entitySchemas.js` `npcSchema` — intentionally
  `additionalProperties:false` excluding GM-owned image fields; numeric
  `hitPoints`/`armorClass`.
Confidence: high (both client and server lanes read; failure reproduced live with
matching error text; API control probe passes).

## Suggested fix
Project the entity into the authored-row shape before sending: in `NPCFormModal.jsx`
pass a stripped clone (drop `image`, `imageName`, `imagePath`; coerce numeric-string
`armorClass`/`hitPoints`/`initiativeBonus` to integer/null like the save lane does),
or extend `refine.js preflight()`’s strip list with the GM-owned upload trio and
numeric-coerce string numbers for the INPUT check only (the replacement stays
schema-clean by construction). Client-side projection is preferable — it keeps the
server contract strict. Add an NPCFormModal test asserting the refine payload has no
image keys and numeric stat fields (mirror `EncounterBuilder.ai-refine.test.jsx`).

## Severity
Broken feature — the GM-facing NPC refine lane (the entire Phase 6 editor surface
for this kind) can never succeed; only the API-direct lane works.
