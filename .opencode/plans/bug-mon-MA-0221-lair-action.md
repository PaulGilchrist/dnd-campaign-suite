# bug-mon-MA-0221 — Ancient Gold Dragon "Unnamed lair actions 1" (nameless/raw-string lair row, inert)

## Title
MA-0221 Ancient Gold Dragon lair action 1 (advantage until initiative 20) is a raw-string row — no affordance, no producer, zero-delta on click → FAIL.

## Overview
`monsters.json` `ancient-gold-dragon.lair_actions[0]` is a **raw string** (not even a nameless dict): `"The dragon glimpses the future, so it has advantage on attack rolls, ability checks, and saving throws until initiative count 20 on the next round."` The manifest labels raw strings positionally ("Unnamed lair actions N"). Rendering gates raw strings (and nameless dicts) to static prose, and no engine consumer produces initiative-anchored advantage. Verified live in test-campaign 2026-09-15: EB-joined "Ancient Gold Dragon 1" (init 20, HP 546); clicking the lair row produced a zero log delta (2→2 entries); control Rend chip click opened the +17 attack popup and wrote a new `roll` log entry (2→3), proving the card itself is interactive.

## Expected
Per row description: "The dragon glimpses the future, so it has advantage on attack rolls, ability checks, and saving throws until initiative count 20 on the next round." Canonical Ancient Gold Dragon lair actions (SRD): the same advantage-glimpse plus the dream-plane banishment (DC 15 CHA) — in the app's model a clickable lair row should grant a structured effect (e.g. self `attackRollAdvantage`/`abilityCheckAdvantage`/`saveAdvantage` te with a rounds:2 "next initiative 20" approximation, GM-enforced cadence per MA-0024 advisory model).

## Actual
- Live DOM of the row: `<div class="mc-action"><span>The dragon glimpses the future…</span></div>` — **0 `.mc-dice-link`, 0 `[role="button"]`, no onClick, no pointer cursor** → no clickable affordance at all.
- Programmatic `.click()` on the row: log count 2 → 2, zero entries, no popup, no te, no advantage granted. Zero delta.
- Sibling `[1]` (nameless dict, MA-0222) renders `<strong>.</strong>` + prose, also 0 dice-links — corroborates the nameless-lair fingerprint.
- Control probe (MA-0220 recipe): `.mc-action strong /^Rend/i` → `.mc-dice-link` "+17" click → attack popup "Rend 2d20 … +17" appeared + new `roll` log entry. Card interactive; lair row inert.

## Steps to Reproduce
1. test-campaign (localhost), Encounter Builder.
2. Search exact "Ancient Gold Dragon" → tick checkbox → Join Encounter (EB re-join required — dragon was Admin-cleared).
3. Open the dragon card on the initiative tracker → scroll to "Lair Actions".
4. Observe row 1 renders as plain static text with no dice-link/chip affordance.
5. Click the row text → nothing happens: no roll prompt, no popup, no log entry, no targetEffect, no advantage.
6. Control: click the "+17" chip inside the "Rend." row → attack roll popup + log roll entry.

## Likely Location
- `public/data/monsters.json` → `ancient-gold-dragon.lair_actions[0]` — raw string, no `name`/effect fields (root cause = DATA authoring).
- `src/services/encounters/monsterLairActions.js:25` `isLairRowClickable` — gates on `!row.name` (raw strings and nameless dicts return false by design, ~600-monster regression protection).
- `src/components/encounter/MonsterCardBody.jsx:340` `MonsterLairAction` — non-clickable branch renders static `.mc-action` span.
- No te producer exists for "advantage until initiative count 20" on a lair trigger: grep of `src/services/` shows zero initiative-anchored advantage producers; `targetEffectDefinitions.js` lair entries (:817/:853/:871/:880) all state "no initiative-20 lair seam — GM-enforced".

## Notes
- Nameless/raw-string lair inert family: **MA-0118 / MA-0165 / MA-0166 / MA-0176**; same-monster siblings MA-0210 (raw-string spike_growth) / MA-0211 (nameless mud dict) both FAIL. Registry note for this monster already flags legendary/lair inert family (MA-0217/0218/0219/0220).
- Even if clickable, the described effect has **no initiative-anchored advantage te producer** for lair triggers anywhere in the engine (MA-0024 design comment: "NOT an initiative-20 automation subsystem").
- **Fix shape:** author a named structured lair dict, e.g. `{ "name": "Future Sight", "description": "…", "advisory": true }` (CLA-325 advisory record) or with explicit effect fields (self advantage te, rounds:2 approximation of "until initiative 20 next round") so `isLairRowClickable` passes and a consumer grants the advantage. Sibling row [1] also needs `name` (MA-0222).
- Anchor any monsters.json edit with monster-unique neighbor content (MA-0209 pitfall); JSON.parse + full `git diff` review after edit.

## Verdict
FAIL (nameless/raw-string inert, no affordance, zero-delta confirmed by grep + live probe).
