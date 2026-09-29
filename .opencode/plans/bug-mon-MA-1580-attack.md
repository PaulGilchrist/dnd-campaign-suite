# Bug MA-1580 — Tarrasque Legendary "Attack": zero-affordance plain text (FAIL)

**Verdict: FAIL** (b/DATA — legendary child renders honest plain text with zero chip, zero rolls, zero use-spend; claw-or-tail choice has no consumer; legendary gate dormant without header `uses` stamp. Twin of MA-1543/MA-1551 zero-affordance family.)

## Row
```json
{"id":"MA-1580","monster":"Tarrasque","monsterIndex":"tarrasque","category":"legendary_actions","actionIndex":1,"actionType":"other","actionName":"Attack","description":"The tarrasque makes one claw attack or tail attack."}
```

## Expected (per §MA-1456 / §MA-1579)
> Tarrasque legendary children on disk are {name,description} ONLY — no delegates_to, no numeric dice, and the block's header `uses` stamp is absent (MA-1579 FAIL filed: header gate monsterLegendaryUses.js:153 rows[0].uses!=null). Per §MA-1456, a legendary child gets a clickable delegated attack chip ONLY via `delegates_to:"<AttackRowName>"`; without it the child is honest plain text with zero affordance.
> EXPECTED: "Attack" legendary child renders as plain text, zero chip, zero rolls, zero use-spend (gate dormant w/o header) → FAIL(b)/DATA (twin MA-1543/1551 zero-affordance family; fix = delegates_to:"Claw" + header uses:3 stamp, Arcane Prowl MA-1494 / Pounce MA-1456 precedent).

## Live probe (Playwright, test-campaign only)
- Join: Encounter Builder search → exact checkboxes `Select Tarrasque` (CR 30) + `Select Bandit` (CR 0.125) only (Bandit Captain/Crime Lord/Deceiver left unchecked) → **Join Encounter** → initiative round 1: `Tarrasque 1` HP 676/676 init 9, `Bandit 1` HP 11/11 init 15.
- Card: Tarrasque avatar click opened `mc-body` monster card.
- Legendary section DOM (`h5.mc-section-title "Legendary Actions"` → sibling `div.mc-section`): exactly 4 rows, all `div.mc-action`:
  1. `General.` — prose only ("can take 3 legendary actions…"), **no uses counter/counter UI, no spend control**
  2. `Attack.` — `<strong>Attack.</strong> <span>The tarrasque makes one claw attack or tail attack.</span>`
  3. `Move.`
  4. `Chomp (Costs 2 Actions).`
- **Affordance count inside legendary block: 0.** `sec.querySelectorAll('button,a,[role=button]').length === 0`; zero `[class*=chip]`, zero `[class*=badge]`, zero `mc-dice-link` in any legendary row. (The card's 16 clickable dice-links all live in mc-abilities/mc-defenses/actions rows — none in legendary.)
- Press attempts: forced click on Attack row, its `<strong>`, its `<span>` → all land, **zero reaction** (no modal, no roll, no chip, no state write).
- Log delta across presses: **0** entries (`logBefore 3 → logAfter 3`). The 3 entries are Join-attributable only: 1x `encounter/joined [1x Tarrasque, 1x Bandit]` + 2x initiative rolls (Tarrasque 9, Bandit 15). Zero legendary attack/log/uses activity.
- Console: 0 errors throughout (2 pre-existing warnings).

## Root cause (static)
1. **No `delegates_to` on the child.** `public/data/monsters.json` tarrasque legendary children carry keys `['description','name']` only. Consumer `legendaryDelegateAction` (`src/services/encounters/monsterLegendaryUses.js:7-9`) returns `null` without `delegates_to` → no delegated Claw chip → plain text (per §MA-1456).
2. **No header `uses` stamp → gate dormant.** `legendaryHeaderAction` (`monsterLegendaryUses.js:153-156`) returns `null` unless `rows[0].uses != null`; tarrasque `rows[0]` is the "General" prose row with no `uses` → `legendaryMaxUses` yields `null` → zero use-spend tracking, no cooldown refusal possible (MA-1579 already filed on this header gap).
3. **Claw-or-tail choice has no consumer.** Actions block contains both `Claw` and `Tail` rows, but the free-text choice "one claw attack or tail attack" in the legendary child is unparsed; with no `delegates_to` neither attack is reachable from the legendary child. (The format exists in-database elsewhere — e.g. `"delegates_to": "Tail"` at monsters.json:1416.)

## Fix (precedent: MA-1494 Arcane Prowl / MA-1456 Pounce)
DATA fix in `public/data/monsters.json` tarrasque `legendary_actions`:
- Header row: add `"uses": 3`.
- `Attack` child: add `"delegates_to": "Claw"` (single-delegate limitation of the mechanism — tail alternative stays prose; a two-chip or choice UI would be a separate feature).

## Cleanup performed
- Initiative cleared (confirm accepted; `Tarrasque 1` no longer in tracker).
- Admin → Clear Change Data (`change-data keys: []`) and Clear Campaign Log (`LOG_COUNT: 0`), `test-campaign` only.
