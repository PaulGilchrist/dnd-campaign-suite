# bug-CLA-005 collateral — Fighting Style badge click blanks sheet (Popup not defined)

**Found during:** CLA-005 Additional Fighting Style E2E (2026-10-01, test-campaign, EvasiveFighter).
**Severity:** CRITICAL (full React root unmount, blank page). **Pre-existing** — not caused by CLA-005.

## Symptom
Clicking ANY fighting-style badge span in the sheet "Fighting Styles:" row crashes the sheet:
`Uncaught ReferenceError: Popup is not defined at FighterFeatures (CharClassFeatures.jsx:922 dev-transformed)`.
Entire `#root` unmounts; body blank until manual reload.

## Repro
1. Open any sheet whose CharClassFeatures variant renders the Fighting Styles row (EvasiveFighter lv18).
2. Click an ORIGINAL badge, e.g. `span.clickable` text `Unarmed Fighting` → crash + blank body.
3. Identical crash on a NEWLY added style (`Interception`) → attribution: consumer-independent.

## Root cause
`src/components/char-sheet/char-summary/CharClassFeatures.jsx` uses `<Popup html=...>` at :381, :523, :582
(fighter / paladin-ish / ranger variants) but **never imports `Popup`** (imports list lines 2-10 verified; `rg "Popup"` finds only the 3 JSX usages + state). Any `setFightingStylePopup(...)` then render → ReferenceError, no error boundary → root dies.

## Fix suggestion
Import the app's Popup component (same one used by other char-sheet components) at top of CharClassFeatures.jsx, or route the popup through the shared popup service.

## Impact on CLA-005 verdict
CLA-005 grant chain itself VERIFIED live (chooser offers extra styles, Champion lv7 bump 1→2, persists, Interception reaction consumer row fires). Badge popup is a separate display affordance broken for ALL styles → CLA-005 recorded PASS-subset with this collateral gap.
