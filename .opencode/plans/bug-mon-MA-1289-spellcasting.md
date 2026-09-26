# MA-1289 — Performer Legend "Spellcasting" — FAIL(a)/DATA (MA-0421/0524/MA-1230/1241/1261 markup family)

Date: 2026-09-26 · Campaign: test-campaign (header-verified) · Manifest row NOT edited.
Rig: EB exact-row native cb.click() Performer Legend 1 (CR10, HP162, AC20) + Bandit 1 (AC12) → Join Encounter → card via `img.avatar-image[alt="Performer Legend 1"]`. Join census: only Bandit+Performer Legend checked (§152 filter swap survives); post-join cs = Performer Legend 1 npc AC20 + Bandit 1 npc AC12 + 14 §237 generic PC placeholders.

## Disk row (public/data/monsters.json, performer-legend actions[3], "Spellcasting")
```json
{
  "name": "Spellcasting",
  "description": "The performer casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):<br><strong>At Will:</strong> Mage Hand, Minor Illusion, Prestidigitation<br><strong>1/Day Each:</strong> Major Image, Project Image",
  "attack_bonus": 0, "save_dc": 17, "save_type": "Charisma",
  "save_effect": "", "range": "", "reach": "", "recharge": ""
}
```
- `<strong>` wraps ONLY the tier headers ("At Will:", "1/Day Each:") — **all 5 spell names plain text**.
- Numeric pair PRESENT: `save_dc:17` + `save_type:"Charisma"` (§89: numeric pair ≠ chips).
- `attack_bonus:0` junk → §490/§444 fake clickable "+0" rides the row — **unpressed**.

## Code evidence (family, line numbers verified MA-1230/1241/1261 same-day basis)
- `src/components/encounter/MonsterCardHelpers.js:356-367` — `extractSpellNamesFromSpellcasting` requires name-level `<strong>`/`<em>`; headers end ":" → excluded (:363) → returns **[]**.
- `src/components/encounter/MonsterAction.jsx:83-84` — `SpellCastLinks`: `names.length===0 → null` → zero `.mc-dice-link-spell` chips.
- `src/components/encounter/MonsterAction.jsx:350-351` — spellcasting-row XOR fork: row-level `save_dc:17` NEVER renders an ActionSaveRoll chip (§118/MA-0532).

## Live row census (row-scoped DOM)
- Row HTML fingerprint (`.mc-action`): `<strong>Spellcasting.</strong> <span class="mc-dice-link" role="button">+0</span><span>…(spell save DC 17):<br><strong>At Will:</strong> Mage Hand, Minor Illusion, Prestidigitation<br><strong>1/Day Each:</strong> Major Image, Project Image</span><em> ()</em>`
- `.mc-dice-link-spell` census: **0** (row, whole card, and overlay) — authored list Mage Hand / Minor Illusion / Prestidigitation / Major Image / Project Image → **5/5 missing** = §421/§524 FAIL family.
- Sole in-row link: `{"t":"+0","cls":"mc-dice-link"}` (junk, unpressed). Cosmetic `<em> ()</em>` tail present. Headers end ":" → no §161 fake-chip decoys.
- "DC 17" affordance audit: only clickable DC-17 element card-wide = `mc-dice-link-save-clickable` "DC 17 **Wisdom**" belonging to **Majestic Song** (MA-1288, PASS). Spellcasting row: "spell save DC 17" is plain prose, **zero affordance**; row save_type Charisma never surfaces (XOR fork).

## Probe
- Real-pointer center-click on prose "Major Image" (Range rect, mouse.down/up): log delta **0** (3→3, baseline = join noise: encounter + 2× Initiative), popups **0**, console errors **0**, no `ability_use`. Cast legs (At-Will trio, 1/Day×2 `monsterSpellUses` gate §57) **UNTESTABLE-INERT** — zero spends.

## spells.json census (all resolvable → fix is markup-only)
| Spell | 5e | 2024 | Save |
|---|---|---|---|
| Mage Hand | L0 | L0 | none |
| Minor Illusion | L0 | L0 | none |
| Prestidigitation | L0 | L0 | none |
| Major Image | L3 | L3 | none |
| Project Image | L7 | L7 | none |

All save:none → row DC 17/Charisma is caster-channel label only (§894); chips post-fix = cast-affordance (utility), no save-roll expected.

## Verdict
FAIL(a)/DATA — markup-dead spellcasting block, exact MA-1230/1241/1261 fingerprint (headers-only `<strong>`, numeric pair present, zero spell chips, "+0" junk rider).

## Fix (DATA-only, zero code — MA-0611 djinni byte-shape, same as family fix)
Wrap EACH spell name `<strong>` (tier headers already trailing-":" marked = parse-clean-excluded):
```
The performer casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):<br><strong>At Will:</strong> <strong>Mage Hand</strong>, <strong>Minor Illusion</strong>, <strong>Prestidigitation</strong><br><strong>1/Day Each:</strong> <strong>Major Image</strong>, <strong>Project Image</strong>
```
Post-fix: 1/Day counter + `monsterSpellUses` gate binds Major Image/Project Image (§57); At-Will trio ungated; "+0" removal separate `attack_bonus:0→null` axis (§490) — batch at fix-owner discretion.

## Cleanup
Overlay flushed (× → Escape), temp row id removed, Admin clear-log + clear-change-data LAST via direct POST (localhost): log **0**, change-data **{}** confirmed.

## Registry / manifest
- Manifest `docs/monster-actions-manifest.json` untouched (edit forbidden).
- Registry "Performer Legend" merged: MA-1286/1287/1288 ledgers preserved, MA-1289 FAIL(a)/DATA added, verdict → MIXED.
