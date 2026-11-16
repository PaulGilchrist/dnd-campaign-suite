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

## Resolution
FIXED 2026-11-16 (fix run). The black-box diagnosis was verified correct against the code, with one naming correction: the stolen `INPUT.monster-autocomplete-input` is the **initiative card's** name field (`CreatureCard.jsx` `.creature-name` edit lane), not a field inside the stat modal — the modal (`.mc-overlay` → `MonsterCardModal`) stays mounted while the card behind it re-keys. Exact mechanism confirmed: the roll commit's SSE echo bumps `runtimeStateTick` in `Initiative.jsx`, the card remounts via `key={creature.name}-${runtimeStateTick}` (`Initiative.jsx:974`), and `MonsterNameAutocomplete`'s once-per-mount `initialFocus` effect re-focuses its input — after the Popup's once-per-mount pull (`popup.jsx`, deps `[guarded]`), stranding `activeElement` outside the panel where the focus-scoped `useModalDismiss` keydown handler can't see Escape.

**Fix (shared seam, `src/components/common/popup.jsx`):** the dismissable focus-pull became a focus **retention** trap — while an unguarded Popup is open, a `document` `focusin` listener reclaims the panel whenever focus lands outside the entire `[data-testid="popup-overlay"]` layer. Safe because the fixed overlay already swallows every outside pointer interaction, so the only escape route is a programmatic steal (exactly the autocomplete remount race). Focus landing inside ANY popup overlay (stacked popup layers) is left alone — the trap never fires between two popups, so no ping-pong; re-claim uses `preventScroll`. Guarded faces (`dismissable={false}` staged damage) keep the no-focus-steal law untouched: the effect early-returns, no listener, no focus movement. The `MonsterNameAutocomplete` refocus-on-remount was NOT suppressed — it is load-bearing for the +NPC/rename lanes (survives card re-keys mid-word, per its ghost-list comment), and the popup-side trap fixes the whole steal class at the law-enforcement site rather than one stealer. No dual-ruleset sibling: `popup.jsx` is shared UI, not a rules module.

**Files changed:**
- `src/components/common/popup.jsx` — mount-pull + `focusin` retention trap (unguarded only).
- `src/components/common/popup.focus-retention.test.jsx` — NEW regression test (3 cases): post-mount steal re-claimed then Escape closes; guarded face never pulls focus back and Escape stays inert from outside; stacked popups never strand focus outside the layer.

**Verification:**
1. Live repro BEFORE fix (test-campaign, :5173): Goblin EB join → avatar → `.mc-overlay`; unarmed Scimitar chip = refusal face with `activeElement=DIV.popup-modal` + Escape closes (control PASS); armed + rolled MISS face → `activeElement=INPUT.monster-autocomplete-input`, `focusInPanel:false`, trusted Escape INERT (popup stays mounted); manual `panel.focus()`+Escape closes (wiring fine, placement fails). Bug reproduced exactly.
2. Live re-verification AFTER fix (same rig): MISS face probed 1.3 s after mount (re-key window elapsed) → `activeElement=DIV.popup-modal`, `focusInPanel:true`, trusted Escape DISMISSES with zero game-state writes (roll logs only). Adjacent faces all re-lived: refusal face Escape ✓; pure backdrop dismisses ✓; drag guard (panel-mousedown → backdrop-mouseup) holds ✓; HIT-staged face — no focus pull (active stays on the autocomplete input by design), Escape inert ✓, backdrop inert ✓, `Cancel attack` exits clean ✓; card autocomplete typing still suggests (Goblin/Goblin Boss/…) and commits ✓ (a mid-rig keystroke rename was restored byte-nominal to `Goblin`).
3. `npx vitest run src/components/common/popup.focus-retention.test.jsx` — 3/3 pass. `npx vitest run src/components/common` — 67 files / 690 tests pass (includes `popup.test.jsx` dismissal pins + `AttackResultPopup.staged-cancel.test.jsx`). `npm run lint` — clean, zero warnings.
4. Exit hygiene: browser tab closed, headless Admin clears GET-verified `change-data {}` + `log []` + overlays `[]`, cd/log disk files absent (XF-exit baseline).

