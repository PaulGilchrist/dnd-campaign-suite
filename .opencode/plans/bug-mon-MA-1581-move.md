# Bug MA-1581 — Tarrasque Legendary "Move": zero-affordance plain text (FAIL)

**Verdict: FAIL** (b/DATA twin — legendary "Move" child renders honest plain text with zero chip, zero counter, zero uses-spend, zero log; only physical affordance is GM token-drag on the gridless map (recorded, ungated, unlogged). Zero in-app legendary-Move affordance → FAIL(b)/DATA; fix: advisory child or delegates_to per §MA-1456 nameless-advisory pattern; header `uses: 3` stamp rides MA-1579.)

## Row
```json
{"id":"MA-1581","monster":"Tarrasque","monsterIndex":"tarrasque","category":"legendary_actions","actionIndex":2,"actionType":"other","actionName":"Move","description":"The tarrasque moves up to half its speed."}
```

## Context (block probed minutes ago)
- MA-1579 FAIL: Tarrasque legendary block has **no header** — `legendaryHeaderAction` (`src/services/encounters/monsterLegendaryUses.js:153-156`) returns `null` because disk `legendary_actions[0]` ("General") has no `uses` → counter `(3 left)` absent, spend gate `legendaryExpendGate` dormant for ALL children incl. Move.
- MA-1580 FAIL: "Attack" child = plain text, 0 affordances (children keys `['description','name']` only).

## Live probe (Playwright, localhost:5173, test-campaign ONLY)
- Join: Encounter Builder → exact checkboxes `Select Tarrasque` (CR 30) + `Select Bandit` (CR 0.125) only (evaluate: `checked: ["Select Bandit","Select Tarrasque"]`) → **Join Encounter** → tracker: `Tarrasque 1` HP 676/676 init 12, `Bandit 1` present.
- Card: Tarrasque avatar click opened `mc-body` monster card (§138).
- Legendary "Move" row DOM probe (`h5.mc-section-title "Legendary Actions"` → sibling `div.mc-section` → row matching `/^move/i`):
  - `outerHTML`: `<div class="mc-action "><strong>Move.</strong> <span>The tarrasque moves up to half its speed.</span></div>`
  - buttons **0**, anchors **0**, `[role=button]` **0**, chips/badges **0**, `.mc-dice-link` **0**, cursor **auto**, tabindex **-1**, no `on*` attrs.
  - Whole legendary block: `querySelectorAll('button,a,[role=button]').length === 0`; `.mc-legendary-header-row` **false**; `.mc-legendary-counter` **null**; rows = General./Attack./Move./Chomp (Costs 2 Actions).
- Press attempts (full pointer+mouse+click sequence on row, its `<strong>`, its `<span>`; plus keyboard Enter on row): **zero reaction** — overlayDelta 0 on every target; no modal, no chip, no roll, no uses decrement possible (gate dormant).
- Log delta vs baseline (baseline **0** via API): after join **3** entries — 1x `encounter/joined` + 2x initiative rolls (Tarrasque 12, Bandit) — all Join-attributable. Across all Move presses and the token drag: **0 additional entries**; `MOVE_LOG: []`, `MOVE_RELATED: []`. `change-data` keys: zero `move`/`legendary` keys.

## Static grep (movement-affordance consumers)
- `rg -in "legendary.*move|half.*speed" src/`: no consumer for legendary Move. Matches are unrelated features (Maneuvering Attack, Tactical Shift, speed_half condition badge, Cunning Strike Withdraw). Precedent advisory text (`monsterLegendaryUses.js:259,266`; tests `:740/:816`) explicitly documents "movement advisory — GM moves the token; no movement-distance consumer" — same class as this row.
- Physical affordance EXISTS: `src/components/map/hooks/usePlayerDragging.js` (`handlePointerDown/Move/Up` with `svg.setPointerCapture`; wired in `Players.jsx:28` `onPointerDown`). Grep for `log|legendary` in the hook: **0 hits** → pure position update, no uses-gate, no log.
- Disk `public/data/monsters.json` Tarrasque `legendary_actions[2]` = `{name:"Move", description:"The tarrasque moves up to half its speed."}` — no `delegates_to`, no `uses`; speed walk 40 ft. (half-speed target would be 20 ft.; ungated drag has no distance enforcement).

## Physical-move live check (recorded, per brief)
Maps → Battle Arena **Activate** + **Open** → character tokens render (no Tarrasque token; tokens are characters). Pointer-dragged AberrantSorcerer token: circle cx/cy **(340,340) → (380,380)** — `moved: true`. Free drag, any distance; log stayed at 3 (join-only); zero uses consumed (none exist). Screenshot: `ma-1581-token-drag.png`.

## Verdict
FAIL(b)/DATA — twin of MA-1580 zero-affordance family and the §MA-1456 nameless-advisory pattern applies: honest plain text, no in-app affordance (chip/counter/log) for the legendary Move. Root cause identical: child lacks `delegates_to`/advisory stamp AND header lacks `uses: 3` (MA-1579), so the spend economy never arms for the block.

## Fix (tracked on this row)
DATA fix in `public/data/monsters.json` tarrasque `legendary_actions`:
- Header row[0] "General": add `"uses": 3` (gates all children incl. Move — MA-1579 fix).
- "Move" child: advisory child stamp (or `delegates_to`) per §MA-1456 so it produces a record/log; movement-distance itself stays GM-adjudicated (no movement-distance consumer by design precedent).

## Notes
- Physical gridless token movement (map drag) = GM-adjudicated residual; exists but ungated + unlogged.
- Zero uses-gate on Move because header is unarmed (MA-1579) — no double-file of the header gap; fix lands once on MA-1579.

## Cleanup performed
- Initiative → Clear (confirm accepted; tracker shows no Tarrasque).
- Admin → Clear Change Data (`change-data keys: []`, also reset `__map__` activation) + Clear Campaign Log (`LOG_COUNT: 0`).
- Campaign header verified `test-campaign` throughout; console 0 errors (2 pre-existing warnings); only test-campaign mutated.
