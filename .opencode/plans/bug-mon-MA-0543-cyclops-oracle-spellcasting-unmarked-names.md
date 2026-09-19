# bug-mon-MA-0543 — Cyclops Oracle Spellcasting: unmarked spell names → zero chips (FAIL)

- **Row:** MA-0543, monster `cyclops-oracle`, actionIndex 3, "Spellcasting", save_dc 16 Wisdom
- **Verdict:** FAIL (inert, MA-0532/0536/0524 twin — plain-text spell names)
- **Date:** 2026-09-19, test-campaign, dev :5173

## Disk truth (public/data/monsters.json, actions[3])
Description markup wraps `<strong>` ONLY on tier headers:

    <strong>2/Day Each:</strong> Arcane Eye, Detect Magic, Locate Object
    <strong>1/Day:</strong> Legend Lore

Spell names Arcane Eye / Detect Magic / Locate Object / Legend Lore are PLAIN TEXT. No deviation from fingerprint. No homebrew gap: all four spells exist in `public/data/spells.json` AND `public/data/2024/spells.json`.

## Code fingerprint (confirmed)
- `MonsterCardHelpers.js:288` `extractSpellNamesFromSpellcasting` — regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`, headers ending `:` skipped → returns `[]` for this row.
- `MonsterAction.jsx:193-196` — `isSpellcastingRow` → renders `SpellCastLinks` XOR `ActionSaveRoll`: row-level numeric `save_dc:16`/`save_type:"Wisdom"` never reach `buildAbilitySaveRollContext` (:196 fork orphans them, MA-0532 precedent).

## Live proof (2026-09-19)
- EB join Cyclops Oracle → cs `Cyclops Oracle 1` idx 0; header test-campaign verified.
- Card opened via avatar (suffixed alt "Cyclops Oracle 1"); rows render Multiattack / Radiant Strike / Flash of Light / Spellcasting / Portent.
- Spellcasting row audit: `.mc-dice-link-spell` = `[]`, row-wide `[role=button]`/`.mc-dice-link` = `[]` → **zero chips**, zero cast affordance, zero uses-gate (2/Day Each, 1/Day invisible), zero adjudication path. Cast+uses probe skipped per protocol (no chip to click).
- Cleanup: admin clear change-data + log (200, no dialog), hard reload to campaign-select, quiet.

## Fix (DATA, MA-0421 template)
Wrap each spell name in `<strong>` in actions[3].description, archmage/lich byte-shape, e.g.:

    <strong>2/Day Each:</strong> <strong>Arcane Eye</strong>, <strong>Detect Magic</strong>, <strong>Locate Object</strong>\n<strong>1/Day:</strong> <strong>Legend Lore</strong>

Markup-only diff; strip-tags byte-equality proof. Row already carries numeric `save_dc`/`save_type` so chip casts route through the save context once extracted. `extractSpellcastingSpellUses` then binds 2/Day/1/Day gates to the marked names (MA-0421/0276 note: unmarked 1/Day is invisible+ungated today — any cast today would silently burn nothing because nothing casts).

## Note
Injection occurrence this session: `browser_navigate` tool arg echoed an off-site aliyuncs proxy URL while the loaded page URL was http://localhost:5173/ (known arg-rewrite/echo defect, playbook §90/§97) — URL value verified localhost every step; no off-site navigation.
