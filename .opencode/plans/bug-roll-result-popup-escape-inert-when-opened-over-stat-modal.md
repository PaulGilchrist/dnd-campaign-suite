# Roll-result popups opened over a monster stat modal ignore Escape (focus stolen by the name input)

## Summary
`28e103710` (improve popup-dismiss-safe-faces) made every non-staged shared-Popup face answer Escape + pure backdrop, and added an on-open focus pull into `.popup-modal`. The focus pull works for zero-write faces (the `.mc-no-target-refusal` refusal), but on roll-RESULT faces opened while a monster stat modal (`.mc-overlay`) is open, the modal's `MonsterNameAutocomplete` input re-focuses itself when the card re-keys after the roll commit — AFTER the Popup's once-per-mount focus effect ran. Focus ends up outside the panel, and the shipped Escape dismissal is silently inert on that face.

## Steps to reproduce
Starting state: `test-campaign`, change-data has a board with a monster (any bestiary join works — Encounters → Search `Goblin` → tick `Select Goblin` → Join Encounter).

1. Click the Goblin avatar → the `.mc-overlay` stat modal opens.
2. Press the Scimitar chip (`.mc-dice-link` in the `Scimitar` `.mc-action` row) UNARMED. The `.mc-no-target-refusal` popup mounts. Probe `document.activeElement` → it is `DIV.popup-modal` (focus pull works). Press Escape → popup dismisses. (This leg PASSES.)
3. Arm a target via the modal header select (`.mc-header-arm select` → any PC).
4. Press the Scimitar chip again to roll. When the roll-result popup mounts (MISS face with the "click to dismiss" hint + `Done`), probe `document.activeElement` → it is `INPUT.monster-autocomplete-input` (the stat modal's name field), `focusInPanel:false`.
5. Press Escape (trusted key).
   - EXPECTED: popup dismisses (zero-stakes face per `28e103710`).
   - ACTUAL: popup stays mounted. Re-probe after pressing Escape: `[data-testid=popup-overlay]` still present.
6. Control: run `document.querySelector('[data-testid=popup-overlay] .popup-modal').focus()` then press Escape again → the popup DOES dismiss. (The Escape wiring is fine; only the focus placement fails.)

Notes: a pure backdrop click (mousedown+click on `.popup-overlay`) dismisses regardless of focus, and the drag guard (modal mousedown → backdrop click = stays open) holds; the HIT-staged-damage face is correctly `dismissable={false}` (Escape + backdrop both inert, only `Done`/`Cancel attack` exit). So the failure is exactly: Escape inert on non-staged roll-result faces opened over the stat modal.

## Expected behavior
Per `28e103710`'s law, any non-guarded Popup face answers Escape from the moment it opens — the focus pull must survive the opening interaction, including rolls launched from the monster stat modal (the single most common lane XE verified).

## Actual behavior
On roll-result faces the roll commit writes change-data → the card re-keys on the runtime-state tick → `MonsterNameAutocomplete` remounts and re-focuses itself (`initialFocus`, `src/components/common/MonsterNameAutocomplete.jsx:63-65` "preventScroll: refocusing on remount (cards re-key on runtimeStateTick each …)"), stealing focus back out of `.popup-modal`. Escape then lands on the name input and does nothing. No console errors, no failed requests — purely a silent affordance loss; users must use Done or a backdrop click.

## Likely location
Confident on the interaction; the loser side is `src/components/common/popup.jsx` — the focus effect runs once (`}, [guarded]);`) with nothing re-asserting focus when the panel's children settle (the reroll-chip lane renders async after the combat-context fetch). The stealer is `src/components/common/MonsterNameAutocomplete.jsx` (self-focus-on-remount). The refusal face proves the Popup law itself is correct — it never races a re-key because refusals write zero state.

## Suggested fix
Start in `popup.jsx`: after mount, keep the panel's focus while the dismissable popup is open — e.g. re-run the pull when `popupHtml`/children change (add a content dep), or add a small `focusout`/`animationFrame`-free guard: if the popup is mounted, dismissable, and `document.activeElement` falls outside the panel AND was not placed in a focused input the user is typing into, pull focus back once. Alternative at the root: suppress `MonsterNameAutocomplete`'s `initialFocus` refocus while a `[data-testid=popup-overlay]` is mounted. Do NOT move focus on `guarded` faces — the no-focus-steal law on the staged-damage face is deliberate and must keep (pinned by `popup.test.jsx` / `AttackResultPopup.staged-cancel.test.jsx`).

## Severity
Minor UX issue — the primary click-to-dismiss/Done/backdrop exits all work; only the newly-shipped Escape law is silently inert on one common lane. Confirmed live (run XF 2026-11-16) with a deterministic control (manual focus + Escape closes).
