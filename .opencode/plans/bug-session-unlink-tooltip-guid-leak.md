# Session planner unlink tooltip leaks raw note GUID instead of note title

## Summary
In the Sessions planner modal, linked notes store their GUID as the link value. The visible chip correctly resolves the GUID to the note title, but the unlink button tooltip (and the "Move to…" control) render the raw GUID, e.g. `Unlink cb7fa303-dfcc-4586-b7da-4c37e568dd4c`.

## Steps to reproduce
1. In test-campaign, Sessions → New Session.
2. Enter a name, then in "Link Notes" choose the existing note ("Important Plot Hook…").
3. Hover the red link-slash (unlink) button on the linked-note row.

## Expected behavior
Tooltip reads "Unlink Important Plot Hook…" (the note title), matching the visible chip text.

## Actual behavior
Tooltip (accessible name) reads `Unlink cb7fa303-dfcc-4586-b7da-4c37e568dd4c`. Observed live in the accessibility snapshot as `button "Unlink cb7fa303-dfcc-4586-b7da-4c37e568dd4c"`.

## Likely location
Confident: `src/components/sessions/SessionPlannerModal.jsx` — `LinkPicker` defines `labelFor(value)` (line ~14) and uses it for the chip (line ~40), but `title={`Unlink ${name}`}` (line ~76) and `aria-label={`Move ${name} to another session`}` (line ~67) interpolate the raw value. For maps/npcs/quests/settlements the value *is* the name, so only notes leak.

## Suggested fix
Use `labelFor(name)` in both the unlink `title` and the move `aria-label`.

## Severity
Minor UX issue — icon-only buttons have a meaningless raw-GUID accessible name for screen readers and hover help.
