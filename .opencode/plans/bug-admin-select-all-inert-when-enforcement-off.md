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
