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
