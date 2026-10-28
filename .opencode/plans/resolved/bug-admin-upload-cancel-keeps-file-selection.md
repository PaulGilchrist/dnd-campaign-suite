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

## Resolution
Fixed 2026-10-28 (retry run; original live repro proven in run O).

**Actual root cause:** exactly as diagnosed — `handleUpload` cleared `e.target.value` only in the non-zip/oversize early-return branches and at the end of `onConfirm`; the confirm modal's Cancel path (`setConfirmModal(null)`) never touched the input, so the cancelled file stayed selected and the native picker fires no `change` event while value/files are unchanged → same-file re-selection was a silent no-op, with the previous error status line lingering.

**Files changed:**
- `src/components/campaign-admin/CampaignAdmin.jsx`
  - New module-level `clearFileInput(input)` helper: sets `input.value = ''` and resets `files` via `new window.DataTransfer().files` (fallback `input.files = []` for environments without `DataTransfer`), so both native and jsdom semantics see an empty selection.
  - Added `uploadInputRef` (`useRef`) on the upload file input.
  - New `handleConfirmModalClose`: when a modal with title `'Upload Campaign'` dismisses without confirming, it calls `clearFileInput(uploadInputRef.current)` and `setStatus(null)` (line reflects the latest action), then closes the modal. Wired as the `ConfirmModal` `onClose` (covers both Cancel and the × close). The Confirm path is unaffected — it captured the `File` reference at pick time and clears the input itself after the POST round-trip. Sibling modals (Rollback) are scoped out by the title check.
  - The non-zip/oversize early returns and post-confirm clear now route through `clearFileInput` (no behavior change, one helper).
- `src/components/campaign-admin/CampaignAdmin.upload-cancel.test.jsx` (new): 6 regression tests — Cancel clears value+files and sends nothing; × close behaves identically; cancel clears a lingering error status; same-file re-pick re-opens the modal; confirm path still POSTs the chosen File; Rollback modal dismiss never touches the input/status.

**How verified:**
- **Live (Playwright, :5173, test-campaign, header + rename-lock checked):** non-zip pick → "Please select a .zip file" status + input cleared; `garbage.zip` pick → modal opens (stale status still visible mid-modal — that lingering-status nit is the separate run-O backlog item); **Cancel → `input.value === '' && input.files.length === 0` and the `.admin-status` line removed**; **re-pick of the SAME `garbage.zip` → modal opens again** (the exact silent-no-op repro from run O); × close clears the input identically; corrupt-zip **Confirm** sanity → native rollback alert + red status `Upload failed, rolled back to previous state: end of central directory record…` + input cleared after confirm, and `GET /npcs` still shows Marta Copperkettle (server safety net intact, disk-inert).
- **Tests:** `npx vitest run src/components/campaign-admin/CampaignAdmin.upload-cancel.test.jsx` → 6/6; `npx vitest run src/components/campaign-admin` → 13 files / 112 tests pass.
- **Lint:** `npm run lint` → exit 0 (zero warnings).
- **Harness note:** `setInputFiles` at the Playwright level always fires `change` regardless of input state, so the native-picker no-change behavior cannot be emulated directly; proof is the immediate post-Cancel inspection of `input.value`/`input.files` (empty → the browser has nothing left to suppress) plus the code path.
- **Cleanup:** temp zips removed; change-data + log cleared and GET-verified `{}` / `[]` from closed-tab quiet.
