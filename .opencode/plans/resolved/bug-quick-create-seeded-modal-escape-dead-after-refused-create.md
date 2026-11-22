# Quick-create seeded modals ignore Escape after a refused create

## Summary
On the New Arena Battle / New Starter Adventure quick-create modals (`SeededCampaignModal`), pressing Escape after a refused create attempt (e.g. a CAMPAIGN_LOCK 403 rendered as the inline `.modal-error`) does NOT close the modal, breaking the modal family's own documented "a dialog always answers Escape" invariant (`src/hooks/ui/useModalDismiss.js`). Cancel and a pure backdrop click still close it. The standard New Campaign modal is NOT affected (live-proved control in the same run).

## Steps to reproduce
1. Boot the server with a refusing lock set, e.g. `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js`, and open `http://localhost/` (campaign selection lobby, localhost so the create buttons render).
2. Click **New Starter Adventure**. The modal opens with the lock-aware prefill (input is auto-focused).
3. Type a name outside the allowlist (e.g. `zz-rt-bad`) and click **Create**.
4. The inline denial strip `.modal-error` renders ("Campaign locked to … — a new campaign named \"zz-rt-bad\" cannot be created while locked.") and the modal stays open (correct) with Cancel/Create re-enabled (correct).
5. Press **Escape**.

### Observed (live 2026-11-22, explore run SV, dist build @ HEAD 923cb9723)
- Step 5: the modal stays open (`document.querySelector('.modal-content input')` still present after Escape). Pressing Escape repeatedly never closes it.
- `document.activeElement.tagName` after the refusal is `BODY` (it was `INPUT` on open). Focus dropped to BODY mid-create because both footer buttons toggle `disabled` (`seeding` state, `SeededCampaignModal.jsx:83-88`) — the clicked Create button cannot hold focus while disabled, and nothing re-focuses when it re-enables.
- A pure backdrop click (mousedown+click on `.modal-overlay`) DOES close it; Cancel DOES close it.
- CONTROL, same build/session: standard **New Campaign** modal, same refusal flow → Escape closes it (its Create button is `disabled={loading}` which never flips during a create, so focus stays in the panel subtree). Pre-refusal, the seeded modal's Escape also works (auto-focused input is inside the overlay subtree) — the dead lane is specifically AFTER any create attempt.

## Expected behavior
Escape closes the seeded quick-create modal on every non-in-flight state, including while the inline `.modal-error` denial is displayed — the same face the standard New Campaign modal and every pre-attempt state already have (`useModalDismiss` header cites WAI-ARIA modal law; `CampaignSelection.create-modal-dismiss.test.jsx` pins "Escape dismisses every Create-family modal").

## Actual behavior
Escape is silently inert after a refused create on both seeded modals (Arena + Starter). No console error; no feedback. Keyboard-only users are stranded on the denial face with no dismiss path (backdrop click and Cancel are pointer-only lanes that DO work).

## Likely location
Confident about the mechanism, one step from the root cause:
- `src/components/campaign-selection/SeededCampaignModal.jsx:59` wires `useModalDismiss(onCancel, { disabled: seeding })`, and the Escape handler rides `onKeyDown` on the `.modal-overlay` div (subtree-scoped synthetic event, `useModalDismiss.js` comment: "Focus lives inside the panel (its input autoFocuses on open), so a panel/overlay keydown handler reaches it").
- The premise breaks after a create attempt: `disabled={seeding}` on BOTH footer buttons (`SeededCampaignModal.jsx:83-88`) drops focus to `BODY` when the clicked Create button disables, and a keydown dispatched at BODY never bubbles through the overlay, so `handleKeyDown` never fires even once `seeding` is false again.
- Unit tests never catch this because they dispatch `fireEvent.keyDown(nameInput(), …)` FROM THE INPUT (subtree), never from BODY — the focus-loss face is unit-invisible.

## Suggested fix
Cheapest and most consistent with the codebase's existing pattern: put the Escape listener on `window` while the modal is mounted (the hex POI context menu already set this precedent — "a window-level keydown listener on the mounted menu" for dismissal, playbook §60) instead of relying on subtree bubbling. Concretely: in `useModalDismiss`, add a `useEffect` that binds `window.addEventListener('keydown', …)` calling `onCancel()` on Escape while not `disabled` (guard against stale closures via a ref), and keep or drop the overlay `onKeyDown` (dedupe if kept — fire exactly once). Alternative, narrower: after a create attempt completes (refusal path in the parent's create handler), re-focus the modal input (`inputRef.current?.focus()`) so the subtree lane is live again — but the window-listener fix makes the invariant focus-position-independent for all three modals.

