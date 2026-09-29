# Bug MA-1582 — Tarrasque Legendary "Chomp (Costs 2 Actions)": zero-affordance plain text (FAIL)

**Verdict: FAIL** (b/DATA twin — Chomp child renders honest plain text with zero chip, zero counter, zero cost-2 gate, zero uses-spend, zero log; the "(Costs 2 Actions)" suffix renders fully and honestly in the row name but is inert label text — no consumer parses it. Zero in-app affordance → FAIL(b)/DATA; fix: `delegates_to: "Bite"` on the child (+ unexpressible Swallow second-option note; cost-2 gate stays dormant while header lacks `uses: 3` — MA-1579).

## Row
```json
{"id":"MA-1582","monster":"Tarrasque","monsterIndex":"tarrasque","category":"legendary_actions","actionIndex":3,"actionType":"other","actionName":"Chomp (Costs 2 Actions)","description":"The tarrasque makes one bite attack or uses its Swallow."}
```

## Context (block fully probed today — MA-1579/1580/1581 all FAIL)
- MA-1579 FAIL: header "General" lacks `uses` → `legendaryHeaderAction` (`src/services/encounters/monsterLegendaryUses.js:153-156`) returns `null`; counter `(3 left)` absent, spend gate `legendaryExpendGate` dormant for ALL children incl. Chomp.
- MA-1580/1581 FAIL: siblings "Attack"/"Move" = plain text, zero affordance; children keys `['description','name']` only.
- Disk child (`public/data/monsters.json` tarrasque `legendary_actions[3]`) = `{name:"Chomp (Costs 2 Actions)", description}` — no `delegates_to`, no cost field; no cost-field consumer exists.

## Live probe (Playwright, localhost:5173, test-campaign ONLY)
- Join: Encounter Builder → exact checkboxes `Select Tarrasque` (CR 30) + `Select Bandit` (CR 0.125) only (evaluate: `checked: ["Select Bandit","Select Tarrasque"]`) → **Join Encounter** → tracker: `Tarrasque 1` HP 676/676 init 9, `Bandit 1` init 14 present.
- Card: Tarrasque avatar click opened `mc-body` monster card (§138), title `Tarrasque 1`.
- Chomp row DOM probe (scoped `.mc-section` after `h5.mc-section-title "Legendary Actions"`, row matching `/chomp/i`):
  - `outerHTML`: `<div class="mc-action "><strong>Chomp (Costs 2 Actions).</strong> <span>The tarrasque makes one bite attack or uses its Swallow.</span></div>`
  - buttons **0**, anchors **0**, `[role=button]` **0**, chips/badges **0**, `.mc-dice-link` **0**, cursor **auto**, tabindex **null**, no `on*` attrs.
  - Whole legendary block: `querySelectorAll('button,a,[role=button]').length === 0`; `.mc-legendary-header-row` **false**; `.mc-legendary-counter` **null**; rows = General./Attack./Move./Chomp (Costs 2 Actions).
- Press attempts (full pointer+mouse+click sequence on row, its `<strong>`, its `<span>`; plus keyboard Enter on row): **zero reaction** — overlayDelta 0 (1→1, card modal only), popupHtml null.
- **Display honesty check (suffix):** name renders exactly `Chomp (Costs 2 Actions).` in `<strong>` — full, untruncated, correct. No display bug on the label itself; it is simply inert decoration (nothing parses "Costs 2").
- Log delta vs baseline (baseline **0** via API): after join **3** entries — 1x `encounter/joined` + 2x initiative rolls (Tarrasque 9, Bandit 14) — all Join-attributable. Across all Chomp presses: **0 additional entries**. `change-data` keys post-probe: `activeCreatureName`, `combat-ui-viewingMonster(CreatureName)` (card-open attributable); zero `chomp`/`cost`/`legendary` keys.

## Static grep (cost/Chomp consumers)
- `rg -in "cost" src/services/encounters/monsterLegendaryUses.js`: **zero hits** — no cost/costs parsing anywhere in the legendary-uses engine; "(Costs 2 Actions)" is never interpreted, only printed.
- `rg -iln "chomp" src/`: test fixtures only (`monsterLegendaryUses.test.js`, Beholder/Blob card tests) — no runtime Chomp handler.
- No `delegates_to` on the child → `legendaryDelegateAction` never engages; row never becomes a gated clickable (per MA-1580/1581 rendering path for `{name, description}`-only children).

## Verdict
FAIL(b)/DATA — twin of MA-1580/1581 zero-affordance family. Chomp is honest plain text: full cost suffix displayed but unenforced, no affordance (chip/attack/counter/log), cost-2 semantics wholly unexpressible in the current child schema. Root cause identical chain: child lacks `delegates_to` AND header lacks `uses: 3` (MA-1579), so the spend economy never arms for the block; even if armed, no consumer exists for a 2-action cost.

## Fix (tracked on this row)
DATA fix in `public/data/monsters.json` tarrasque `legendary_actions`:
- Header row[0] "General": add `"uses": 3` (gates all children — MA-1579 fix, lands once there).
- "Chomp (Costs 2 Actions)" child: add `"delegates_to": "Bite"` so the row resolves the Bite attack mechanic when the block arms.
- Note: the "or uses its Swallow" second option is **unexpressible** in the single-delegate model — remains GM-adjudicated; cost-2 (two legendary actions for one Chomp) stays dormant/unenforced until both header `uses:3` (MA-1579) and a cost-2 consumer exist — documented as an accepted residual.

## Evidence
- Screenshot: `ma-1582-chomp-row.png`
- Console: 0 errors (2 pre-existing warnings); campaign header `test-campaign` throughout.

## Cleanup performed
- Initiative → Clear (confirm accepted; no Tarrasque in tracker).
- Admin → Clear Change Data (`change-data keys: []`) + Clear Campaign Log (`LOG_COUNT: 0`).
- Only test-campaign mutated; static files untouched.
