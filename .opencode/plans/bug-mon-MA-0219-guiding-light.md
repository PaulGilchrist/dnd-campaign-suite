# BUG MA-0219 — Ancient Gold Dragon "Guiding Light" legendary action is inert prose

## Title
MA-0219 Ancient Gold Dragon legendary "Guiding Light" renders as plain text with no affordance; click produces zero roll/log/damage (inert legendary cast-prose family MA-0196/MA-0208).

## Overview
The manifest row expects the dragon's legendary action "Guiding Light" to cast Guiding Bolt (level 4). In app data it is a bare `{name, description}` prose row with no numeric mechanic, and no consumer parses "uses Spellcasting to cast …" into a live roll. Compounding it, this monster's legendary header row lacks the numeric `uses` field, so the entire Legendary Actions section never receives the MA-0021 `legendaryGate` — even the generic "Expend Legendary" chip is absent. Live probe: clicking the row = zero delta (no popup, no roll, no log, no te, no uses spend), while the CONTROL Spellcasting→Guiding Bolt link is fully live on the same card.

## Expected (row + monsters.json)
Manifest MA-0219 expectedBehavior: "The dragon uses Spellcasting to cast Guiding Bolt (level 4 version)."
monsters.json `ancient-gold-dragon.legendary_actions[2]`:
```json
{ "name": "Guiding Light", "description": "The dragon uses Spellcasting to cast <em>Guiding Bolt</em> (level 4 version)." }
```
Expected: clicking the legendary row rolls a spell attack (+16 vs armed target AC) and applies app-data lv4 Guiding Bolt 7d6 radiant (playbook: app lv4 = 7d6), with spend + roll + damage + `ability_use` logs.

## Actual
- Row renders as `<div class="mc-action"><strong>Guiding Light.</strong> <span>The dragon uses Spellcasting to cast <em>Guiding Bolt</em> (level 4 version).</span></div>` — 0 `.mc-dice-link`, 0 role=button (DOM dump of the card row).
- Click on row + `<strong>` label: log stayed at baseline (2 entries), `targetEffects` None, `monsterLegendaryUses` never written, no popup, zero damage.
- Header row `legendary_actions[0]` "Legendary Action Uses: 3 (4 in Lair)" carries no numeric `uses` → `legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153-157) returns null → MonsterCardBody.jsx:54 ternary takes the plain branch → `legendaryGate` never passed → `LegendarySpendLink` (src/components/encounter/MonsterAction.jsx:148-152) returns null. No affordance at all (MA-0217 fingerprint).
- CONTROL (same card, same armed target AberrantSorcerer): Spellcasting `.mc-dice-link` "Guiding Bolt" rolled live — log: `ability_use` "casts Guiding Bolt via Spellcasting — level 4 ranged spell attack +16 vs AberrantSorcerer", `roll attack` rolls [3,12] total 3 +16 HIT, `roll damage` 7d6 [6,5,1,4,2,4,6]=28, `hp_change` written, HIT popup "✓ HIT … Done" applied. Proves the live cast path is a DIFFERENT row; the legendary row itself is inert.

## Steps to Reproduce
1. http://localhost:5173 (GM) → test-campaign → Encounters → search "Ancient Gold Dragon" → tick → Join Encounter.
2. Initiative page → dragon card `[data-testid="target-select"]` selectOption AberrantSorcerer (arm target).
3. Click dragon avatar → card → locate "Guiding Light." row: plain text, no dice link.
4. Click row/label → no popup, no roll, no log delta (log count unchanged), no `monsterLegendaryUses`, no `targetEffects`.
5. CONTROL: same card, Spellcasting row → click "Guiding Bolt" `.mc-dice-link` → HIT popup with +16 roll + 7d6 damage + logs (live path works).

## Likely Location
- `src/components/encounter/MonsterAction.jsx` — `LegendarySpendLink` (:148-159) gated on `legendaryGate`; no prose→cast parser.
- `src/components/encounter/MonsterCardBody.jsx:54-58` — plain branch when header lacks `uses`.
- `src/components/encounter/MonsterCardModal.jsx` — `resolveLegendaryRowMechanic` / `legendaryRowHasNumericMechanic` (:256-278) have no branch for "uses Spellcasting to cast <spell>".
- `public/data/monsters.json` ancient-gold-dragon legendary block — header missing numeric `uses`; Guiding Light missing `delegates_to`/`advisory`/automation metadata.

## Notes
- Inert legendary cast-prose family: MA-0196 (Guiding Light), MA-0208 (Mind Jolt) — same fingerprint FAIL.
- Possible fix: data-side `delegates_to: "Spellcasting"` + a Spellcasting-delegate branch (existing MA-0022 delegate seam resolves attack_bonus/save_dc rows only), or an auto_attack bonus field (attack_bonus:+16 + damage dice + level-4 note) so the row rolls through the existing numeric chip; also add numeric `uses: 3` to the header row (MA-0217 fix shape) so the gated legendary economy engages.
- Control cast popup printed "vs AC 9"; sorcerer cs HP is a 1/1 placeholder (PC HP truth = runtime currentHitPoints, playbook §1) — control proven by new log roll/damage lines, not HP delta.
