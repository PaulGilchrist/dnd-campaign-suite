# MA-0566 Death Knight — Dread Authority (legendary_actions[0]) — FAIL(b) inert

## Row
- monsterIndex death-knight, category legendary_actions, actionIndex 0, uses:1, type other.
- Description: "Cast Command via Spellcasting; can't repeat until start of next turn."

## Root cause (DATA, disk public/data/monsters.json death-knight.legendary_actions)
Death Knight has NO legendary header row. rows[0] is the Dread Authority child itself
({name:"Dread Authority", uses:1}). `legendaryHeaderAction()` (monsterLegendaryUses.js:156)
returns rows[0] whenever rows[0].uses!=null → Dread Authority is SWALLOWED as the economy
header (MA-0511 header-swallow fingerprint).

Consequences (code layer, all live-confirmed):
1. MonsterCardBody.jsx:54 renders `actions.slice(1)` as children — Dread Authority never
   renders as an actionable row. It shows ONLY as inert `mc-legendary-header-row` text
   "Dread Authority (1 left)" (MonsterLegendaryHeaderRow) — zero chip, click log-delta 0,
   no popup. Zero affordance by construction.
2. Even if rendered as a child, Dread Authority has no delegates_to ("Command"/"Spellcasting"
   absent) and no numeric spell fields → resolveLegendaryRowMechanic falls through to
   console.error "no resolvable mechanic" = MA-0510 SILENT-BURN, exactly like sibling
   Lunge rows[2] (also delegates_to:undefined). Command is NEVER cast; no command word,
   no charmed/te, zero adjudication of this row ever.
3. The swallowed header counter (max 1) is real economy but only reachable via siblings:
   Lunge's "Expend Legendary" chip burns the single use with console.error (see evidence),
   Fell Word's numeric save chip rides the same shared counter.

## Live evidence (test-campaign, :5173, EB Join Death Knight 1 + Bandit 1, round 1)
- Card audit: `.mc-legendary-header-row` text "Dread Authority (1 left) The death knight uses
  Spellcasting to cast Command..." chips:[] — zero affordance.
- Header-row synthetic click: log-delta 0, popup false, monsterLegendaryUses unchanged (null).
- Lunge chip click (only expend affordance): ability_use "expends a legendary use for Lunge
  after Bandit 1's turn — 0 of 1 left", counter monsterLegendaryUses {max:1,used:1},
  console.error [MonsterCardModal.jsx:563] legendary action "Lunge" delegates_to "undefined"
  — no resolvable mechanic. Zero roll, zero damage, zero condition = SILENT-BURN.
- Exhausted re-click: refusal popup "Lunge: Death Knight 1 has no legendary uses left" +
  automation/legendary_use_refused (exhausted), zero spend, counter holds 1/1.
- Turn-start regain LIVE: gate 2:Death Knight 1 → counter used:0 + ability_use
  "regains all expended legendary action uses at the start of its turn — 1 available."
- Cleanup: admin clear change-data+log API-empty verified; hard reload.

## Fix (DATA, monsters.json death-knight.legendary_actions)
Prepend header + delegate Dread Authority, same pass (header/children coupling §46):
```json
{ "name": "Legendary Action Uses: 2", "uses": 2,
  "description": "Pick one: Dread Authority, Fell Word, or Lunge. ... regain at start of turn (advisory)." }
```
- Dread Authority: needs a resolvable mechanic — structured spellcast delegate
  (delegates_to:"Spellcasting" misfires through save legs per §46; prefer advisory
  `{advisory:"command", advisory_message:"..."}` record-only seam MA-0058/MA-0270, or a
  command-word chooser template — no engine consumer exists for Command's word-condition
  mapping; record-only is honest).
- Lunge: add delegates_to:"Dread Blade" (MA-0022 prose weapon child template) — currently
  silent-burns the shared counter (sibling row MA-0568).

## Verdict
FAIL(b): Dread Authority inert-by-construction (header-swallow, zero affordance,
delegates_to undefined silent-burn family MA-0510/0511). Economy engine alive
(expend/refuse/regain proven); row mechanic dead.
