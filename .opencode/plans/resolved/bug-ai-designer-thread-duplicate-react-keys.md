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

## Resolution
FIXED 2026-10-31 — client-side composite key only (the mandatory minimum fix).

**What was wrong (confirmed as diagnosed):** `designNotes.appendMessages` stamps
both entries of one round-trip with the same `Date.now()`, and
`AiDesignerSection` keyed the thread `key={`${m.at || i}`}` — so each persisted
gm+ai pair collides on rehydrate. Reproduced live first: configured AI (mode
suggest, `http://localhost:8000/v1`, `Qwen3.8-Flash-Next-oQ4e-mtp`), sent "Hi",
disk showed `gm 1793463251978 / ai 1793463251978`, and the Log→Drafts rehydrate
printed `Encountered two children with the same key, 1793463251978`.

**Fix:** `src/components/campaign-builder/AiDesignerSection.jsx:158` —
`key={`${m.at ?? i}-${m.role}-${i}`}` (index guarantees uniqueness even if two
messages ever share `at` AND role; optimistic pre-persist messages without `at`
still key distinctly). The shared `at` is kept server-side as a per-round-trip
stamp — it is semantically the "one exchange" timestamp, ordering is index-based,
and the client fix also protects already-persisted files. **Server-side per-entry
stamp deliberately NOT added** (optional item; choosing minimal surface).

**Files changed:**
- `src/components/campaign-builder/AiDesignerSection.jsx` (key fix)
- `src/components/campaign-builder/AiDesignerSection.test.jsx` (new lock test:
  persisted gm+ai pair sharing one `at` renders without a console "same key" error)

**Verification:**
- New test fails against the pre-fix key (negative check run: 1 failed | 4 passed)
  and passes with the fix; full folder run `npx vitest run
  src/components/campaign-builder/` = 10/10 pass; `npm run lint` clean.
- Live re-verify (Vite HMR): after the fix, a second round-trip persisted another
  shared-`at` pair (2 pairs / 4 messages on disk), full page reload + fresh Drafts
  mount + Log→Drafts rehydrate each rendered all 4 messages in GM/Designer order
  with ZERO new duplicate-key console errors (console error count stayed flat at
  the 3 pre-fix occurrences across post-fix renders; sending still works).

**Baseline restored:** AI turned off via Admin, tab closed, `clear-change-data` +
`clear-log` via API (change-data `{}`, log `[]`, ai status off), and
`design-notes.json` residue removed — mirroring the AP baseline fingerprint which
records that exact file as prior AP-session residue deleted the same way.

