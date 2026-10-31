# Admin “Select All” enforcement button is inert when Enforcement is OFF (the case it exists for)

## Summary
The new bulk **Select All** button (c6fb90ae1, 2026-10-30) lives inside
`<fieldset className="enforcement-flags" disabled={flags.mode !== 'on'}>`, so the
browser disables it whenever enforcement is OFF. The component’s own comment says the
bulk buttons are “Distinct from the master switch: both buttons keep `mode:'on'`” —
i.e. Select All is meant to be the one-click *arm-and-enable-everything* action —
but with mode off the click silently does nothing (native disabled-fieldset
occlusion; no POST, no feedback, no log).

## Steps to reproduce
1. In `test-campaign` on localhost, open **Admin** with Enforcement OFF (the default;
   change-data has no `enforcement` key).
2. Scroll to the Enforcement section and click **Select All**.
3. Observe: zero checkboxes flip, no network POST fires (check devtools Network), no
   toast/error — a silent no-op.
4. Control: tick the master **Enforcement OFF→ON** checkbox, then click **Select
   All** — all 11 boxes check and the merged blob persists.
Live-verified 2026-10-31: `button.matches(':disabled')` = **true** with mode off
(ancestor fieldset disabled), **false** after master-on; click at step 2 produced no
`enforcement` key in change-data and no `enforcement_denied` log entry.

## Expected behavior
Select All works from the disarmed state: one click writes
`{ mode:'on', …all ten flags true }` through the debounced lane (exactly what
`setAllFlags` already builds), per the code comment “both buttons keep mode:'on'”.

## Actual behavior
The click is swallowed by the disabled fieldset while mode is off. `setAllFlags`’s
`mode:'on'` line is unreachable from a click; the button only functions after the GM
already armed enforcement manually — defeating the bulk action’s purpose. Not caught
because `EnforcementSection.test.jsx` fires events directly on inputs/buttons in
jsdom, which does not apply ancestor-fieldset disabling to `.click()`/`fireEvent`
targets the way real browsers do.

## Likely location
`src/components/campaign-admin/EnforcementSection.jsx:127-135` — the
`.enforcement-bulk-actions` div sits INSIDE the disabled fieldset. Confidence: high
(component read + live `:disabled` probe + control face).

## Suggested fix
Move the `enforcement-bulk-actions` div above/outside the `<fieldset>` (or render
the fieldset only around the flag rows). Optionally keep them visually dimmed when
off but clickable, since Select All self-arms via `mode:'on'`. Add a jsdom test that
asserts `button.matches(':disabled')` semantics OR explicitly documents the
click-from-off behavior (jsdom won’t model the occlusion — test the DOM position
relative to the fieldset instead).

## Severity
Broken feature — the headline affordance of the commit is inert in exactly the
default state it was added to shortcut; silent (zero feedback).

## Resolution
FIXED 2026-10-31. Diagnosis confirmed: the `.enforcement-bulk-actions` div was
the first child INSIDE `<fieldset className="enforcement-flags"
disabled={flags.mode !== 'on'}>`, so with Enforcement OFF the browser's native
disabled-fieldset occlusion made both bulk buttons `:disabled` — Select All's
onClick never fired (live-reproduced first: `matches(':disabled')=true`, real
mouse click flipped zero checkboxes, no `enforcement` key written, log stayed
empty). Note the enforcement blob persists at change-data TOP level
(`change-data.enforcement`), not under `__campaign__`.

Changes:
- `src/components/campaign-admin/EnforcementSection.jsx` — moved the
  `.enforcement-bulk-actions` div above/outside the fieldset. **Select All** is
  now always clickable and self-arms exactly as designed (one click from OFF
  writes `{mode:'on', all ten flags true}` through the debounced lane).
  **Clear All** keeps its "only meaningful once armed" semantics via an
  explicit `disabled={flags.mode !== 'on'}` attribute instead of relying on
  fieldset occlusion (arms enforcement as a side-effect would be surprising —
  an all-false blob under a disarmed master is already the disk shape). Added
  clarifying `title` tooltips to both buttons (the bug was silent; the
  affordances now self-explain). Updated the block comment to record the
  fieldset-occlusion pitfall.
- `src/components/campaign-admin/EnforcementSection.css` — bulk row now sits
  directly above the fieldset: `margin: 10px 0 2px` mirrors the fieldset's old
  10px top spacing so the visual position is unchanged. Clear All's dimming
  rides the existing `.ct-container .ct-btn:disabled` canon (App.css).
- `src/components/campaign-admin/EnforcementSection.test.jsx` — the old
  "bulk buttons sit behind the same master gate" test ENCODED the bug
  (asserted Select All disabled while OFF); replaced with a regression test
  asserting the bulk buttons are NOT descendants of the fieldset, Select All
  is `toBeEnabled()` while OFF (real-browser `:disabled` semantics via
  jest-dom), and Clear All stays disabled until armed. Added
  "Select All self-arms from the disarmed OFF state" locking the exact
  debounced write `{...ENFORCEMENT_DEFAULTS, mode:'on', every flag true}`.
  (jsdom bypasses fieldset occlusion on fireEvent.click, so DOM position +
  `:disabled` are asserted directly, per the bug file's testing note.)

Verified:
- Live repro pre-fix matched the bug file exactly (both buttons
  `matches(':disabled')=true`, click = zero checkboxes / zero writes / zero log).
- Live re-verify post-fix (localhost:5173, header `test-campaign`, Enforcement
  OFF): Select All `matches(':disabled')=false`; one real mouse click → master
  "Enforcement ON", all 10 checkboxes checked, and the debounced lane persisted
  `{mode:'on', all 10 flags true}` at `change-data.enforcement`. Adjacent faces:
  armed Clear All zeroes all flags and keeps mode:'on'; master ON→OFF re-disables
  the fieldset + flag rows + Clear All (persisted zeroed `{mode:'off',
  all false}` blob); Select All stays clickable by design.
- Tests: `npx vitest run EnforcementSection.test.jsx` 14/14; whole
  campaign-admin folder 145/145. `npm run lint` clean (zero warnings).
- Cleanup: closed the tab, `POST /admin/clear-change-data` + `/admin/clear-log`
  (200/200) — change-data GET == `{}` (enforcement blob gone), log == `[]`.

