# AI Designer chat thread renders with duplicate React keys (gm+ai pair share one timestamp)

## Summary
`designNotes.appendNotes` stamps every message of one round-trip with the SAME
`Date.now()` value, and `AiDesignerSection` keys the rendered thread by `m.at` —
so each persisted GM+Designer pair produces a React “two children with the same
key” console error on every re-render of the Drafts view.

## Steps to reproduce
1. In `test-campaign` (localhost, GM), configure AI in Admin (mode suggest, endpoint
   `http://localhost:8000/v1`, live model).
2. Open the Drafts (Campaign Builder) view. Send one chat message in the AI Designer
   and wait for the reply.
3. Navigate to any other view (e.g. Log) and back to Drafts — the thread rehydrates
   from `data/design-notes.json` and re-renders.
4. Open the browser console.

## Expected behavior
Every thread message gets a unique React key; zero console errors.

## Actual behavior
Two errors **per render** (one per persisted pair), observed live 2026-10-31:

    Encountered two children with the same key, `1793447128891`. Keys should be
    unique so that components maintain their identity across updates. Non-unique
    keys may cause children to be duplicated and/or omitted…

Disk proof — `public/campaigns/test-campaign/data/design-notes.json`: the gm and ai
rows of each round share `at` byte-identically (gm 1793447128891 / ai 1793447128891,
gm 1793447152849 / ai 1793447152849). Console grew to 18 of this exact line across
the session (repeated re-renders). Rendering happened to be correct during this run,
but React documents duplicate-key output as unsupported (children may be
duplicated/omitted on updates).

## Likely location
- `server/services/ai/authoring/designNotes.js:37-38` — `const now = Date.now();
  entries.map(e => ({ …, at: now }))` stamps the whole batch identically.
- `src/components/campaign-builder/AiDesignerSection.jsx:158` —
  `key={`${m.at || i}`}` assumes `at` is per-message-unique.
Confidence: high (both lines read; error key values match disk timestamps exactly).

## Suggested fix
Either stamp per-entry (`at: Date.now() + index` is hacky; simpler: keep the shared
`at` for ordering but key the thread `key={`${m.at}-${m.role}-${i}`}`), or in
`designNotes.js` compute the timestamp inside the map. The client-side composite key
is the minimum fix and also protects already-persisted note files.

## Severity
Minor UX issue — no visible breakage observed yet, but it is a guaranteed console
error on every Drafts render and an unsupported React state that can drop/duplicate
messages on future updates.
