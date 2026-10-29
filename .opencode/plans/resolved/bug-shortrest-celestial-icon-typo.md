# ShortRestModal Celestial Resilience picker uses misspelled `fa-shield-hart` — icon renders as nothing

## Summary
The Celestial Resilience ally picker is wired with `icon="fa-shield-hart"` / `confirmIcon="fa-shield-hart"` (typo of `fa-shield-heart`) in BOTH call-sites that open it, so the header icon and the confirm-button glyph render as nothing. The identical picker call in `LongRestButton.jsx:65/71` uses the correct `fa-shield-heart`.

## Steps to reproduce
1. Static: `grep -rn "fa-shield-hart" src --include=*.jsx` → `CharSpecialActionsModals.jsx:382/388` AND `ShortRestModal.jsx:919/925` (all four sites).
2. Live glyph proof (any localhost page of the app, console-eval): create `<i class="fa-solid fa-shield-heart">` and `<i class="fa-solid fa-shield-hart">`, read `getComputedStyle(el,'::before').content` — heart returns the glyph string (`"" / ""`), hart returns **`none`** (no glyph mapped; Font Awesome 6 name is `fa-shield-heart`).
3. Full surface: a Celestial Patron character (none in the test-campaign roster) taking a Short Rest with Celestial Resilience pending would open the picker with a blank icon beside the title and a blank glyph on the "Grant Resilience" button.

## Expected behavior
Shield icon renders beside the "Celestial Resilience" title and inside the Grant Resilience confirm button (as it does on the long-rest lane).

## Actual behavior
`content: none` — zero glyph, zero console noise; the button just shows the text with a leading empty inline element.

## Likely location
Certain: `src/components/char-sheet/ShortRestModal.jsx:919/:925` and `src/components/char-sheet/CharSpecialActionsModals.jsx:382/:388` (both Celestial Resilience picker mounts). Long-rest sibling `src/components/char-sheet/LongRestButton.jsx:65/71` proves the intended class.

## Suggested fix
Replace all four occurrences with `fa-shield-heart`.

## Severity
Minor UX issue — cosmetic dead glyph on one modal; but it is a silent typo class worth a grep pass (`fa-shield-hart` may exist elsewhere).

## Resolution
Fixed 2026-10-29 (bug-fix subagent run).

**What was wrong:** Both inline Celestial Resilience picker mounts passed the misspelled
Font Awesome class `fa-shield-hart` (FA has only `fa-shield-heart`) as `icon` + `confirmIcon`,
so the picker header glyph and the "Grant Resilience" confirm-button glyph rendered nothing
(`content: none`). The shared wrapper `modals/CelestialResilienceModal.jsx` and the long-rest
lane `LongRestButton.jsx` already used the correct class — only the two inline lanes lagged.

**Files changed:**
- `src/components/char-sheet/ShortRestModal.jsx` — L919/L925: `fa-shield-hart` → `fa-shield-heart`.
- `src/components/char-sheet/CharSpecialActionsModals.jsx` — L382/L388: same fix.
- `src/components/char-sheet/ShortRestModal.celestialResilience.test.jsx` — picker stub now
  surfaces `icon`/`confirmIcon` as `modal-icon`/`confirm-icon` testids; new pin test
  "uses fa-shield-heart in header and confirm button (typo regression pin)".
- `src/components/char-sheet/CharSpecialActions.modalsInline.test.jsx` — Celestial case carries
  `icon: 'fa-shield-heart'`; the open-case runner pins header + confirm classes and asserts no
  `.fa-shield-hart` node mounts.
- `src/components/char-sheet/CharSpecialActions.modalMocks.jsx` — shared CreatureSelectionModal
  mock renders `icon`/`confirmIcon` (`cs-header-icon`/`cs-confirm-icon`) so host props are assertable.
- `src/components/char-sheet/modals/CelestialResilienceModal.test.jsx` — header comment updated
  (its "Remaining typo sites NOT fixed here" note was stale after this fix).

**Verification evidence:**
- Repro (static): `grep -rn "fa-shield-hart" src` → exactly 4 source hits at the lines above
  (plus 2 deliberate absence-assertions in the wrapper test).
- Repro (live glyph): browser-eval on the running app created `<i class="fa-solid fa-shield-heart">`
  vs `fa-shield-hart` and read `getComputedStyle(el,'::before').content` — heart → `"" / ""`
  (glyph mapped, "Font Awesome 7 Free"), hart → **`none`** (dead glyph). Typo class confirmed.
- Full surface not walked: disk sweep of all 12 roster character JSONs found zero Celestial
  Patron characters (HexWarlock's registry `subclass` field was stale — on-disk truth is
  Archfey Patron), so forcing the picker live would have required an invasive subclass swap;
  per the run's scope rules the two-part proof + component-level pins were used instead.
- Post-fix: `grep -rn "fa-shield-hart" src | grep -v "\.test\.jsx"` → zero hits; Vite dev
  server transform of both modules serves 2× `fa-shield-heart`, 0 typos per file (live fetch).
- Tests: `npx vitest run` on the 3 touched test files → 46/46 pass; full
  `src/components/char-sheet` folder → 536 files / 5249 tests pass.
- `npm run lint` → clean (zero warnings).
- test-campaign untouched: change-data GET `{}`, log GET `[]` after run (no writes were made).
- Long-rest lane sanity: `LongRestButton.jsx:65/71` and `modals/CelestialResilienceModal.jsx`
  unchanged, still `fa-shield-heart`.
