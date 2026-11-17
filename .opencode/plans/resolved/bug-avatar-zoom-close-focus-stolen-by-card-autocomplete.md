# Bug: Avatar-zoom close over the GM stat modal always loses focus-restore to the card rename autocomplete

## Summary
Closing the avatar zoom (Escape, ×, or backdrop — all three lanes) opened from the
`.mc-overlay` stat-modal header disc deterministically lands focus on the Initiative
board card's `monster-autocomplete-input` instead of restoring it to the opener avatar
disc. The opener-restore law (ZK/EG) holds on board-host and visitor-host zooms, but on
the stat-modal host it never survives — the card rename autocomplete's mount-time auto
focus steals focus in the same commit, and `AvatarModal`'s `contested` stand-down guard
then correctly refuses to fight it. Confirmed live 3/3 Escape + 1/1 × + 1/1 backdrop,
run FH 2026-11-17 (HEAD 9de6379f5).

## Steps to reproduce
1. In `test-campaign` on `http://localhost:5173` (GM/localhost origin), join a Goblin
   via Encounter Builder (search `Goblin` → `input.monster-checkbox[aria-label="Select
   Goblin"]` → `Join Encounter`) so the Initiative board mounts.
2. Click the Goblin card's avatar disc (`querySelector('.creature-card.npc
   .npc-avatar')` — do NOT scope by card textContent: every card's target dropdown
   re-names every monster, so `:has-text("Goblin")` strict-violates / false-matches a
   player card) → the `.mc-overlay` stat modal opens.
3. Click the header disc (`document.querySelector('.mc-header-avatar .avatar-wrapper')`,
   role=button) → `.avatar-modal-overlay` zoom opens; verify `document.activeElement` is
   `div.avatar-modal` (focus-on-open leg PASSES).
4. Press Escape (or click `.avatar-modal-close`, or click the pure backdrop corner).
5. Read `document.activeElement` after the zoom unmounts.

Repeat step 3–5 three times: identical result every time (real, not a race artifact).

## Expected behavior
Per the opener-restore law proven on the other zoom hosts, focus should return to the
`.mc-header-avatar .avatar-wrapper` that opened the zoom (the visitor `.npc-avatar` host
restores correctly on both Escape and backdrop).

