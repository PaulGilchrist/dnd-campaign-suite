# Bug MA-0137 — Adult Silver Dragon "Chill": inert legendary row (prose-only cast reference, 0 affordances, no economy)

**Verdict: FAIL** (row inert — MA-0114/MA-0125 fingerprint; forced clicks zero popup/log/state; control Rend live + Spellcasting "Hold Monster" link live prove the engine and the spell seam work — the legendary Chill row alone is the unwired gap)

## Row
- MA-0137 · Adult Silver Dragon (`adult-silver-dragon`) · `legendary_actions[1]` · category: legendary_actions · actionType: other · manifest verified: "not verified" (untouched).
- monsters.json (read 2026-09-14): `{name:"Chill", description:"The dragon uses Spellcasting to cast <em>Hold Monster</em>. The dragon can't take this action again until the start of its next turn."}` — **prose-only**: no `automation`, no `delegates_to`, no `advisory`, no `save_dc`, no `spell`, no `uses`. The Spellcasting action row exists (`save_dc:19`, Charisma, At-Will list includes Hold Monster) but the legendary row carries no structured cast payload linking to it.
- Expected per text + app spells.json: as a legendary action, cast Hold Monster — target WIS save vs DC 19, Paralyzed/Incapacitated-style hold effect, gated by the legendary-uses economy (3/4-in-lair) plus the can't-repeat-until-next-turn latch.

## Static grep (pre-probe)
- `rg -in 'chill' src server` → zero monster-legendary consumers: all hits are player-side "Frost's Chill" (giant ancestry), "Chill Touch" cantrip lists, npcGenerator flavor. No code keys the dragon's legendary "Chill" row to Hold Monster or Spellcasting.
- `legendaryHeaderAction` (`src/services/encounters/monsterLegendaryUses.js`) returns null unless `legendary_actions[0].uses != null` — Adult Silver header is plain name-text ("Legendary Action Uses: 3 (4 in Lair)") with **no `uses` field** → `MonsterCardBody.jsx` takes the non-economy branch → `legendaryGate` never passed → `LegendarySpendLink` (MonsterAction.jsx:148, `if (!legendaryGate) return null`) renders nothing. Chill row therefore emits 0 affordances (MA-0125/MA-0114 root cause, byte-identical).
- No `delegates_to` consumer applies (row lacks the field anyway); no `advisory` field → MA-0058 advisory-popup path also unreachable.

## Live probe (test-campaign, :5173, 2026-09-14)
Baseline clean: log `[]` pre-join, EB search "Adult Silver Dragon" → tick → Join Encounter → cs idx 0 `Adult Silver Dragon 1` (npc, init 14, hp 216/216, AC 19, Cold immunity). Armed target via dragon-card `[data-testid="target-select"]` → server-verified `combatSummary.creatures[0].targetName:"DivinationWizard"`; `activeCreatureName:"AasimarTest"` (not dragon — gate window valid). Card opened via avatar click (`.mc-overlay`, 15 `.mc-action` rows).

### FAIL 1 — Row is INERT (cannot be triggered)
- Row DOM: `DIV.mc-action`, innerHTML `<strong>Chill.</strong> <span>The dragon uses Spellcasting to cast <em>Hold Monster</em>. The dragon can't take this action again until the start of its next turn.</span>` — **clickableChildren: []**. No `.mc-dice-link`, `.mc-dice-link-spell`, `.mc-dice-link-legendary`, `[role=button]`, `a`, or `button` inside the Chill row.
- Forced clicks on row AND its `<strong>`: **zero new overlays** (visible-overlay scan `[]`), log stayed at 2-entry join baseline, no save prompt, no `pendingSavePrompts`, no spell-cast `ability_use` echo, no Hold Monster effect, no spend. The action cannot fire.

### FAIL 2 — No legendary economy (MA-0124/MA-0125 fingerprint, same card)
- `.mc-legendary-counter` absent; header row is inert `DIV.mc-action` plain text (no `uses` authored → `legendaryHeaderAction` null). `monsterLegendaryUses` key never appears in change-data (silver store held only `lastAttackRoll`/`_lastRollContext` from the control Rend). "Expend 1 of 3" and the row's own "can't take again until next turn" latch have no enforcement substrate.
- Contrast on same card: Cold Gale (numeric `save_dc`+dice) renders clickable `4d6`/`DC 19 Dexterity` chips (MA-0023 numeric exception); Chill and Pounce (prose-only) render static.

## Control probes (engine + spell seam alive)
1. Same card, Rend `.mc-dice-link` "+13": live roll d20 8 +13 = **HIT (21 vs AC 9)**, Done applied → `hp_change` logged, `lastAttack` stamped `attackerName:"Adult Silver Dragon 1", attackName:"Rend", hit:true`.
2. Same card, Spellcasting row `.mc-dice-link-spell` "Hold Monster": fired an `ability_use` log — "Adult Silver Dragon 1 casts Hold Monster via Spellcasting (spell save DC 19, WIS). Concentration (Up to 1 minute). Spell effect is recorded; GM-enforced for monsters." So Hold Monster itself has a live cast seam at DC 19 WIS — Chill's failure is purely its own unwired row, not a spell gap.

## PASS subset
- None for this row (unreachable). Adjacent truth: Spellcasting DC 19/Charisma + per-spell Hold Monster link resolve (advisory-cast model); Cold Gale numeric chips clickable; engine rolls live.

## Root cause / fix shape
1. **Inert row (primary):** prose-only "uses Spellcasting to cast X" legendary row has no affordance producer and no economy branch (header lacks `uses`). Fix shape (MA-0021 + MA-0022/MA-0058 combination): author header `uses:3` to activate the economy branch, and give Chill either `delegates_to:"Spellcasting"` + `spell:"Hold Monster"` (resolve via the live spell-cast seam at DC 19 WIS) or `advisory:"hold_monster"` (MA-0058 adjudication-record popup + log) — plus a row-level "can't take again until start of next turn" latch consumer (none exists app-wide; MA-0125 note).
2. **Economy:** header row `uses` absent → counter/gate/one-per-other-turn latch/regain dormant for the whole section (MA-0124 recipe).
3. Chill-as-cast should also honor the Spellcasting note (no Material components, concentration; app spells.json records Hold Monster concentration Up to 1 minute — GM-enforced advisory residual CLA-325).

## Notes
- Registry: no `Adult Silver Dragon` entry in `docs/test-monster-registry.json` — fresh join this probe (placed hp 216 / init 14); orchestrator re-entry needed.
- Byte-shape identical to MA-0114 (Adult Green Mind Invasion) and MA-0125 (Adult Red Commanding Presence) inert prose-only legendary fingerprint.
- Data typo noted (out of scope): lair_actions[1] "1dlO" (letter O) cold damage token — same family as MA-0045 dracolich drift.

## Cleanup
- Page closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. Only `test-campaign` touched; no manifest `verified` edits.
