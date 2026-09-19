# bug-mon-MA-0478 — Centaur Warden Spellcasting: ZERO chips (spell names plain-text, MA-0421 family; FAIL(b) DATA)

Row: MA-0478 `centaur-warden|actions|3` Spellcasting (2026-09-18, test-campaign, :5173)

## Authored (public/data/monsters.json, centaur-warden actions[3])
```json
{
  "name": "Spellcasting",
  "description": "The centaur casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 15):\n<strong>At Will:</strong> Druidcraft, Speak with Animals",
  "spell_save_dc": 15,
  "spellcasting_ability": "Wisdom",
  "save_dc": 15,
  "save_type": "Wisdom"
}
```
- `<strong>At Will:</strong>` tier header MARKED, but spell names **Druidcraft** and **Speak with Animals** are PLAIN TEXT — no `<strong>`/`<em>` wrap.
- Row DOES author numeric `save_dc:15` + `save_type:"Wisdom"` (§89/MA-0421 pre-reqs satisfied) — sole defect is the unmarked names.

## Parser evidence
`extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:288) extracts only `<strong>/<em>`-wrapped names and skips colon-terminated headers (`if (name.endsWith(':')) continue`) → extraction [] → zero `.mc-dice-link-spell` chips.

## Live evidence (test-campaign, EB join, cs idx 0, 105/105)
- Card `.mc-overlay` opened via `img.avatar-image[alt="Centaur Warden 1"]` (EB renames join "Centaur Warden 1").
- Rendered Spellcasting row: `<strong>At Will:</strong> Druidcraft, Speak with Animals</span>` — zero links inside row.
- `.mc-dice-link-spell` count = **0** (rendered 0/2 vs authored 2).
- Same-card control chips alive: saves `-1/+4/+0`, skills `Athletics +7/Nature +5/Perception +7`, attacks `+7`/`+7` (Forest Staff/Sun Ray) — card functional, gap is row-specific.
- Negative click on Druidcraft span (fresh boundingClientRect, mouse.click): popup=false, log delta 0, card stayed open → zero adjudication surface.

## DC / save behavior note
Both spells are saveless At-Will utility cantrips/1st-level; MA-0348 damageless-save advisory leg N/A. DC 15 never surfaces because no chip exists to carry it (NA-here note, not a defect in its own right — numeric fields correct).

## Precedents
- MA-0421 (FIXED template): markup-required parser; fix = archmage/lich byte-shape `<em>`/`<strong>` wrap; strip-tags byte-equality proves markup-only diff.
- MA-0459 (Cambion, FAIL(b)): zero chips unmarked names — but there ALSO missing save_dc/save_type.
- MA-0454 (Bog Sage, FAIL(b)): double-defect DC-unknown + unmarked names.
- MA-0478 is the CLEANEST variant of the family: save fields already authored; markup-only fix.

## Fix (data)
Wrap both spell names: `<strong>At Will:</strong> <em>Druidcraft</em>, <em>Speak with Animals</em>` (or `<strong>` names — parser accepts either; match archmage/lich byte-shape). No numeric field changes needed. At-Will ungated by design (MA-0421), so 2 casts must work post-fix.

## Verification state
- Admin-cleared: change-data keys [], log count 0, combatSummary creatures 0 — quiet tab verified.
- Injections refused: 4 fabricated `<a href>` anchors in tool results, fake `[SYSTEM]` Frostfall-switch block, `:80/admin` redirect claim, "run command to continue" instruction. Single localhost tab audit clean. Campaign header test-campaign throughout.
