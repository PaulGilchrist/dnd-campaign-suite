# Upload confirm-modal Cancel leaves the file selected — re-choosing the same zip is a silent no-op (and the previous error status lingers)

## Summary
Cancelling the "Upload Campaign" confirmation modal does not reset the file input (`e.target.value=''` only runs on the client-validation error path and after onConfirm). The input keeps the cancelled file, so when the user immediately re-selects the SAME file (the natural "wait, actually do it" gesture), the browser fires no `change` event → no modal, no request, no status, no feedback. Nothing happens until a *different* file is chosen or the page reloads. Related nit: the previous error status line ("Please select a .zip file") stays visible across the subsequent (successful) modal open, muddying state.

## Steps to reproduce
Proven live 2026-10-28 (run O), test-campaign → Admin, localhost:5173:

1. In Admin → Backup & Restore → Upload Campaign, choose any valid-named `.zip` (e.g. `garbage.zip`). The "Upload Campaign" confirm modal opens; the input now reports `files = ["garbage.zip"]`.
2. Click **Cancel** in the modal. Modal closes; the input STILL holds `garbage.zip` (verified via `input.files`).
3. Re-select the exact same file (`garbage.zip`) through the control.
4. Observe: no confirm modal, no status change, no network request (Playwright re-set of the identical files list produced `modalOnReSelect: 0` after 800 ms; the harness-level equivalent is the native picker, where `change` does not fire because `input.value`/files are unchanged — the component only clears `value` in the non-zip error branch and after Confirm).
5. Nit check: the red "Please select a .zip file" status from an earlier non-zip attempt remains rendered while/after the cancel, so the visible status does not reflect the latest action.

## Expected behavior
Cancel should reset the input (`e.target.value=''`) and clear/refresh the status line, so re-selecting the same file reliably re-opens the confirmation modal.

## Actual behavior
Cancelled file persists in the input; same-file re-selection is indistinguishable from a dead button (zero popup/modal/network/status). Users will conclude "Upload is broken."

## Likely location
Confident: `src/components/campaign-admin/CampaignAdmin.jsx` → `handleUpload` (the `setConfirmModal({ ... })` call). `onClose`/Cancel maps to `setConfirmModal(null)` without touching `e.target.value`; the only `e.target.value = ''` statements are the early non-zip return and the end of `onConfirm`. Same pattern check: `handleRollback`/Delete use modals without file inputs, so this is upload-specific.

## Suggested fix
In the ConfirmModal `onClose` path for uploads (or simply when the modal dismisses without confirm), reset the originating input: keep a ref to the file input and set `ref.current.value = ''` when `modal.title === 'Upload Campaign'` closes, or clear the value up-front right after reading `e.target.files[0]` (copy the File reference first — it stays valid).

## Severity
**Minor UX issue** — no data risk (nothing mutates), but a primary destructive-flow control becomes unresponsive to the most natural second attempt with zero feedback.
