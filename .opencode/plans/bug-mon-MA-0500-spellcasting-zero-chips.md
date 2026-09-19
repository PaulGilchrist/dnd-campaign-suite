# bug-mon-MA-0500-spellcasting-zero-chips

**Row:** MA-0500 — Cloud Giant — Spellcasting — `actions[3]` — monsterIndex `cloud-giant`
**Verdict:** FAIL (b) — MA-0421 DATA twin (markup gap only)
**Date:** 2026-09-18 — verified live in test-campaign, localhost :5173

## Symptoms (live, 2026-09-18)
- Cloud Giant joined via EB (combatSummary idx 0, `Cloud Giant 1`, 200/200 HP).
- Card audit: `.mc-dice-link-spell` count = **0** vs **6 authored spell names**.
- Spellcasting row renders the full prose but every spell name is plain text inside a `<span>` — no clickable affordance for any spell.

## Disk truth (`public/data/monsters.json`, `cloud-giant.actions[3]`)
```
"description": "The giant casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):\n<strong>At Will:</strong> Detect Magic, Fog Cloud, Light\n<strong>1/Day Each:</strong> Control Weather, Gaseous Form, Telekinesis"
"spell_save_dc": 15, "spellcasting_ability": "Charisma",
"save_dc": 15, "save_type": "Charisma"
```
- Tier headers `At Will:` / `1/Day Each:` are `<strong>`-wrapped (render fine).
- Spell names `Detect Magic, Fog Cloud, Light` / `Control Weather, Gaseous Form, Telekinesis` are **plain text** — not `<em>`/`<strong>`-wrapped.

## Diagnosis — MA-0421 class (playbook §57/§89/§122)
Chip parser requires spell names wrapped in `<strong>`/`<em>` AND numeric row `save_dc`/`save_type`. Here the numeric pre-reqs are MET (`save_dc:15`, `save_type:"Charisma"`), so this is the **pure MA-0421 markup gap** — §89 pre-reqs satisfied, `<em>`-wrap is the only missing piece. Confirms MA-0497 pre-evidence live. Identical twin family: MA-0459, MA-0478.

## Fix (DATA, template-proven)
Wrap all 6 names in `<em>` per the archmage/lich byte-shape template (`archmage.actions` Spellcasting: `<em>Detect Magic</em>, …`, headers `<strong>`, `<br>` line breaks — strip-tags byte-equality proves markup-only diff).
1/Day tier (`Control Weather, Gaseous Form, Telekinesis`) additionally relies on `extractSpellcastingSpellUses` binding N/Day only to MARKED names (§120) — unmarked 1/Day names are invisible AND ungated.

## Not defects here
- Prose DC gap (MA-0237): NOT applicable — numeric `save_dc:15` authored.
- MA-0276 header-qualifier parse: untestable — no chips to gate.
