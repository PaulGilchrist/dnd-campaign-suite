# MA-1579 — Tarrasque "General" — FAIL

**Row:** MA-1579 · Tarrasque (`tarrasque`) · legendary_actions[0] · "General" (advisory header)
**Verdict:** FAIL — live card has NO legendary-uses header ("Legendary Action Uses: 3" absent); children present but ungated.

## Expected (fingerprint §MA-1456/§MA-1494 seam)
Legendary block renders canonical header row `.mc-legendary-header-row` with
counter `.mc-legendary-counter` "(3 left)" (RAW count 3 = the "3" in the
General description = 3 children Attack/Move/Chomp), children visible, and —
when the header carries numeric `uses` — a spend gate on child rows.

## Live Evidence (E2E, localhost:5173, test-campaign)
- EB join exact "Tarrasque" + "Bandit" → Join Encounter → tracker shows
  Tarrasque 1 / Bandit 1. Avatar click opens MonsterCardModal (§138 second click).
- DOM probe on the open card:
  - `.mc-legendary-header-row` → **absent** (`headerRowExists: false`)
  - `.mc-legendary-counter` → **absent** (`counterText: null`)
  - Legendary Actions rows rendered as PLAIN text:
    1. "General. The tarrasque can take 3 legendary actions…"
    2. "Attack. The tarrasque makes one claw attack or tail attack."
    3. "Move. The tarrasque moves up to half its speed."
    4. "Chomp (Costs 2 Actions). The tarrasque makes one bite attack…"
  - Legendary-section chips → **empty** (no "Expend Legendary"/gate affordance,
    so fingerprint step 3 (single press + decrement/refusal) not performable —
    the spend economy never arms for this monster).
- Screenshot: `.playwright-mcp/ma-1579-tarrasque-card.png`

## Root cause (static grep)
- Disk `public/data/monsters.json` Tarrasque `legendary_actions[0]` =
  `{ name: "General", description: "…3 legendary actions…" }` — **no `uses`**
  and no canonical "Legendary Action Uses: N" name. Tarrasque + Adult Blue
  Dracolich are the only two monsters with a `General` row[0]; the Dracolich's
  carries `uses: 3` (MA-0050). All §MA-1456/§MA-1494-proven monsters carry a
  canonical `{ name: "Legendary Action Uses: N", uses: N }` row authored on
  disk — there is NO runtime children-count injection anywhere in src/
  (grep: only `legendaryHeaderAction` + the header-row render consume headers).
- `legendaryHeaderAction()` (`src/services/encounters/monsterLegendaryUses.js:153-157`)
  returns `rows[0]` **only when `rows[0].uses != null`** → null for Tarrasque.
- `MonsterCardBody.jsx:53,69-70`: the gated section (header +
  `legendaryGate={handleLegendaryRow}` expend economy of
  `legendaryExpendGate`/`expendLegendaryUse`) renders only when
  `legendaryHeaderAction` is non-null; otherwise plain `MonsterActionSection`.
  Hence no counter AND no chip gate → zero spend consumers on this block.

## Fix (tracked on this row; child mechanics verified on child rows)
Author truth into disk per MA-0050 precedent, keeping the RAW advisory text:
`legendary_actions[0]` → `{ "name": "General", "uses": 3, "description": "<unchanged>" }`
(canonical rename to "Legendary Action Uses: 3" if the registry prefers the
byte-template). `uses: 3` activates `legendaryHeaderAction` →
`mc-legendary-header-row` "(3 left)" counter + gates Attack/Move/Chomp through
the existing `legendaryExpendGate` (Chomp cost-2 handling lives on its child row).

## Cleanup performed
Admin → Clear Change Data (confirmed) + Clear Campaign Log (confirmed);
Initiative → Clear (confirmed; Bandit 1 no longer in tracker). Campaign header
verified `test-campaign` throughout.

## Registry notes
- Tarrasque legendary config: General (advisory, no uses) + Attack + Move +
  Chomp (Costs 2 Actions); no lair actions, no regional effects.
- Header render seam: `MonsterCardBody.jsx:259-268` (`MonsterLegendaryHeaderRow`).
- Spend gate: `legendaryExpendGate` (monsterLegendaryUses.js:174-183) —
  exhausted/own-turn/turn-latch refusals; dormant without header `uses`.
