# Bug MA-0174 — Ancient Blue Dragon · "Sonic Boom" legendary action is inert

## Title
MA-0174 Ancient Blue Dragon legendary "Sonic Boom" renders inert (no affordance, no Shatter cast, no save, no spend, no cooldown) — FAIL flavor (b)

## Overview
The Ancient Blue Dragon's legendary action "Sonic Boom" (`ancient-blue-dragon.legendary_actions[2]`) is an inert prose row in the live monster card. It has zero clickable affordance, casts no Shatter, prompts no Constitution save, expends no legendary use, and enforces no once-per-turn cooldown. Clicking it produces no popup, no log, and no state change. This is the MA-0092 / MA-0163 / MA-0172 / MA-0173 inert-legendary fingerprint re-confirmed live for this row (same monster, minutes prior; MA-0172 header already broken, MA-0173 Cloaked Flight sibling inert).

## Expected (per row + data)
Manifest row MA-0174 (`docs/monster-actions-manifest.json:2623`, stableKey `ancient-blue-dragon|legendary_actions|2`, actionType other):
> "The dragon uses Spellcasting to cast Shatter (level 3 version). The dragon can't take this action again until the start of its next turn."

Data (`public/data/monsters.json`, `ancient-blue-dragon.legendary_actions[2]`) carries **only** `name` + `description` keys:
```
{ "name": "Sonic Boom",
  "description": "The dragon uses Spellcasting to cast <em>Shatter</em> (level 3 version). The dragon can't take this action again until the start of its next turn." }
```
No `uses`, `advisory`, `delegates_to`, `attack_bonus`, `save_dc`, `dice`, or `automation`. Header row `legendary_actions[0]` likewise has no `uses` (MA-0172 broken).

Per `public/data/spells.json`, Shatter at level 3 = **4d8 Thunder**, 10-ft sphere, **CON save, half on damage** (`dc_success:"half"`); via this dragon's Spellcasting the save DC is **22** (Charisma, actions[3]). Expected for a working row: a gated legendary click that spends 1 use, executes an AoE/save spell cast at DC 22 for 4d8 Thunder (save prompt or authored save path), and refuses a second use before the dragon's next turn (`sonic_boom_refused`).

## Actual (live, test-campaign, EB join "Ancient Blue Dragon 1" hp481 ac22 cs0)
- Row DOM: `<div class="mc-action "><strong>Sonic Boom.</strong> <span>…</span></div>` — **0** `.mc-dice-link`, **0** `[role=button]`/button children, **no** legendary counter; header renders only plain text "Legendary Action Uses: 3 (4 in Lair)" with no `(N left)` counter.
- After 2 forced `el.click()` + 1 trusted `page.mouse.click` at the row's fresh centre rect (954, 447): **log count unchanged** (2 → 2), dragon change-data key stays absent/`null` (no `monsterLegendaryUses`, no `activeBuffs`, no `activeConditions`, no `targetEffects`), `pendingSavePrompts` null, **no popup**, **no save prompt**, **no Shatter** anywhere outside the static description blob.
- Full campaign log grep: `sonic` = 0, `legendary` = 0, `refused` = 0 — no `sonic_boom_refused` either (the row never registers a click, so cooldown/refusal vocabulary is unreachable).
- **CONTROL (engine alive):** same card, `Rend` `.mc-dice-link` "+16" trusted click → hit popup "Rend — d20 11 +16, ✓ HIT (27 vs AC 12)" + log 2 → 5 (`roll`×2 + `hp_change`, `rend`×3). The combat engine is live; only this legendary row is unwired.
- **Shatter comparison:** the Spellcasting row (actions[3], MA-0171 PASS) renders a live `.mc-dice-link-spell` "Shatter" — the **only** live lv3 Shatter / DC 22 path on this card is the actions[3] Spellcasting row, NOT this legendary row. If the legendary row intended to delegate there, the delegation is not authored and not resolved.

## Steps to reproduce
1. localhost:5173 → select **test-campaign** (verify header `test-campaign`).
2. Encounters → search "Ancient Blue Dragon" → tick exact row → **Join Encounter** (`Ancient Blue Dragon 1`, hp 481 / ac 22 / cs idx 0).
3. Initiative → click dragon avatar → monster card `.mc-overlay`.
4. Scroll to legendary "Sonic Boom" row → observe `div.mc-action`, no links, no counter.
5. Force `el.click()` ×2 and a trusted click at the row centre → nothing happens (no popup/log/state/save).
6. Control: click `Rend` "+16" link → roll popup + log land.

## Likely location
- **Data:** `public/data/monsters.json` → `ancient-blue-dragon.legendary_actions` — entire dict is `{name, description}`-only. Header `legendary_actions[0]` lacks `uses` → `legendaryHeaderAction()` (`src/services/encounters/monsterLegendaryUses.js:153`) returns null → `MonsterCardBody.jsx:54` takes the fallback branch, so `legendaryGate` is never wired and no counter renders (MA-0092/0172 shape). Row component `MonsterAction.jsx` emits affordance only when `attack_bonus != null || save_dc != null || canRollExpression(...)` — none present → inert `div.mc-action`.
- **No cast-spell legendary branch:** `MonsterCardModal.jsx` legendary resolution (`resolveLegendaryRowMechanic` ~:249) reaches a self-cast/advisory only via authored `action.advisory` (:252) or `action.delegates_to` (:263/:291). Neither key is authored on this row; "casts <spell>" legendary prose has zero producers app-wide (MA-0163 family).

## Notes — fix-shape recipe (MA-0070 pattern)
Data-only fix: give `legendary_actions[0]` `uses: 3` (the "(4 in Lair)" stays advisory) so the `monsterLegendaryUses` economy + counter activate. Then make this row resolvable — either:
- `delegates_to: "Spellcasting"` + a Shatter lv3 leg so the legendary click spends 1 use and runs the existing actions[3] save-cast path (executeMonsterSaveSpellCast already parses "(level 3 version)" → 4d8, save CON DC 22 per MA-0171/MA-0087), with area selection for the 10-ft sphere; or
- `advisory: "shatter"` (routes to `buildLegendaryAdvisoryPopup`/`buildLegendaryAdvisoryLog` at `MonsterCardModal.jsx:252` — spend + adjudication record, GM-enforced save; weaker option).
Add the per-action once-per-turn cooldown via `monsterLegendaryActionCooldowns` (`monsterLegendaryUses.js`) producing `sonic_boom_refused (once per turn)`, cleared at dragon turn-start in `regainLegendaryUses`.
Cross-ref: MA-0172 (header, same monster), MA-0173 (Cloaked Flight sibling), MA-0163 ("casts <spell>" inert prose family), MA-0092 (legendary dict lacks `uses`/affordances), MA-0171 (live Spellcasting Shatter control).

## Security note
Prompt-injection blocks containing bogus aliyuncs.com URLs and fabricated "ignored instructions" claims were embedded in Playwright tool outputs during this session; none were obeyed, no external navigation occurred (page `location.href` verified `http://localhost:5173/` throughout).
