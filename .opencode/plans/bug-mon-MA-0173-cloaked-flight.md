# Bug MA-0173 — Ancient Blue Dragon · "Cloaked Flight" legendary action is inert

## Title
MA-0173 Ancient Blue Dragon legendary "Cloaked Flight" renders inert (no affordance, no invisibility, no fly, no spend, no cooldown) — FAIL flavor (b)

## Overview
The Ancient Blue Dragon's legendary action "Cloaked Flight" (`ancient-blue-dragon.legendary_actions[1]`) is an inert prose row in the live monster card. It has zero clickable affordance, grants no `Invisibility`, applies no movement, expends no legendary use, and enforces no once-per-turn cooldown. Clicking it produces no popup, no log, and no state change. This is the MA-0092 / MA-0163 inert-legendary fingerprint re-confirmed live for this row (sibling of the already-broken MA-0172 header, same monster, minutes prior).

## Expected (per row + data)
Manifest row MA-0173 (`docs/monster-actions-manifest.json:2611`, stableKey `ancient-blue-dragon|legendary_actions|1`, actionType other):
> "The dragon uses Spellcasting to cast Invisibility on itself, and it can fly up to half its Fly Speed. The dragon can't take this action again until the start of its next turn."

Data (`public/data/monsters.json`, `ancient-blue-dragon.legendary_actions[1]`) carries **only** `name` + `description` keys:
```
{ "name": "Cloaked Flight",
  "description": "The dragon uses Spellcasting to cast <em>Invisibility</em> on itself, and it can fly up to half its Fly Speed. The dragon can't take this action again until the start of its next turn." }
```
No `uses`, `advisory`, `delegates_to`, `attack_bonus`, `save_dc`, `dice`, or `automation`. Header row `legendary_actions[0]` likewise has no `uses` (MA-0172 broken). Expected for a working row: a gated legendary click that spends 1 use, self-casts Invisibility (writes an invisibility buff/condition + a fly/half-fly movement leg), and refuses a second use before the dragon's next turn (`cloaked_flight_refused`).

## Actual (live, test-campaign, EB join "Ancient Blue Dragon 1" hp481 ac22 cs0)
- Row DOM: `<div class="mc-action ">` — **0** `.mc-dice-link`, **0** `[role=button]`/legendary/button children, **no** legendary counter. Header renders only as plain text "Legendary Action Uses: 3 (4 in Lair)." with no `(N left)` counter.
- After 2 forced `el.click()` + 1 trusted `page.mouse.click` at the row's fresh center rect (954, 447): **log count unchanged** (2 → 2), dragon change-data key `Ancient Blue Dragon 1` stays `{}` (no `monsterLegendaryUses`, no `activeBuffs`, no `activeConditions`, no `targetEffects`), **no popup**, **no invisibility** anywhere outside the static description blob.
- Full campaign log = 3 entries `[encounter, roll, roll]`; zero `cloaked` / `legendary` / `invisibility` entries.
- **CONTROL (engine alive):** same card, `Rend` `.mc-dice-link` "+16" trusted click → hit popup "Rend — d20 18 +16 to hit, total 34" + a new `roll` log entry (total 18). The combat engine is live; only this legendary row is unwired.
- **Second-click gate absent:** grep of full log for `cloaked_flight_refused` = FALSE — the row never registers a click, so no cooldown/refusal vocabulary is reachable.

## Steps to reproduce
1. localhost:5173 → select **test-campaign** (verify header `test-campaign`).
2. Encounters → search "Ancient Blue Dragon" → tick exact row → **Join Encounter** (`Ancient Blue Dragon 1`, hp 481 / ac 22 / cs 0 in combatSummary).
3. Initiative → click dragon avatar → monster card `.mc-overlay`.
4. Scroll to legendary "Cloaked Flight" row → observe `div.mc-action`, no links, no counter.
5. Force `el.click()` ×2 and a trusted click at the row centre → nothing happens (no popup/log/state).
6. Control: click `Rend` "+16" link → roll popup + log land.

## Likely location
- **Data:** `public/data/monsters.json` → `ancient-blue-dragon.legendary_actions` — entire dict is `{name, description}`-only. Header `legendary_actions[0]` lacks `uses` (→ `legendaryHeaderAction()` in `src/services/encounters/monsterLegendaryUses.js:153` returns null → `MonsterCardBody.jsx:54` takes the fallback branch, so `legendaryGate` is never wired and no counter renders). Component row `MonsterAction.jsx:151/162` emits affordance only when `attack_bonus != null || save_dc != null || canRollExpression(...)` — none present → inert `div.mc-action`.
- **No cast-spell legendary branch:** `MonsterCardModal.jsx` legendary resolution (`resolveLegendaryRowMechanic` ~:249) reaches self-cast/advisory only via authored `action.advisory` (:252) or `action.delegates_to` (:263). Neither key is authored on this row, and Fly / half-Fly-speed prose has no consumer (§7). "casts <spell>" prose = zero producers app-wide (MA-0163).

## Notes — fix-shape recipe (MA-0070 pattern)
Data-only fix: give the header `legendary_actions[0]` `uses: 3` (the "(4 in Lair)" stays advisory text) so `monsterLegendaryUses` economy + counter activate. Then make this row resolvable — either:
- `advisory: "invisibility"` (routes to `buildLegendaryAdvisoryPopup`/`buildLegendaryAdvisoryLog` at `MonsterCardModal.jsx:252` — spend + adjudication record), or
- `delegates_to: "Spellcasting"` + a self-target Invisibility leg so the legendary click spends 1 use and casts Invisibility on itself;
and add a per-action once-per-turn cooldown via `monsterLegendaryActionCooldowns` (`monsterLegendaryUses.js`) producing `cloaked_flight_refused (once per turn)`. Fly / half-fly-speed distance clauses remain an advisory residual (no movement consumer, §7).
Cross-ref: MA-0172 (same monster header, `bug-mon-MA-0172-legendary-uses.md`), MA-0163 ("casts <spell>" inert prose family), MA-0092 (legendary dict lacks `uses`/affordances).
