# Bug MA-0125 — Adult Red Dragon "Commanding Presence": inert legendary row (prose-only cast reference, 0 affordances, no economy)

**Verdict: FAIL** (row inert — MA-0114/MA-0094 fingerprint on the same dragon already proven inert in MA-0124; forced clicks zero popup/log/state; control Rend live proves engine alive and row is the unwired gap)

## Row
- MA-0125 · Adult Red Dragon (`adult-red-dragon`) · `legendary_actions[1]` · category: legendary_actions · actionType: other.
- monsters.json (read 2026-09-14): `{name:"Commanding Presence", description:"The dragon uses Spellcasting to cast <em>Command</em> (level 2 version). The dragon can't take this action again until the start of its next turn."}` — **prose-only**: no `automation`, no `delegates_to`, no `save_dc`, no `spell`, no `uses`. Spellcasting action row exists (`save_dc:20`, Charisma, At-Will list includes "Command (level 2 version)") but the legendary row carries no structured cast payload linking to it.
- Expected per text + spells.json: as a legendary action, cast Command — target WIS save vs DC 20, one word command effect; lv2 version can affect a 2nd creature; gated by the (also-absent, MA-0124) legendary-uses economy with the can't-repeat-until-next-turn latch.

## Static grep (pre-probe)
- `rg -in 'commanding.?presence' src server` → only hits are the Battle Master **fighting-style maneuver** family (`src/services/automation/handlers/class-fighter-rogue/executeActionManeuvers.js:551+`, player Combat Superiority context) — **zero monster-legendary consumers**. No code keys the dragon's legendary row to Command.
- `MonsterAction.jsx` emits affordances only for rows with authored `attack_bonus`/`save_dc`/dice (MA-0114 root cause); no `delegates_to` consumer exists → this prose-only row renders static text.

## Live probe (test-campaign, :5173, 2026-09-14)
Baseline clean: log `[]`, change-data keys `[]`. EB search "Adult Red Dragon" → tick → Join Encounter → cs idx 0 `Adult Red Dragon 1` (npc, init 14, hp 256). Armed target via card `[data-testid="target-select"]` → server-verified `combatSummary.creatures[0].targetName:"DivinationWizard"`. Card opened via avatar click (`.mc-overlay` with 15 `.mc-action` rows).

### FAIL 1 — Row is INERT (cannot be triggered)
- Row DOM: `DIV.mc-action`, innerHTML `<strong>Commanding Presence.</strong> <span>The dragon uses Spellcasting to cast <em>Command</em> (level 2 version)…</span>` — **clickableChildren: []**, `interactiveDescendants: 0`. No `.mc-dice-link`, `.mc-dice-link-spell`, `.mc-dice-link-legendary`, `[role=button]`, `a`, or `button`.
- Forced clicks on row AND its `<strong>`: **zero new overlays** (visible-overlay scan `[]`), log stayed at 2-entry join baseline, no `pendingSavePrompts`, no `lastAttack`, no Command save prompt, no spell-cast modal, no spend. The action cannot fire.

### FAIL 2 — No legendary economy (MA-0124 fingerprint, same card)
- `.mc-legendary-counter` absent, `.mc-legendary-header-row` absent (header row lacks `uses`); `monsterLegendaryUses` never appears in change-data — "can't take this action again until the start of its next turn" latch has no enforcement substrate.

## Control probe (engine alive)
Same card, Rend `.mc-dice-link` "+14": click rolled live — log `roll` entry `Rend` rolls [17,20], bonus +14, total 31 vs AC 9, **hit:true**, target DivinationWizard; `lastAttack` stamped. Engine + card modal are functional; the legendary row alone is the unwired gap.

## PASS subset
- None for this row (unreachable). Control-adjacent truth: Spellcasting DC 20/Charisma authored; Command spell data present (WIS save, lv2 multi-target clause) — but nothing consumes it from the legendary row.

## Root cause / fix shape
1. **Inert row (primary):** prose-only "uses Spellcasting to cast X" legendary row has no affordance producer (`MonsterAction.jsx` gates links on authored numeric fields; no `delegates_to` consumer). MA-0094/MA-0114 fix shape: give the row a resolvable cast payload (delegate to Spellcasting Command at cast level 2, DC 20 WIS) or make legendaryGate clickable per MA-0021.
2. **Economy:** header row lacks `uses: 3` → counter/gate/one-per-other-turn latch/regain dormant (MA-0124 recipe); the row's own "can't take again until next turn" clause also needs a row-level latch consumer (none exists — grep zero).
3. Lv2 multi-target clause (Command affects +1 creature per slot above 1st) has no monster-side multi-target producer even at the Spellcasting seam (single-target link model).

## Notes
- Registry: no `Adult Red Dragon` entry in `docs/test-monster-registry.json` — fresh join this probe (placed hp 256 / init 14); orchestrator re-entry needed.
- Byte-shape identical to MA-0114 (Adult Green Mind Invasion) inert failure; same dragon already FAILed legendary-section-wide in MA-0124.

## Cleanup
- Page closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. Only `test-campaign` touched; no manifest `verified` edits.
