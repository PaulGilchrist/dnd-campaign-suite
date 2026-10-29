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
