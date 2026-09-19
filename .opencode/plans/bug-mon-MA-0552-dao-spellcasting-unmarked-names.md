# MA-0552 — Dao Spellcasting: unmarked spell names → zero chips, DC 16 orphaned (FAIL, inert)

**Row:** MA-0552 · Dao (`monsterIndex: dao`, `actionIndex: 3`) · Spellcasting · saveDc 16 (CHA)
**Verdict:** FAIL — zero affordances; all 10 spells inert; `spell_save_dc:16` orphans through the SpellCastLinks XOR ActionSaveRoll fork.

## Disk (public/data/monsters.json, dao actions[3])

```
name: Spellcasting
spell_save_dc: 16
spellcasting_ability: charisma
description: "The dao casts one of the following spells, requiring no Material
  components and using Charisma as the spellcasting ability (spell save DC 16):\n
  <strong>At Will:</strong> Detect Evil and Good, Detect Magic, Stone Shape\n
  <strong>1/Day Each:</strong> Gaseous Form, Invisibility, Move Earth, Passwall,
  Plane Shift, Tongues, Wall of Stone"
```

**Markup deviation:** the ONLY `<strong>`/`<em>` spans wrap the tier headers `At Will:` and `1/Day Each:`. All ten spell names are PLAIN TEXT — no `<strong>`/`<em>` on any spell name.

**Homebrew check:** grep `public/data/spells.json` — all 10 spells exist as standard 5e entries: detect evil and good, detect magic, stone shape, gaseous form, invisibility, move earth, passwall, plane shift, tongues, wall of stone. Data is RAW-standard; defect is markup only.

## Code fingerprint (twin MA-0524 / MA-0532 / MA-0543 class)

- `MonsterCardHelpers.js:288` `extractSpellNamesFromSpellcasting` matches only `<(?:strong|em)>([^<]+)<\/(?:strong|em)>` and SKIPS colon-ending text (`:295`) → for this description it returns `[]` (headers skipped, plain names never matched).
- `MonsterAction.jsx:193` — row named `Spellcasting` renders `SpellCastLinks` **XOR** `ActionSaveRoll`.
- `MonsterAction.jsx:63` — `spellNames.length === 0` → `SpellCastLinks` returns `null` → zero chips.
- `MonsterAction.jsx:88` — `ActionSaveRoll` (never rendered on Spellcasting rows) requires numeric `action.save_dc`; the row carries only `spell_save_dc` → row-level DC 16 can never render a save affordance even if the fork flipped (MA-0532 confirmed again: `spell_save_dc` alone never reaches `buildAbilitySaveRollContext`).

## Live proof (Playwright, test-campaign, :5173, 2026-09-19)

- Header verified `test-campaign`; EB exact-row join → Dao 1 cs idx 0, 200/200, round 1; combatSummary otherwise empty (prior MA-0551 rig already cleared).
- Card opened via `img[alt="Dao 1"]` avatar click; scoped `.mc-action` whose `<strong>` startsWith `Spellcasting`.
- **Zero-chip audit:** `[role=button]` = 0, `.mc-dice-link` = 0, `<a>` = 0 inside the row. Row innerText renders prose only ("...spell save DC 16): At Will: Detect Evil and Good...").
- **DC orphan proof:** only `.mc-dice-link-save` in the whole card is `DC 16 Dexterity` (Earth Burst actions[2]); no Charisma/Spellcasting DC affordance exists.
- No chip → no cast probe possible; 1/Day uses gate untestable by design (nothing fires; `monsterSpellUses` never engaged).

## Fix (DATA, MA-0421 template)

Wrap EACH spell name in `<strong>` and keep tier headers as-is, archmage/lich byte-shape; also convert `spell_save_dc` → numeric row `save_dc`/`save_type` per MA-0421 requirement (spell_save_dc alone never reaches save context) if a row-level DC affordance is desired — though per-spell routing via spells.json dc fields is the standard path. Strip-tag byte-equality must hold. At-Will tier ungated by design; 1/Day Each rides `extractSpellcastingSpellUses` (`MonsterCardHelpers.js:301`) once names are marked.

## Cleanup

Admin `clear-change-data` POST 200 ("Change data cleared") + hard reload; own-curl combatSummary `creatures: []`; localhost root 200. No manifest/git writes.
