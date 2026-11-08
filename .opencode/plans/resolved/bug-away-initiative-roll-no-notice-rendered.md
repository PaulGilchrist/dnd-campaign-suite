# Bug: Away initiative roll — the "not applied" notice is never rendered (popup shows a naked total)

## Summary
When a player marked `away` rolls initiative, `processInitiativeRoll` correctly refuses to stamp the tracker and logs an `initiative_while_away` audit row, and it puts an `awayNote: 'You are away from the party — this roll was not applied. Ask the GM to rejoin you.'` into the popup payload. But **no component in `src/` ever reads `awayNote`** — the d20 popup renders the roll total exactly like an applied roll, so the table sees "Initiative 7" with zero indication that the roll did nothing.

## Steps to reproduce
1. In test-campaign, Initiative view: mark any PC away (card toggle 🚶 or Split Party modal).
2. Open that PC's character sheet; click the "Initiative: +N" stat line to roll initiative.
3. Observe the d20 popup.

## Expected behavior
Per the split-party law comment in `initiativeProcessing.js` ("the roll is shown (and logged for the table)"), the popup should visibly carry the `awayNote` text (e.g. a warning line under the total) so players/GM can tell the roll was NOT applied.

## Actual behavior
- Popup content: `Initiative / 7 / d20 2 +5 / Advantage / Disadvantage / click to dismiss / Done` — no away notice anywhere.
- Store: row stays `away: true, initiative: ''` (correct); log gets "Disciplined_Monk rolled initiative (7) while marked away — not applied to the tracker; the GM must rejoin them." (correct).
- So the only channel telling anyone the truth is the campaign log; the immediate feedback lies by omission — a GM glancing at the popup may believe the away player joined the order with a 7.

## Likely location
Confident (grep): `awayNote` appears only in `src/hooks/combat/initiativeProcessing.js` (producer, line ~49) and its unit test `initiativeProcessing.away.test.js` (asserts the payload, not the render). The shared popup renderer (`src/components/common/popup.jsx` / d20 popup view) has no `awayNote` consumer — the payload key is simply dropped.

## Suggested fix
Render `popupData.awayNote` in the d20 popup view (a small warning row, e.g. `<div className="popup-away-note">` under the total, styled amber) when present. Alternatively/additionally the Initiative board card for the away creature could briefly flash the roll as unapplied. Add a render-level test asserting the note text lands in the DOM.

## Severity
Minor UX issue — no state corruption (the store/law is honest), but the feature's only user-facing honesty channel is silently dead, which can mislead live-table decisions.

## Resolution
FIXED 2026-11-08. The diagnosis was confirmed exactly: `processInitiativeRoll` threads `awayNote` on the popup payload and `AttackResultPopup`/`DiceRollPopupContent` already spread the whole payload (`{...popupHtml}`) into `DiceRollResult` — so the prop arrived at the renderer and was simply never rendered (grep-zero consumers).

**Changes:**
- `src/components/char-sheet/DiceRollResult.jsx` — new file-local `AwayNotice` child (mirrors the `HolyAuraSaveNotice`/`FloorNotices` notice-component idiom, `fa-person-walking-arrow-right` icon matching the away-toggle state icon in `CreatureCard.jsx`), rendered directly after `<RollSummary>` (under the total) whenever `props.awayNote` is present.
- `src/components/char-sheet/DiceRollResult.css` — `.dice-roll-away-note`, byte-mirroring the existing amber notice family (`.dice-roll-reliable-talent`: `#ff9800` on `rgba(255,152,0,0.15)`). No inline styles, no `!important`.
- `src/components/char-sheet/DiceRollResult.away-note.test.jsx` — NEW render-level regression test: note text lands in the DOM, sits directly under `.dice-roll-total`, and no notice row renders when `awayNote` is absent/empty (normal roll unchanged).

**Verification:**
- Repro re-run live in test-campaign BEFORE the fix: Disciplined_Monk marked away (store `away:true, initiative:''`, parked last) → sheet "Initiative: +5" roll → popup `Initiative / 24 / d20 19 +5 / …` — no notice (bug confirmed).
- AFTER the fix (same repro): popup renders "You are away from the party — this roll was not applied. Ask the GM to rejoin you." under the total, computed style amber (rgb(255,152,0)); store still `away:true, initiative:''`; log carries "Disciplined_Monk rolled initiative (17) while marked away — not applied to the tracker; the GM must rejoin them."
- Sanity face: ElderPaladin (present) initiative roll → popup unchanged, `.dice-roll-away-note` count 0, initiative stamped normally ("5").
- Tests: `npx vitest run DiceRollResult.away-note.test.jsx` 4/4; touched-area run (`char-sheet/DiceRollResult.*` + `hooks/combat/initiativeProcessing` + `components/common`) 88 files / 987 tests all green; `npm run lint` zero warnings.
- Exit ritual: tab closed, `/admin/clear-change-data` + `/admin/clear-log` POSTed, GET-verified `{}` / `[]`; dev server stopped.