## Actual behavior
`document.activeElement` is `input.monster-autocomplete-input` with
`aria-label="Goblin name"` (the board card's GM rename autocomplete) on ALL THREE close
lanes, 3/3 Escape repeats, `mc-overlay` still alive. The stat-modal never receives focus
back and the opener disc is never re-focused.

Console: zero app errors during the ride (only this run's own route-500 inventory mock
noise from a separate lane).

## Likely location
Confident (code read, not guessing):
- `src/components/common/MonsterNameAutocomplete.jsx:62-67` — a mount effect that fires
  `inputRef.current.focus({ preventScroll: true })` whenever `initialFocus` is true, and
  `initialFocus = true` is the DEFAULT (line 33) — `CreatureCard.jsx:182` never overrides
  it, so every card remount auto-focuses the rename input.
- The steal lands because Initiative cards are keyed `${creature.name}-${runtimeStateTick}`
  (documented in the ghost-list-guard header comment, same file lines 5-17): the zoom
  close coincides with a card re-key/remount, the fresh autocomplete focuses itself, and
  `src/components/common/AvatarModal.jsx:79-85` then sees a live holder outside the panel
  (`contested`) and stands down by design. So the stand-down is honest — the DEFECT is the
  unconditional mount-time focus steal, the same remount-refocus-steal family already
  filed in the XF era for roll-result popups over the stat modal.

## Suggested fix
Start at `MonsterNameAutocomplete.jsx:65`: gate the mount focus the same way the ghost-list
guard gates the dropdown — only auto-focus when there is fresh typing/rename intent (the
`isTypingIntent()` machinery right above it already models "a rename is in flight across
remounts"), or have `CreatureCard.jsx` pass `initialFocus={false}` and arm focus
explicitly when the rename lane is entered (the card avatar/menu affordances that open it).
A passive mount (tick re-key, SSE echo, an overlay closing over the board) must never own
the caret. Verify by re-riding the 3 close lanes above and expecting
`activeElement === .mc-header-avatar .avatar-wrapper`, plus re-running the autocomplete
ghost-list and rename-lane tests that motivated `initialFocus`.

## Severity
Minor UX issue (a11y focus contract) — no data risk; mouse users unaffected. But it is a
deterministic, reproduced break of an owner-witnessed focus-restore law on the GM's
primary combat surface, so it should not be parked.

## Resolution
FIXED (run AV 2026-11-17).

### What was actually wrong (refines the "Likely location")
The symptom reproduced exactly via the steps above (3/3 Escape + × + backdrop →
`input.monster-autocomplete-input[aria-label="Goblin name"]`), but instrumentation
(`HTMLElement.prototype.focus` stack capture + node-identity probe) showed the
close-time mechanism is NOT a fresh-instance mount steal racing the unmount: the
autocomplete node is the SAME node at close (no remount rode the close commit), and the
only `focus()` call during the whole close is **AvatarModal's own unmount-cleanup
`opener.focus()`**. The mount-time auto-focus fires at a different seam: the passive
card mount (EB Join auto-navigate / any tick re-key) drops the caret into the rename
field via the `initialFocus = true` DEFAULT, and a zoom opened while that caret is parked
there captures the rename field as its focus-restore "opener" — the close then faithfully
"restores" into the card field. Lived both ways: real-mouse lanes with the caret elsewhere
restored correctly; any lane opening the zoom with the caret in the rename field (passive
steal OR a GM mid-rename) deterministically lands on the field on all three close lanes.
So the root defect is exactly the filed law — a passive mount owning the caret (the same
remount-refocus-steal family Popup's focus-retention law already traps against) —
while `contested` was honestly never engaged on this lane.

### Fix (mirrors the ghost-list intent gate in the same file)
- `src/components/common/MonsterNameAutocomplete.jsx` — `initialFocus` default flipped
  `true → false`; the mount focus effect now fires only on user intent:
  `initialFocus || isTypingIntent(value || '')`. A mid-rename echo remount (the +NPC
  rename lane) still carries the caret because the typed text survives across remounts —
  the SAME `isTypingIntent()` machinery that gates the dropdown. Header comment records
  the caret law.
- `src/components/map/Map.jsx` — the token rename popover is the one mount opened by an
  explicit user gesture (context-menu Rename), so it now passes `initialFocus`
  explicitly; its keyboard rename tier is unchanged.
- `src/components/initiative/CreatureCard.jsx` — unchanged: the card lane opts into the
  intent gate via the new default.
- `AvatarModal.jsx` — unchanged (its opener-capture + stand-down law is honest).
- Intentional behavior change: after a suggestion-pick/Enter commit + echo remount the
  caret stands down to body instead of being re-grabbed — keeping it would reopen the
  same steal window for any remount riding the next 2 s.

### Verification
- Live (`test-campaign`, :5173, dev pair): pre-fix repro re-run 3/3 Escape + × +
  backdrop landed on the input (bug confirmed). Post-fix: the literal evaluate-click
  lane no longer lands on the input (focus stays body, 2/2 repeat); the real-mouse user
  lane restores `document.activeElement === .mc-header-avatar .avatar-wrapper` on
  **Escape ×2, ×, and backdrop** (4/4, `restoredToOpener: true`, open-focus
  `.avatar-modal` PASS). Rename lane re-ran live: click-into-field focuses, mid-word
  echo remount carries the caret (typed `X` into "Goblin" survived the re-key with
  updated aria-label "GoXblin name", then restored to "Goblin"), Enter commit stands
  down. Ghost-list lanes unit-locked. Cleanup: Admin Clear Change Data + Clear Campaign
  Log — GET-verified change-data `{}` / log `[]`; campaigns/ untouched.
- Tests: NEW `MonsterNameAutocomplete.focus-intent.test.jsx` (5 tests: passive mount
  keeps the opener's focus, tick re-key remount without intent never re-grabs,
  mid-rename echo remount DOES carry, blur clears intent, explicit `initialFocus`
  arms); `MonsterNameAutocomplete.test.jsx` focus laws inverted (`typeQuery` now
  clicks-to-focus first — a passive mount never owns the caret); ghost-list file
  updated the same way + asserts the echo-remount caret carry.
  `npx vitest run src/components/common src/components/map` → 167 files / 1756 tests
  passed. `npm run lint` → zero warnings. `node .opencode/plans/no-timers-guard.mjs` → OK.
