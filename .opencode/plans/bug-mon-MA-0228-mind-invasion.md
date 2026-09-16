# Bug MA-0228 — Ancient Green Dragon "Mind Invasion" legendary action INERT (FAIL)

**Verdict: FAIL** (2026-09-15, test-campaign, MA-0219/0217/0227 fingerprint re-confirmed on this monster)

## Evidence

### Static (monsters.json + grep)
- `ancient-green-dragon.legendary_actions[1]` = bare `{name:"Mind Invasion", description:"The dragon uses Spellcasting to cast <em>Mind Spike</em> (level 5 version)."}` — no `attack_bonus`, `save_dc`, `dice`, `delegates_to`, or `automation`.
- Header `legendary_actions[0]` has NO numeric `uses` ("3 (4 in Lair)" is name-text only) → `legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153-157) returns null → `LegendarySpendLink` (src/components/encounter/MonsterAction.jsx:148) returns null → gate never wired.
- `delegates_to` consumer EXISTS (monsterLegendaryUses.js:7 `findDelegatedAction`) but the row lacks the key; no consumer anywhere turns "uses Spellcasting to cast Mind Spike" prose into a roll.

### Live probe (EB-joined Ancient Green Dragon 1, target AberrantSorcerer armed)
- Row outerHTML: `<div class="mc-action "><strong>Mind Invasion.</strong> <span>The dragon uses Spellcasting to cast <em>Mind Spike</em> (level 5 version).</span></div>` — **0 `.mc-dice-link`, 0 button/[role=button]**, no `.mc-legendary-counter` anywhere on card.
- Row click → **zero delta**: log stayed 2 entries (encounter+roll baseline), no overlay, no prompt, no spend.

### Control (live path = different row)
- Non-legendary Spellcasting row `.mc-dice-link` "Mind Spike" click → WIS save prompt DC 21 → rolled 10+(-1)=9 FAIL → log `save_result` + `hp_change` + damage roll `[4,3,4,2,1,6]`=20 (6d8 lv5 psychic, Ancient Green Dragon 1). Live engine path confirmed working — the legendary row simply never routes into it.

## Likely Location
- `public/data/monsters.json` — ancient-green-dragon `legendary_actions[0]` (missing `uses`) and `[1]` Mind Invasion (missing `delegates_to`/metadata)
- `src/components/encounter/MonsterCardBody.jsx` legendary block (renders bare prose rows, ungated branch ~:54-58)
- `src/components/encounter/MonsterAction.jsx:148` `LegendarySpendLink` null-return

## Fix shape
Header row gains `uses: 3` (+ lair note) AND Mind Invasion gains `delegates_to: "Spellcasting"` cast branch resolving "Mind Spike (level 5 version)" → lv5 6d8 DC 21 WIS via existing Spellcasting cast handler (MA-0185/MA-0219 fix shape); or inline auto_attack/save metadata on the row.
