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

## Resolution
FIXED 2026-10-31 (client-side projection, per the preferred option in the bug file).

**What was actually wrong** — as diagnosed, with two amendments:
- Reproduced live first: Admin AI config (suggest, `http://localhost:8000/v1`,
  `Qwen3.8-Flash-Next-oQ4e-mtp`) → NPC editor (Marta Copperkettle) → Refine with AI →
  instant red `.ai-refine-error` strip: `value has unknown field 'image' … · 'imageName' …
  · 'imagePath' …` — pre-model preflight rejection, zero model calls. (Marta's disk row
  itself carries the trio, so on her the numeric clause didn't fire; it fires whenever the
  GM types HP/AC into the raw-input stat fields.)
- The suggested coercion of `initiativeBonus` to integer was WRONG against ground truth:
  `npcSchema.initiativeBonus` is `{ type: 'string' }` — the projection leaves it untouched.
  Also found a second latent defect the filing missed: `onReplaced={setFormData}` was a
  bare REPLACE, and the schema-clean proposal carries no image fields or row stamp —
  applying it silently dropped the avatar from the form, and the next Save would have
  wiped `image*` from the disk row.

**Changes (client only, no server edits):**
- `src/services/npcs/npcFormUtils.js` — new `projectNPCForRefine(data)`: reuses
  `cleanNPCData` (AC blank/NaN → null with loud console.error, same rules as the save
  lane), strips the GM-owned upload trio (`image`/`imageName`/`imagePath`), and coerces
  string `hitPoints` to integer (NaN → null, loud). Server preflight keeps stripping the
  server-owned stamps; the server contract stays strict.
- `src/components/npcs/NPCFormModal.jsx` — footer passes
  `entity={projectNPCForRefine(formData)}` (mirrors the `EncounterAiRefine` projection
  pattern) and merges the proposal: `setFormData(prev => ({ ...prev, ...replacement }))`
  so the upload trio + `updatedAt` stamp survive on the form (still form-only — the
  Save lane remains the only path to disk).
- `src/components/npcs/NPCFormModal.ai-refine.test.jsx` — NEW regression suite
  (6 tests) pinning: payload has no image keys, `hitPoints:'45'`→45 / `armorClass:'15'`→15
  integers, blank stats → null, `initiativeBonus` stays the string `'+2'`, proposal
  merges into the form with avatar/stamp preserved and zero writes, error path leaves
  the form untouched; plus purity + loud-null pins for `projectNPCForRefine`.

**Verification:**
- Live re-run of the exact repro in `test-campaign`: refine reaches the model
  (~8 s at 38 tok/s, no instant preflight error), replacement lands in the form
  (Personality: “Warm and inviting, but tends to fidget with her apron strings when
  nervous”), avatar still rendered, and `GET /npcs` during the proposal shows
  `personality:""`, image trio + `updatedAt` byte-identical (never-write holds).
- Adjacent lanes: × on the dirty form pays the named “Discard changes to
  `\"Marta Copperkettle\"`?” confirm and reloads the pristine row; the refine-row ×
  closes cleanly; normal Save on the unmodified form round-trips with the image trio
  surviving the CRUD lane (disk row value-identical).
- `npx vitest run src/components/npcs src/services/npcs src/components/common` →
  69 files / 818 tests passed. `npm run lint` → clean (zero warnings).
  `no-timers-guard` → OK.
- Teardown: proposal discarded (never saved), AI mode back to off (`configured:false`),
  tab closed, change-data `{}` + log `[]` GET-verified.

**Same-family notes (NOT fixed, flagged for triage):**
- `SessionPlannerModal.jsx:228` passes raw `entity={formData}` seeded from
  `getDefaultSessionData`, which ALWAYS carries `playedAt:null` and `checklist:[]` —
  neither is in `sessionSchema` (`additionalProperties:false`) → the session editor
  refine face is almost certainly dead the same way (live face un-walked).
- `Factions.jsx:426`: clearing the influence input yields `parseInt('')` → `NaN`,
  which serialises to `null` against a non-nullable integer schema field — edge case
  only (default form + disk rows pass; the id/updatedAt on faction rows are stripped
  server-side). Factions/Settlements forms otherwise match their schemas.
