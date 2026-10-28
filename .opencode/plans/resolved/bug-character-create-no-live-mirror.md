# New character created in one tab never appears in other connected tabs until manual refresh (create-broadcast has no consumer)

## Summary
The server publishes `character-create-<campaign>-<file>` when a character is created, and passive clients receive it over the shared SSE, but `handleCharacterKeyEvent` in `App.jsx` explicitly **skips** `character-create-` keys — it only handles deletes and updates. The passive tab's roster therefore stays stale (missing the new party member) indefinitely, silently.

## Steps to reproduce
Starting with **test-campaign** open in two browser tabs (Tab A + Tab B), localhost:
1. In Tab B, note the sidebar Characters list (e.g. 12 PCs, no `QA RunP Wizard`).
2. In Tab A, create a new character via **Add Character** → wizard → Save (any valid name; the run used `QA RunP Wizard`, 5e Human Fighter).
3. Tab A updates correctly (its wizard re-fetches all character files after create). Watch Tab B for ~30s: the new character never appears in the Characters list; no console output, no network re-fetch, no toast.
4. Control (same session, proves the channel + consumer work for deletes): `DELETE /api/campaigns/test-campaign/QA_RunP_Wizard.json` from one tab → Tab B's sidebar link for that character **does** disappear live without reload.
5. Only after manually refreshing Tab B does the created character show up.

## Expected behavior
Symmetric with the delete/update lanes (and with the `<entity>-list-<campaign>` broadcasts proven live for NPCs/factions/quests/notes in prior runs): a newly created character should appear in every connected client's roster without a manual refresh.

## Actual behavior
Tab B silently keeps the stale roster. The server DOES publish the frame (`server/routes/campaigns-character.js` ~:251 `publish(\`character-create-…\`)`), and the same shared SSE demonstrably delivers sibling `character-delete-`/`character-…` frames live to that very tab (control step 4), yet nothing is applied — no DOM change, no console output, no network re-fetch, no toast. A GM running character creation in front of players on a big screen will show a roster that "swallows" new members until someone refreshes.

## Likely location
Confident (read the code this session):
- `src/App.jsx` `handleCharacterKeyEvent` (~:47-58): `if (key.startsWith('character-delete-')) … else if (!key.startsWith('character-create-')) {…update…}` — the `character-create-` branch is an intentional dead-end; nothing appends the payload.
- Server publishes the (unused) event: `server/routes/campaigns-character.js` POST `/api/campaigns/:campaign` (~:251) `publish(\`character-create-${campaign}-${fileName}\`, character, campaign)`.
- The creating tab only works because `useCharacterWizard.handleWizardComplete` re-fetches every character file (`src/hooks/wizard/useCharacterWizard.js` ~:47-51) — an O(all characters) reload instead of consuming the event.

## Suggested fix
Give the create key a real branch in `handleCharacterKeyEvent`: parse the file/name from the payload (`event.data` carries the full character object) and append if absent (`prev.some(c => c.name === created.name) ? prev : [...prev, created]`). While there, consider replacing the wizard's refetch-all with the same event-driven append. Add a co-located test: dispatching a `character-create-` frame adds exactly one roster entry, dedup on re-echo.

## Severity
**Minor UX issue** (data-safe: stale roster self-heals on refresh and nothing is corrupted) — but it's a live-sync asymmetry in the app's flagship SSE party-sync feature: create is silently inert while delete/update on the same channel are live.

## Resolution
**FIXED (2026-10-28, run P-fix).** Root cause confirmed exactly as diagnosed: the server POST route publishes `character-create-<campaign>-<file>` with the full character object as payload (`server/routes/campaigns-character.js:250`), the shared SSE delivers it to every client, but `handleCharacterKeyEvent` (`src/App.jsx`) routed every `character-create-` key into a no-op via the `!event.key.startsWith('character-create-')` guard — the create branch was a deliberate dead-end, so passive tabs silently kept the stale roster.

**Live repro before fixing:** two tabs on test-campaign; created `QA FixP Wizard` in Tab A via the Add Character wizard (16-step walk, Human Fighter/Champion). Tab A listed it; Tab B (window marker proves zero reloads) polled ~10s: link never appeared, count stayed 12.

**Fix (minimal, mirrors the working delete/update siblings):** `src/App.jsx` `handleCharacterKeyEvent` — replaced the exclusion guard with a real three-way branch. The new `character-create-` branch appends `event.data` if absent: `prev.some(c => c.name === created.name) ? prev : [...prev, created]`. The name dedup makes the creating tab's own SSE echo idempotent against its wizard refetch. No server, wizard, or event-schema changes (the "consider replacing the wizard refetch-all" note left as-is — the dedup makes it redundant but harmless, and keeping the change surface minimal was the priority).

**Files changed:**
- `src/App.jsx` — create branch in `handleCharacterKeyEvent` (+8 lines).
- `src/App.runtime-events.test.jsx` — replaced the "character-create is ignored" regression (which pinned the buggy behavior): a `character-create-` frame now must add exactly one `char-btn-Stranger` roster entry, must not hijack the open sheet, and a re-echo must keep it at one entry (`getAllByTestId` length 1). File-header dispatch-table doc updated to match.

**Verification:**
- Tests: `npx vitest run src/App.runtime-events.test.jsx` → 21/21 pass; folder run `npx vitest run src/App` → 7 files / 67 tests pass. `npm run lint` → zero warnings/errors.
- Live re-verification (`npm run dev:locked`, :5173, test-campaign, two tabs): created `QA FixP Two` via the wizard in Tab A → Tab B (marker `alive`, zero reloads) rendered the new sidebar link **within the poll window, no manual refresh** — expected behavior now exact. New entry appends at list end (order self-heals to server order on next refetch/reload).
- Delete-lane sanity (same handler touched): UI Delete of `QA FixP Two` in Tab A removed the link from Tab B live (marker still `alive`).
- Dedup live: Tab A showed exactly one `QA FixP Two` entry after wizard-refetch + SSE echo.
- Cleanup: both QA characters deleted via UI (disk `files` back to 12, zero QA matches), all tabs closed, `/admin/clear-change-data` + `/admin/clear-log` → `{}` / `[]` API-verified. Campaign lockdown honored: every mutation test-campaign-only.
