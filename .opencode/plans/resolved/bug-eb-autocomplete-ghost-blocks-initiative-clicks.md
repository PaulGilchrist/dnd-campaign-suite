# Encounter Builder monster-autocomplete list survives view navigation and can intercept clicks on Initiative cards

## Summary
The monster autocomplete dropdown opened by the Encounters-page search box is not unmounted when navigating to another view (e.g. Initiative via the sidebar or Join Encounter auto-navigation). The stale `.monster-autocomplete-list` (4 items) stays mounted — sometimes overlapping live card controls — and silently absorbs the GM's next clicks there.

## Steps to reproduce
1. In `test-campaign` (GM, localhost): Encounters → type "Ban"/"Bandit" in "Search monsters" so the autocomplete dropdown appears.
2. Click **Initiative** in the sidebar (no click inside the dropdown).
3. Evaluate `document.querySelector('.monster-autocomplete-list')` → still mounted, e.g. rect `x:-66 y:458 w:223 h:100`, `items:4` (verified live 2026-10-24).
4. Earlier in the same session the ghost was positioned over the Bandit initiative row: clicking `input[aria-label="Bandit max HP"]` (rect x≈317–361, y≈472–491) was intercepted twice — Playwright actionability log: *"`<li class="monster-autocomplete-item">Bandit</li> … intercepts pointer events`"* — until an outside click finally dismissed the list.

## Expected behavior
The autocomplete unmounts (or closes) on view change / blur, like normal combobox behavior — no invisible list should intercept clicks in another view.

## Actual behavior
The dropdown persists across the route switch, invisible or ghost-rendered, and its `<li>` items receive pointer events meant for Initiative card inputs (max-HP, etc.), producing dead first-clicks (and, worse, accidental autocomplete selection).

## Likely location
Guessing, based on DOM: the autocomplete lives in the monster search input component (likely `src/components/encounter/` — search for `monster-autocomplete-list`) and its open-state is local `useState` that is never cleared by the view switch because the Encounters content is not unmounted when another view is rendered (or the list renders into a shared portal). The join-encounter flow auto-navigates to Initiative without a blur/click-outside, so the close-on-outside-click listener never fires.

## Suggested fix
On view change (or on blur without selection), set the autocomplete open state to false / unmount the list; if it renders via portal, ensure the portal target unmounts with the Encounters view. Alternatively attach the component's open state to `document.activeElement` checks.

## Severity
Minor UX issue — first-clicks vanish and an accidental row-select could change which stat block/card the GM is looking at; no data loss, but it reliably breaks muscle-memory flows (and cost this run ~20s of blocked Playwright actions).

## Resolution
**FIXED 2026-10-24.**

### What was actually wrong (diagnosis differed from the guess)
- The Encounters-page "Search monsters" box is a **plain filter input** (`EncounterMonsterTable.jsx:170`) — it has no autocomplete dropdown at all. Live probe confirmed: typing "Bandit" there opens **zero** `.monster-autocomplete-list` mounts. So nothing "survived" the navigation.
- The ghost is **birthed on the Initiative page itself**: the only producers of `.monster-autocomplete-list` are `MonsterNameAutocomplete.jsx` instances (Initiative card renames via `CardName`, +NPC flow, Map rename popover). App views DO unmount on switch (`App.jsx:248` `views[activeView]`).
- Root cause: the component's debounced open-effect fired on *any* `query` presence, and `query` seeds from the `value` prop at mount. Join Encounter auto-navigates to Initiative → each new NPC card autofocuses its rename input pre-filled with the creature's name → 150ms later the dropdown auto-opened with no user intent. `elementFromPoint` at the "Bandit max HP" input center returned `LI.monster-autocomplete-item` ("Bandit"); `page.click` on it was actionability-blocked twice, exactly as the original Playwright log recorded. Rect x:-66 variants = offscreen cards' auto-opened lists draped into view.
- Complication found during verification: Initiative cards are keyed `${creature.name}-${runtimeStateTick}` (`Initiative.jsx:686`) and the rename lane POSTs every keystroke, so the component **remounts on every character typed**. An instance-local "user is typing" ref therefore killed the documented +NPC rename flow ("rename it to a monster name…" — the dropdown vanished mid-word, live-detached-input probe).

### Fix (component-local UI state only — nothing in the runtime store)
`src/components/common/MonsterNameAutocomplete.jsx`:
- Module-scope **typing-intent stamp** (`lastTypedQuery`/`lastTypedAt`, 2s window): only `handleInputChange` (real keystrokes) marks intent; the debounced auto-open now requires `isTypingIntent(query)` AND the input still focused (`document.activeElement === inputRef.current`). Passive mounts (join auto-nav, SSE re-keys, turn ticks) never match → no ghost can ever open.
- Intent is cleared on every dismiss channel — blur, outside mousedown, li-pick, Enter-commit — so post-rename value echoes can never re-open the list (this also kills the sibling §312 pitfall "dropdown STAYS OPEN after li click").
- Pattern mirrors the working sibling `EquipmentNameInput` in `PartyInventory.jsx` (focus/typing-gated suggestions, mousedown pick, blur close), adapted to survive the re-key remount of the Initiative lane.

### Files
- `src/components/common/MonsterNameAutocomplete.jsx` — fix
- `src/components/common/MonsterNameAutocomplete.test.jsx` — one stale assertion inverted: external value echo must NOT re-open (it pinned the buggy behavior)
- `src/components/common/MonsterNameAutocomplete.no-ghost-list.test.jsx` — NEW regression lock (6 tests: passive-mount no-open, echo no-reopen, blur-outside-pick stay-closed, mid-remount rename lane preserved)

### Verification
- **Live re-repro (Playwright, test-campaign)**: EB search "Bandit" → check → Join Encounter → auto-nav Initiative → after past-debounce `document.querySelector('.monster-autocomplete-list')` → **null** (was items:4 draped at y≈470); `page.click('input[aria-label="Bandit max HP"]')` → **landed first attempt ×3**; sidebar Encounters↔Initiative round-trip → null; `elementFromPoint` at HP center → the HP input itself.
- **Adjacent sanity (live)**: EB search filter narrows table to the 4 Bandit rows; autocomplete on Initiative cards still works — typed "bandit" → dropdown opened (surviving the per-keystroke re-key remounts), real-pointer click on "Bandit" li committed, closed and stayed closed after the value echo.
- **Tests**: new test file + full `src/components/common/` (44 files/513 tests), `initiative/`+`encounter/`+`party-inventory/` (439 files/2326 tests), `map/` (51/545) — all pass. `npm run lint` zero warnings; `no-timers-guard` OK (no new timer categories).
- **Cleanup**: 3 test-joined NPC cards removed (board back to the original 12 players), Admin Clear Change Data + Clear Campaign Log fired (`change-data` = 0 keys, log = 0 entries).
- Pre-existing quirk observed, untouched (test-triggered): renaming two combatants toward the same name mid-typing emits React duplicate-key console errors (`${name}-${tick}` collision) — separate concern, not this bug.
