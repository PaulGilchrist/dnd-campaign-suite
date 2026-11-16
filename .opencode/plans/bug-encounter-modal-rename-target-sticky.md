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