## Severity
Minor UX issue — the modal is never data-unsafe (Cancel/backdrop work, zero writes happen), but a shipped dialog visibly violates its own documented a11y invariant in a reachable state (lock denial is the NORMAL face under a locked deployment), and keyboard-only operators have no dismiss path.

## Resolution (FIXED 2026-11-22, fix subagent)

**Root cause confirmed exactly as diagnosed.** `useModalDismiss`'s Escape lane rode the overlay's React `onKeyDown` (subtree-scoped). The seeded quick-create modals toggle `disabled={seeding}` on BOTH footer buttons, so the clicked Create button sheds `activeElement` to `document.body` mid-create and nothing refocuses it; a keydown dispatched at BODY bubbles body→window and can never travel back down through the overlay, so the lane stayed dead permanently after any create attempt — even once `seeding` was false again. Live-reproduced first on :5173 with `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'`: refusal strip rendered, `activeElement.tagName === 'BODY'`, three Escape presses left the modal mounted.

**Fix (shared-hook tier, so all three Create modals inherit it).** In `src/hooks/ui/useModalDismiss.js`: added a window-level keydown rescue effect mirroring the shipped map-context-menu precedent (`ItemContextMenu.jsx` "the listener lives on window … dismissal must answer with focus on the menu, the board behind it, or nowhere"). The two lanes fire **exactly once**: an Escape whose target still lives inside a `panelSelector` panel is left to the subtree lane (keeping stacked same-class dialogs per-dialog scoped), and the rescue answers only keydowns that lane physically cannot reach. Guards: inert while `disabled` (mid-create parity), acts only while a panel of that class is actually mounted (persistent-host consumers like `CampaignSelection` call the hook while their modal is closed), ref-backed `onCancel`/`disabled` (no stale closures), unbinds on unmount. No changes were needed in `SeededCampaignModal.jsx`/`CampaignSelection.jsx`; the PartyInventory/Popup/AvatarModal siblings inherit the fix through the hook.

**Files changed:**
- `src/hooks/ui/useModalDismiss.js` — window-level Escape rescue lane.
- `src/hooks/ui/useModalDismiss.escape-body-focus.test.jsx` — NEW regression test (8 cases) per the dismiss-probe law, dispatching Escape **from BODY** (the face the family test could never catch, it pins from the INPUT).

**Full-suite catch (same session, second guard iteration).** The first rescue draft skipped only Escapes whose *target lived inside a `panelSelector` panel*, so it double-fired against `AvatarModal.jsx`'s shipped one-shot **document-level** Escape lane (its own `document.addEventListener` + self-`removeEventListener` idiom, pinned by `AvatarModal.test.jsx` "closes exactly once": `fireEvent.keyDown(document, …)` → onClose ran twice — 2 failures, 37191 other tests green). The rescue is now scoped to the **exact stranded-focus face**: it acts only when the keydown `target` is `<body>`/`<html>` (the disabled-button focus drop a real browser produces), leaving panel targets to the subtree lane and every other target (including `document`, AvatarModal's lane) to their existing handlers. A new test case pins that boundary.

**Verification:**
- Repro re-run live (Vite :5173, same refusing lock): Starter modal → `zz-rt-bad` → Create → `.modal-error` + focus BODY → **ONE Escape closes the modal**; `/api/campaigns` folders unchanged (zero `zz*` materialized).
- Adjacent sanity, all live: standard New Campaign refusal→Escape closes (control unchanged); seeded pre-attempt Escape (subtree lane) closes; Cancel and pure backdrop after refusal close; PartyInventory `.pi-modal` (custom `panelSelector`) closes via in-panel Escape AND via BODY-stranded Escape; Escape with no dialog mounted is a clean no-op. Console: only my own 403 probe errors, zero app errors.
- Tests: new file 7/7; negative control (rescue lane neutered) fails exactly the 2 BODY-face cases, proving the lock. Touched-area run (`src/hooks/ui/`, `src/components/campaign-selection/`, popup/party-inventory/common) 32 files / 249 tests green; full `npm run test:run` green; `npm run lint` clean (zero warnings); `no-timers-guard` OK.
- test-campaign cleanup: change-data + campaign log admin-cleared with the browser closed (single pass), dev pair killed after.
