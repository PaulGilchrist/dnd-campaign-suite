# Quests view renders raw `\u2026` escape sequences in placeholders and loading text

## Summary
The Quests editor/search/empty-state show the literal seven-character string `\u2026` where an ellipsis (…) was intended, because the escape was written in JSX attribute string literals and raw JSX text, where JavaScript escape sequences are not processed. Quests is the only component in `src/` with this defect (grep-confirmed); sibling `.ct-*` views correctly render real ellipses (e.g. Sessions search shows `Search sessions…`).

## Steps to reproduce
1. In test-campaign, open the Quests view from the sidebar.
2. Read the search box placeholder → shows `Search Quests\u2026`.
3. Click the `The Lost Artifact` row to open the editor → the three textarea placeholders show `Describe the quest\u2026`, `Describe rewards\u2026`, `Additional notes\u2026`.
4. (Code check) `grep -n '\\u2026' src/components/quests/Quests.jsx` → lines 129, 137, 145, 339 are JSX attribute strings; line 357 is a raw JSX text child `Loading quests\u2026` (also literal). Lines 159/177 `'Saving\u2026'`/`'Deleting\u2026'` sit inside JS string expressions and are the only ones that render correctly.
5. Live DOM proof: `[...document.querySelectorAll('textarea')].map(t => t.placeholder)` returns `"Describe the quest\\u2026"` etc. (backslash present in the attribute value).

## Expected behavior
Placeholders/empty-state read `Describe the quest…`, `Describe rewards…`, `Additional notes…`, `Search Quests…`, `Loading quests…` — matching the rest of the app (Sessions `Search sessions…`, map inputs etc.).

## Actual behavior
Users see raw `\u2026` text in 5 visible strings in the Quests view. No console errors; purely a rendering/text defect.

## Likely location
Confident: `src/components/quests/Quests.jsx` lines 129, 137, 145, 339 (JSX `placeholder="…\u2026"` attribute strings) and line 357 (JSX text child `Loading quests\u2026`). Root cause: JSX attribute values and JSX text children are NOT JavaScript string literals, so `\u2026` is taken verbatim; the escape only works inside `{'…\u2026'}` expressions (why the Save/Delete labels are fine).

## Suggested fix
Replace the five literal-escape occurrences with the real `…` character (or `{'\u2026'}` interpolation). One-line-each edit; consider an ESLint no-useless-escape-adjacent sweep or a one-off grep (`placeholder="[^"]*\\u`) as a regression pin. Check `Quests.test.jsx` for any pins on the broken strings and update them in the same pass.

## Severity
Minor UX issue — visible broken text in a GM view; no functional impact (typing/saving still work, and conflict/validation lanes were verified healthy around it).

## Resolution
**FIXED 2026-10-28.** Original diagnosis confirmed exactly: JSX attribute strings and raw JSX text children are not JavaScript string literals, so `\u2026` was taken verbatim.

**Root cause (verified):** `src/components/quests/Quests.jsx` lines 129/137/145/339 (`placeholder="…\u2026"` attribute strings) and 357 (JSX text child `Loading quests\u2026`). Lines 159/177 (`'Deleting\u2026'` / `'Saving\u2026'`) sit inside JS string expressions and were already correct — left untouched.

**Fix:** Replaced the five literal escapes with the real `…` character, matching sibling `.ct-*` convention (Sessions `Search sessions…`, Settlements placeholders). App-wide sweep (`grep -rnE 'placeholder="[^"]*\\u|>[^<]*\\u2026' src/`) confirmed Quests was the ONLY component with this defect class; remaining `\u2026` occurrences (Quests 159/177 + `Settlements.listRendering.test.jsx:137`) are valid JS-string escapes.

**Files changed:**
- `src/components/quests/Quests.jsx` — 5 one-line replacements (129, 137, 145, 339, 357)
- `src/components/quests/Quests.test.jsx` — 3 new regression tests: search placeholder `toHaveAttribute('placeholder','Search Quests…')`; editor textarea placeholders contain real `…` + no literal `\u2026` anywhere in rendered body; loading text contains `Loading quests…` and not `\u2026`. Existing tests pinned nothing on the broken strings (loading test used `/Loading quests/` regex) — no test updates needed.

**Verification:**
- Live repro (before fix, Playwright in test-campaign): search placeholder DOM attribute = literal `Search Quests\u2026`; opening The Lost Artifact editor, all three textarea placeholders literal `Describe the quest\u2026` etc.
- Live re-verification (after fix, fresh reload): `Search Quests…`, `Describe the quest…`, `Describe rewards…`, `Additional notes…` all real ellipses; `document.body.innerHTML` contains zero literal `\u2026`. Sanity: typed + saved a quest edit (modal closed, row updated), then restored baseline description byte-exact (API `quests` read confirms).
- Tests: `npx vitest run src/components/quests/Quests.test.jsx` → 28/28 pass; folder `src/components/quests/` → 6 files / 44 tests pass. `npm run lint` → clean (zero warnings).
- Cleanup: change-data `{}` + log `[]` API-verified from closed-tab quiet; quest data at baseline.

