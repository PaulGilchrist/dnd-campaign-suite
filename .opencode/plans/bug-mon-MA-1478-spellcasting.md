# BUG MA-1478 — Solar Spellcasting: zero spell chips (MA-0421 plain-text fingerprint)

**Verdict: FAIL(b)/DATA** — row renders ZERO spell affordances; no cast path, no gate, no DC surface.

## Row
- `solar | actions | 3` — "Spellcasting", save_dc 25 Charisma (disk `public/data/monsters.json` solar actions[3]).
- Description prose (plain text): "…At Will: Detect Evil and Good; 1/Day Each: Commune, Control Weather, Dispel Evil and Good, Resurrection"

## Fingerprint (§57 / §89 MA-0421 / §118 MA-0524/0532)
- `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:356-367) extracts ONLY `<strong>`/`<em>`-wrapped names; plain-text spell names never extracted → SpellCastLinks null → zero `.mc-dice-link-spell` chips.
- Row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll (§118/MA-0532): the numeric `save_dc:25` never renders a DC chip on this row — even the DC surface is unreachable.
- `extractSpellcastingSpellUses` binds "N/Day" tiers only to MARKED names (§144) → the "1/Day Each:" gate is unbound (no `monsterSpellUses` consumer reachable).

## Live proof (test-campaign, :5173, 2026-09-27)
- EB re-join: Solar 1 cs idx0, hp297, init 39, round 1, active Solar 1 (PC party on board; targets moot — spells self/ritual).
- Card open (initiative avatar click). Spellcasting row innerHTML: `<strong>Spellcasting.</strong> <span>The solar casts … Resurrection</span>` — spell names inside a plain `<span>`, zero markup.
- Whole-card `.mc-dice-link-spell` enumeration: `[]` (0 chips). Row interactive-element scan (`a, button, .mc-dice-link, [role=button]`): `[]`.
- Forced mouse click at row center: log delta ZERO (log stayed 2 join-noise entries: encounter + roll). Zero `ability_use`, zero cast, zero `automation blocked`, zero popup.
- change-data: `Solar 1` keys `[]`; no `monsterSpellUses` key anywhere.
- Sibling-row control: Flying Sword "+15" chip + Slaying Bow "DC 21 Dexterity" save chip render fine → renderer alive; defect isolated to Spellcasting row markup.

## Untestable-by-construction (recorded honestly)
- At-Will Detect Evil and Good fire + ungated re-fire (§57): no chip to click.
- 1/Day Commune first fire + exhausted refusal: no chip, no uses key, gate unreachable.
- DC 25 CHA save stamp: row-level DC never renders on Spellcasting rows (§118) — N/A.

## Fix (DATA, MA-0421/0611/0576/0619 byte-shape template)
Wrap each spell name in `<strong>` (or `<em>`) inside the row description:
`… At Will: <strong>Detect Evil and Good</strong>; 1/Day Each: <strong>Commune</strong>, <strong>Control Weather</strong>, <strong>Dispel Evil and Good</strong>, <strong>Resurrection</strong>`
- Row already carries numeric `save_dc:25` + `save_type:"Charisma"` (§167 pair satisfied).
- Strip decoy emphasis (§161) — this row has none.
- Tier header "1/Day Each:" parses once names are marked (MA-0276 qualifier rule respected).
- Tier header "1/Day Each:" parses once names are marked; 1/Day uses then ride `monsterSpellUses` + `automation blocked` refusals (§57); At-Will ungated by design; re-arm is GM-side (§70 residual).

## Evidence
- Screenshot: `.playwright-mcp/ma1478-spellcasting-zero-chips.png`
- Registry: docs/test-monster-registry.json Solar (initiative admin-cleared after this block)
