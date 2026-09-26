# MA-1294 — Performer Maestro "Spellcasting" — FAIL(a) (DC-chip lane DEAD + MA-1230/1289 markup family)

**Date:** 2026-09-26 · **Campaign:** test-campaign (nav-header verified) · Manifest row NOT edited.
**Rig:** EB exact-row native cb.click() Bandit 1 (CR 0.125 row, NOT Captain/Crime Lord/Deceiver/Scarlet) + Performer Maestro 1 (CR6) → Join Encounter → card via `img.avatar-image[alt="Performer Maestro 1"]`. Join census: only Bandit+Performer Maestro checked (§152 survives); cs = Maestro 1 npc + Bandit 1 npc + 14 §237 PC placeholders; baseline log = 3 join-noise entries (encounter + 2× initiative) — exact MA-1289 fingerprint.

## Verdict: FAIL(a) — no "DC 15 Charisma" chip exists to press (DC lane structurally unreachable, XOR fork) AND zero spell chips (names unmarked-up)

## Disk row (public/data/monsters.json, performer-maestro actions[3], "Spellcasting")
```json
{
  "name": "Spellcasting",
  "description": "The performer casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):<br><strong>At Will:</strong> Minor Illusion, Prestidigitation<br><strong>1/Day:</strong> Tasha's Hideous Laughter (level 3 version)",
  "attack_bonus": 0, "save_dc": 15, "save_type": "Charisma",
  "save_effect": "", "range": "", "reach": "", "recharge": ""
}
```
- `<strong>` wraps ONLY tier headers ("At Will:", "1/Day:") — all 3 spell names plain text.
- Numeric pair `save_dc:15` + `save_type:"Charisma"` PRESENT — but see fork below: on a row named "Spellcasting" it renders NOTHING clickable.

## Code evidence (read fresh this session)
- `src/components/encounter/MonsterAction.jsx:390` — `isSpellcastingRow = /^spellcasting$/i.test(action.name)` → TRUE.
- `src/components/encounter/MonsterAction.jsx:348-372` — `SpellOrSaveLinks`: FIRST branch `if (isSpellcastingRow) return <SpellCastLinks .../>` — EARLY RETURN. The `Number(action.save_dc) > 0 → <ActionSaveRoll>` branch (the ONLY "DC X <Type>" chip renderer in the row) is **UNREACHABLE** for spellcasting rows (§118 / MA-0532, byte-identical basis MA-1230:22, MA-1289:22).
- There is NO `caster-channel-label` / channel-DC renderer anywhere in `src/` (grep zero) — "§894 caster-channel-label" (MA-0894 note, playbook:326) documents SEMANTICS only ("row save_type = CASTING ability, not target save type"); it has never implied a rendered chip. Disk `save_dc` presence ≠ chip (§89 census rule).
- `MonsterCardHelpers.js extractSpellNamesFromSpellcasting` (headers end ":" → excluded) → names [] → `SpellCastLinks:83-84` `names.length===0 → null` → zero `.mc-dice-link-spell`.
- `attack_bonus:0` → §444/§490 junk clickable "+0" rides the row.

## Live evidence (row-scoped DOM, overlay innerText startsWith "Performer Maestro")
1. **Row HTML fingerprint:** `<strong>Spellcasting.</strong> <span class="mc-dice-link" role="button">+0</span><span>…(spell save DC 15):<br><strong>At Will:</strong> Minor Illusion, Prestidigitation<br><strong>1/Day:</strong> Tasha's Hideous Laughter (level 3 version)</span><em> ()</em>` — cosmetic ` ()` tail (§490 twin).
2. **Chip census:** `.mc-dice-link-spell` = **0** (authored list Minor Illusion / Prestidigitation / Tasha's Hideous Laughter → **3/3 missing**, MA-1230/1289 family). Row save chips `.mc-dice-link-save-clickable` = **0**. Row clickables = `[{"t":"+0","cls":"mc-dice-link"}]` junk — **UNPRESSED**.
3. **"DC 15 Charisma" audit WHOLE overlay:** every `[role=button]/.mc-dice-link` matching /DC 15/i → exactly ONE: `"DC 15 Wisdom"` = **Beguiling Song** (MA-1293, PASS — belongs to a different row). NOT pressed (out of scope; adjudicating MA-1293 lane would pollute). The Spellcasting row's "(spell save DC 15)" + Charisma pair surfaces only as plain prose = zero affordance. **Chip-press target does not exist.**
4. **Zero-affordance probes (real pointer):** click prose "spell save DC 15" span → log delta **0** (3→3), popups **0**, `.sp-modal` absent, no `ability_use`; click prose "Tasha's Hideous Laughter" → log delta **0** (3→3). Console errors **0**. Headers end ":" → no §161 fake-chip decoys.
5. Cast legs (At-Will duo, 1/Day `monsterSpellUses` gate §57, Hideous Laughter lvl-3 WIS leg) **UNTESTABLE-INERT** — zero chips, zero spends.

## spells.json census (MA-1241 canonical-name trap ACTIVE)
| Prose name | 5e spells.json | 2024 spells.json | Save |
|---|---|---|---|
| Minor Illusion | present, L0 | present, L0 | none |
| Prestidigitation | present, L0 | present, L0 | none |
| Tasha's Hideous Laughter | **ABSENT** (index = "Hideous Laughter", L1) | present ("Tasha's Hideous Laughter", L1) | spell-side WIS (RAW; schema `save` field empty both files) |

- "Tasha's Hideous Laughter" resolves ONLY against the 2024 index; a 5e-ruleset card post-markup-fix would chip an unresolvable name (§158). Fix author must verify chip resolution route per ruleset before wrapping.

## Fix
1. **DATA (family, djinni MA-0611 byte-shape):** wrap EACH spell name `<strong>` (headers already trailing-":" = parse-excluded): `<strong>At Will:</strong> <strong>Minor Illusion</strong>, <strong>Prestidigitation</strong><br><strong>1/Day:</strong> <strong>Tasha's Hideous Laughter</strong> (level 3 version)`. Post-fix 1/Day counter + gate binds Hideous Laughter (§57); At-Will duo ungated. Resolve "Tasha's…" vs 5e-index "Hideous Laughter" per row's ruleset (§158/MA-1241). "+0" removal = separate `attack_bonus:0→null` axis (§490).
2. **DC-lane note:** row-level DC chip on spellcasting rows is architecturally suppressed app-wide by the XOR fork (every sibling verified MA-1230/1289/1241/1261 renders none) — this is the FAMILY contract, not a Maestro-specific defect; the 15/Charisma pair is a caster-channel label per §894 semantics. If GM-visible pressable channel DC is ever wanted, that is a CODE change affecting the whole family — not required by RAW for these save-less cantrips.

## Cleanup
Overlay flushed; admin clears LAST via one snippet: log + change-data 200/200; no page listeners added this session (nothing to `page.off`) — verified via API re-GET (pendingSavePrompts never armed — no save lane existed to arm).

## Registry / manifest
- Manifest `docs/monster-actions-manifest.json` untouched (edit forbidden).
- Registry "Performer Maestro" merged: MA-1291/1292/1293 ledgers preserved, MA-1294 FAIL(a) added, verdict → MIXED.
