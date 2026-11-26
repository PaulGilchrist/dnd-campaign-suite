# Bug: Escape inside the wizard's Discard toll re-arms it forever — KEEP can never be answered with Escape

## Summary
In the character-creation wizard, once the dirty-draft "Discard Changes?" toll (`DiscardDraftDialog`, shared `DeleteConfirmModal` tier) is open, pressing Escape CLOSES the toll and a byte-identical fresh toll REMOUNTS ~1.5 ms later within the same keydown event. The user can never KEEP the draft with Escape — the dialog respawns indefinitely. The hooks' own docstrings claim the opposite ("the toll's own Escape answers KEEP", "Suppressed while a role=dialog child is mounted") — the suppression guard loses a React-19 flush-order race.

## Steps to reproduce
1. In a throwaway campaign (e.g. `qa-starter` quick-create), open the character wizard ("Add your first character").
2. Step 1: pick any build mode + ruleset (the ruleset card auto-advances to Step 2).
3. Step 2: type a name into "Character Name" (draft now dirty).
4. Click the header × (`.character-creation-wizard-overlay .close-btn`) → the `Discard changes to "<name>"?` toll opens; initial focus lands on its **Cancel** button (inside `[role=dialog]`).
5. Press Escape.
6. Observe: a toll is STILL on screen (`document.querySelectorAll('[role=dialog]').length === 1`), the wizard stays, and repeated Escapes keep producing a "new" toll — never dismissing.

Wire proof (in-page MutationObserver on body subtree, `[role=dialog]` add/remove): one trusted Escape produces
`REM 339716.6` → `ADD 339718.1` (unmount then immediate remount, same tick).
Control faces that DO work and isolate the lane:
- Click **Cancel** → toll closes, draft held (zero write).
- Click the toll's backdrop → closes (KEEP).
- Click **Yes, Discard** → wizard closes.
- Synthetic `new KeyboardEvent('keydown',{key:'Escape',bubbles:true})` dispatched on the PANEL element itself (not via focus) → toll closes and stays closed (window listener then sees dirty draft… see note; the reliable witness is the Cancel-click control vs the focus-in-dialog trusted-press loop).
- Native listeners prove the trusted event bubbles through the panel untouched (`defaultPrevented=false`), so no stopPropagation is involved.

## Expected behavior
Per `src/hooks/wizard/useWizardEscape.js` and `useWizardCloseGuard.js` docstrings: while the discard toll (a `role="dialog"` child) is mounted, the wizard's Escape lane must be SUPPRESSED and the toll's own Escape answers KEEP (closes the toll, draft stays) — identical to every other `DeleteConfirmModal` consumer.

## Actual behavior
The toll's React `onKeyDown` fires at the `#root` delegate and unmounts the dialog; React 19 flushes discrete-event updates synchronously WITHIN the root handler, i.e. before the same keydown continues bubbling to `window`. `useWizardEscape`'s window listener then runs `document.querySelector('[role="dialog"]')` against the ALREADY-UPDATED DOM → sees no dialog → calls `handleRequestClose()` → `confirmDiscardDraft()` (draft still dirty) → arms a fresh toll. Net effect: Escape is a no-escape; the toll respawns on every press. No console errors, no network writes (each re-arm settles the previous promise KEEP, so no data-integrity damage — but the documented interaction law is broken and keyboard-only users cannot cancel the dismiss).

## Likely location
Confident (wire-traced live):
- `src/hooks/wizard/useWizardEscape.js` — window bubble listener guarding only on `document.querySelector('[role="dialog"]')`, which is read AFTER React's sync flush of the same event.
- `src/hooks/wizard/useWizardCloseGuard.js` — wires that handler to `confirmDiscardDraft`, whose re-arm path in `src/hooks/management/useReloadGuard.js` ("re-entrant ask answers the PREVIOUS pending toll KEEP before arming the new one") makes the respawn silent.
- `src/components/common/DeleteConfirmModal.jsx:120` — the subtree `onKeyDown` that settles the toll first (correct behavior, just first in the race).

## Suggested fix
Make the suppression guard event-based, not DOM-timing-based: in `useWizardEscape`'s `onKey`, ALSO bail when the keydown originated inside a dialog — `if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;` — before the DOM census. Since `DeleteConfirmModal` moves initial focus into the toll, the toll's own handler always answers and the wizard lane never re-asks. Alternative: pass the hook's `discardRequest` React state (truthy = child toll mounted) into `useWizardEscape` instead of the DOM query. Add a live-browser (non-jsdom) regression note: jsdom cannot produce the REM-flush-before-window-listener order, so this face is unit-invisible by construction — pin at least the `e.target.closest('[role=dialog]')` guard as a unit with a `document`-level second listener simulating the wizard lane.

## Severity
Minor UX issue (keyboard-trap on a shipped modal family + a false documented law); no data-integrity risk because every re-arm settles KEEP and zero writes occur.
