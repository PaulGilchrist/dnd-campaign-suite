# EncounterModal sticky `renameTarget` — dismissing the rename form strands the next Load into Rename Encounter

## Summary
The Load-mode Rename Encounter form in `EncounterModal` stores its target in component-local state (`renameTarget`). It is cleared ONLY on a successful rename (line ~101 `setRenameTarget(null)`). Dismissing the rename form via Escape / × / backdrop routes through `onClose` and never resets it — and because the modal is hide-not-unmount (`if (!isOpen) return null` keeps the component mounted with state), the stale target survives. The next toolbar **Load** click reopens the modal straight into the **Rename Encounter** form (header `Rename Encounter`, the load list unreachable, 0 rows) until a rename succeeds or the page reloads.

## Steps to reproduce
1. Run the dev pair, open http://localhost:5173, select **test-campaign** (GM/localhost).
2. Encounters → toolbar **Load** → click the pen (rename icon) on any pool row → Rename Encounter form opens prefilled.
3. Press **Escape** (or click × / backdrop) to dismiss WITHOUT renaming.
4. Click toolbar **Load** again.
5. Observe: the modal reopens directly into the Rename Encounter form for the previously-penned row — the Load list never renders. Reload restores normal Load behavior.

## Expected behavior
Dismissing the modal (any lane: Escape, ×, backdrop, or after a completed action) resets transient local rename state, so the next Load always shows the Load list.

## Actual behavior
`renameTarget` persists across close/reopen. Live-witnessed twice during the 2026-11-16 improve run (`encounter-modal-stale-name-error`) cleanup: header read `Rename Encounter` with 0 rows immediately after an Escape-cancelled rename.

## Likely location
`src/components/encounter/EncounterModal.jsx`:
- Line 10: `const [renameTarget, setRenameTarget] = useState(null);`
- Lines 38–44: the `isOpen` effect wires dismiss but never clears `renameTarget`.
- Line 46: `if (!isOpen) return null` — hide-not-unmount, so state survives dismissal.
- Line 101: the ONLY `setRenameTarget(null)` call, on the rename-success path.

## Suggested fix
Clear `renameTarget` (and `newName`) in the dismiss/close lane — e.g. inside the `!isOpen` branch of the existing effect at :38 (mirrors how the sibling `mode` effect at :14–23 already resets form fields on transitions), or in the `onClose` handler the modal invokes. Add a regression test: pen → close → reopen in `load` mode renders the list (not the rename form).

## Severity
UX trap, not data loss — a user who cancels a rename cannot load an encounter until they reload the page. Confusing dead-end for the Encounters pool.

## Status
OPEN — filed 2026-11-16 by the improve run while live-verifying `improve(encounter-modal-stale-name-error)` (the stale-error-on-change fix is separate and already shipped; this sticky-state face is pre-existing, NOT introduced by that change).

## Resolution
FIXED 2026-11-16 (fix subagent). The diagnosis in the bug file was confirmed exactly.

**What was actually wrong:** `renameTarget` is modal-local state and the modal hides without unmounting (`if (!isOpen) return null` keeps the instance alive), but only the rename-SUCCESS path (`handleRename`) ever cleared it. Every dismiss lane (Escape / × / backdrop) routes to the parent's `onClose` (`useEncounterManagement.js` `closeModal` resets `modalMode` but cannot reach the modal's local state), so the stale target survived and the next Load reopened straight into the Rename Encounter form. Notably the save-field lane did NOT suffer this because the `mode==='save'` transition effect (parent resets `modalMode` to null on close, so reopen re-fires the effect) self-heals it — the rename production lane never leaves mode `'load'`, so nothing re-fired.

**Fix (mirrors the sibling mode-transition form-field reset idiom):** in `src/components/encounter/EncounterModal.jsx`, the dismissal effect's `!isOpen` branch now resets the transient rename state — `setRenameTarget(null); setNewName(''); setError('')` — covering ALL close lanes (Escape, ×, backdrop, and post-action closes, which all end in `isOpen=false`). The `setError` reset also stops a failed-rename error from leaking into the next open's load list. The rename-success path is unchanged. No dual-ruleset sibling applies (pure UI component).

**Files changed:**
- `src/components/encounter/EncounterModal.jsx` — `!isOpen` branch of the Escape/dismissal effect resets `renameTarget`/`newName`/`error`.
- `src/components/encounter/EncounterModal.rename-cancel-reset.test.jsx` — NEW regression test (4 cases: pen → Escape / × / backdrop → reopen renders the list, not the rename form, zero `onRename` dispatch; plus stale-error non-leak). Uses `rerender()` isOpen true→false→true to drive the exact prod hide-not-unmount lane (state survives across rerenders), matching the `createProps`/`Host` conventions of the sibling `escape-backdrop-close`/`error-clears-on-change` test files.

**Verification:**
- Live repro (pre-fix, Playwright, :5173, test-campaign, GM): Load → header `Load Encounter` 29 rows → pen → `Rename Encounter` prefilled, 0 rows → Escape → toolbar Load → header `Rename Encounter`, `renameFormVisible:true`, 0 rows. Bug confirmed exactly as filed.
- Live re-verify (post-fix): fresh nav + re-select; pen → dismiss → reopen passed on ALL THREE lanes — after Escape, after ×, and after pure backdrop the modal reopened with header `Load Encounter` and the full 29-row list each time. Zero console errors.
- Adjacent sanity: clicking a row's Load still arms the EB draft and closes the modal (toolbar flips `Save`→`Update`, then the Reset click disarms back to `Save`; the empty-draft Save-gate banner (`EncounterBuilder.jsx:270`) behaving-by-design was re-observed, not a regression). No rename was ever committed — `encounters.json` md5 `dce8d33a…` byte-exact to the baseline pin, `git status public/` empty.
- Tests: `npx vitest run EncounterModal.rename-cancel-reset.test.jsx` 4/4 pass; without the fix all 4 fail (verified by temporary revert, proving the lock). Touched-area run: all `EncounterModal.*` + `EncounterBuilder.*` + `useEncounterManagement.test.js` = 30 files / 160 tests pass. `npm run lint` exit 0, zero warnings.
- Exit hygiene: closed-tab two-pass headless Admin clears GET-verified change-data `{}` + log `[]` + overlays `[]` (disk files absent); dev pair killed, ports dark.

