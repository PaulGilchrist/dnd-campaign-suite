# MA-1230 — Night Hag "Spellcasting" — FAIL(a) / DATA (MA-0421/0524 markup family)

**Date:** 2026-09-25 · **Campaign:** test-campaign (header-verified) · **Rig:** EB join Night Hag 1 (cs idx0, HP112 AC17) + Bandit 1 (AC12, clean victim). Card via `img.avatar-image[alt="Night Hag 1"]`.

## Verdict: FAIL — zero spell chips (spell names unmarked-up) → whole row affordance-dead

## Disk row (public/data/monsters.json, night-hag actions, "Spellcasting")
```json
{
  "name": "Spellcasting",
  "description": "The hag casts one of the following spells, ... (spell save DC 14):<br><strong>At Will:</strong> Detect Magic, Etherealness, Magic Missile (level 4 version)<br><strong>2/Day Each:</strong> Phantasmal Killer, Plane Shift (self only)",
  "attack_bonus": 0, "save_dc": 14, "save_type": "Intelligence",
  "save_effect": "Varies by spell cast. Spell save DC 14.", "range": "", "reach": "", "recharge": ""
}
```
- `<strong>` wraps ONLY the tier headers ("At Will:", "2/Day Each:") — **all five spell names are plain text**.
- Numeric `save_dc:14` + `save_type:"Intelligence"` pair IS present (§89 numeric gate satisfied) — the sole defect axis is spell-name markup.

## Code evidence (grep)
- `src/components/encounter/MonsterCardHelpers.js:356-367` — `extractSpellNamesFromSpellcasting`: regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`, skips names ending `":"` (:363). On this row the only matches are the two headers → **returns []**.
- `src/components/encounter/MonsterAction.jsx:83-84` — `SpellCastLinks`: `if (names.length === 0) return null` → zero `.mc-dice-link-spell` chips.
- `src/components/encounter/MonsterAction.jsx:350-351` — row name `/^spellcasting$/i` → SpellCastLinks XOR fork; row-level `save_dc:14` NEVER renders an ActionSaveRoll chip here (§118 MA-0532, code-confirmed).
- `src/components/encounter/MonsterCardHelpers.js:395-410` — `extractSpellcastingSpellUses`: "2/Day Each:" parses (limit=2) but binds only MARKED names → `{}`; 2/Day gate has nothing to gate (uses gate inert-by-absence, not independently defective).
- `src/components/encounter/MonsterAction.jsx:408` + disk `attack_bonus:0` → sole rendered chip is the bogus clickable "+0" (§444/§490 family) — **unpressed**.

## Live evidence
1. **Chip census (row-scoped DOM):** `.mc-dice-link-spell` count = **0** (authored list = Detect Magic, Etherealness, Magic Missile, Phantasmal Killer, Plane Shift → 5/5 missing = §421/§524 FAIL family). Only chip in row: `{"text":"+0","cls":"mc-dice-link"}`.
2. **Zero-affordance click:** real-pointer click on prose "Phantasmal Killer" → log delta 0 (3 join-noise entries before/after: encounter + 2× Initiative), popups 0, no `ability_use`, no console junk (§161 clean — headers end ":" so even fake-chip decoys absent).
3. Cast legs (Magic Missile lvl-4 ledger, Phantasmal Killer DC leg, 2/Day x2 gate, Plane Shift refusal) **UNTESTABLE-INERT** — no chips to press; no spends occurred.

## spells.json (all 5 exist — names resolvable, fix is markup-only)
| Spell | Level | Save | Damage authored |
|---|---|---|---|
| Detect Magic | 1 | none | — (utility, concentration) |
| Etherealness | 7 | none | — (self) |
| Magic Missile | 1 | none | `damage_at_slot_level` "1d4 + 1" per level (Force) — NO dart-count field; "level 4 version" (5 darts RAW) unexpressible in current schema (would ride per-slot "1d4 + 1" single-dart = under-dealt; NOTE for fix) |
| Phantasmal Killer | 4 | **WIS** dc_success:"none" | 4d10 Psychic at lvl 4 (spell-side WIS; row INT 14 is caster-channel label — §894 row save_type = casting ability, not target save) |
| Plane Shift | 7 | CHA (dc_success:"none") | `attack_type:"melee"`; no row `spell_attack_bonus` → djinni §179 honest-refusal-pre-spend expected if it had a chip |

## Fix (DATA, one-axis, djinni MA-0611 byte-shape)
Wrap EACH spell name in `<strong>` in the description (headers already trailing-":" marked = correctly excluded chips):
`... <strong>At Will:</strong> <strong>Detect Magic</strong>, <strong>Etherealness</strong>, <strong>Magic Missile</strong> (level 4 version)<br><strong>2/Day Each:</strong> <strong>Phantasmal Killer</strong>, <strong>Plane Shift</strong> (self only)`
Row already carries `save_dc:14`+`save_type` pair (§167 requirement pre-met). Post-fix the 2/Day chip counter + `monsterSpellUses` gate binds Phantasmal Killer/Plane Shift (§57); At-Will ungated by design. Magic Missile lvl-4 dart count stays a schema gap — record advisory at fix-time (no multi-dart field consumed app-wide).

## Registry / manifest
- Manifest untouched (subagent forbidden). Registry Night Hag entry merged with MA-1230 FAIL ledger, MA-1229 notes preserved.
