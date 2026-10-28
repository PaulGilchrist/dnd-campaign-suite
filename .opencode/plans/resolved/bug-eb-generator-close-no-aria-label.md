# Bug: Encounter generator modal close button is a bare `×` with no accessible name

### Summary
The generator modal's header close button renders a raw `&times;` glyph with no `aria-label`, unlike its sibling modals in the same family. It is untargetable by accessible-name queries (Playwright `getByRole('button', {name:'Close'})`, `[aria-label=...]`), which the QA harness and every sibling modal rely on, and it is announced as nothing meaningful to screen readers.

### Steps to reproduce
1. localhost:5173, campaign `test-campaign`, Encounters page.
2. Click toolbar `Generate encounter` → generator modal (`.gen-modal-overlay`) opens.
3. Inspect the header close button: `<button className="encounter-modal-close" onClick={onClose}>&times;</button>` — no `aria-label`, text is only `×`.
4. `getByRole('button', {name:'Close'})` inside the modal resolves ZERO nodes; the sibling Load modal's close IS labelled.

### Expected behavior
Close button carries `aria-label="Close"` (or the app's canonical equivalent) matching the shared modal chrome, so it is locatable by accessible name and announced properly.

### Actual behavior
Bare `×` with no accessible name; harness must fall back to class/positional selectors, screen readers get nothing useful.

### Likely location
Confident: `src/components/encounter/EncounterGeneratorModal.jsx:140` — `<button className="encounter-modal-close" onClick={onClose}>&times;</button>`. `src/components/encounter/EncounterModal.jsx:92` renders the same class WITH `aria-label="Close"` — the generator modal simply drifted from the family convention.

### Suggested fix
Add `aria-label="Close"` to the generator modal close button; pin it in the co-located generator test (sibling convention). Zero behavior change.

### Severity
Minor a11y/automation-legibility issue — no data risk, but it breaks the aria-pinned selector canon the QA harness depends on (`button[aria-label='Close "X"']` / `Close` lanes).

## Resolution

**Status: FIXED (2026-10-28, improve run)**

### Root cause
`EncounterGeneratorModal.jsx:140` rendered the header close button as `<button className="encounter-modal-close" onClick={onClose}>&times;</button>` — the `aria-label="Close"` present on the sibling chrome (`EncounterModal.jsx:92`) was never copied when the generator modal was introduced (family-convention drift). Accessible name fell back to the `×` glyph text, invisible to `getByRole('button', {name:'Close'})` and unannounced by screen readers.

### Changes
- `src/components/encounter/EncounterGeneratorModal.jsx:140` — added `aria-label="Close"`; zero behavior change.
- `src/components/encounter/EncounterGeneratorModal.test.jsx` — the existing "the header close button closes without applying" test had to change anyway: it located the button by `getByRole('button', {name:'×'})`, the very unlabelled name the bug was filed about. Rewrote it as "the header close button is labelled \"Close\" (family convention) and closes without applying", mirroring `EncounterModal.test.jsx:82` (`getByRole('button', { name: 'Close' })`) plus an explicit `toHaveAttribute('aria-label', 'Close')` pin. No new test file needed — folder already had a co-located modal render suite.
- **Criterion-2 audit:** the only close/dismiss affordance in `EncounterGeneratorModal.jsx` is that one header button (single `encounter-modal-close` occurrence). All other buttons (quick-picks, Generate, Apply, Previous-roll toggle) carry visible text labels — no other unlabeled affordances found; nothing else re-labelled.

### Live evidence (Vite :5173, campaign header `test-campaign` verified after select)
Encounters nav → `button[aria-label="Generate encounter"]` → `.gen-modal-overlay` opened; `locator('.gen-modal-overlay').getByRole('button', {name:'Close'})` resolved **exactly 1** node with `aria-label="Close"`; clicking it removed the overlay (`modalClosed:true`); console error listener captured **zero** errors for the whole open/close cycle. Change-data untouched beyond the benign campaign-select player-stub reseed; log `[]` API-verified.

### Tests / lint
- `npx vitest run src/components/encounter/EncounterGeneratorModal.test.jsx` → 13/13 pass.
- `npx vitest run src/components/encounter/` → 378 files / 1876 tests, all pass.
- `npm run lint` → clean, zero warnings.

