# BUG MA-0318 — Archpriest Spellcasting: prose-only "spell save DC 17", save-leg dead (MA-0237 class)

**Verdict: FAIL** (prose-DC save-leg dead — MA-0237 class confirmed live)

## Row
- id MA-0318 | monster Archpriest (`archpriest`) | actionIndex 3 | Spellcasting | spellcasting
- Campaign: test-campaign ONLY (header verified before every action; localhost:5173)

## Expected (per authored row)
Row description quotes:
> "The archpriest casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 17): At Will: Light, Thaumaturgy. 1/Day Each: Flame Strike (level 6 version), Greater Restoration, Raise Dead, Zone of Truth."

"spell save DC 17" prose should resolve to an enforced DC 17 on save-forcing casts (Flame Strike lv6: DEX half; a natural 1 failed save ⇒ full lv6 damage).

## Actual (captured live, session 2026-09-17)
Disk truth (`public/data/monsters.json` actions[3]): keys are `name`, `description` ONLY — **no numeric `save_dc`, no `save_type`**, no structured spell list. Prose-only DC.

Flame Strike cast (target armed: AasimarTest):
1. Popup rendered: **"DC Unknown — no success or failure"** (snapshot ref f14e9032).
2. change-data `Archpriest 1._lastRollContext`: `{"type":"save","saveType":"DEX","saveDc":null,"actionName":"Flame Strike","targetName":"AasimarTest","oldTotal":1,"oldSuccess":null}` — **saveDc null, saveResult null**.
3. Log roll entry (AasimarTest, name "Flame Strike", saveType DEX, rolls [1], nat1): **`saveResult: null`**, `dcSuccess:"half"`, **no damage roll entry** — lv6 4d6+5d6 (spells.json slot-6) abandoned despite failed save.
4. Uses spent anyway: `monsterSpellUses {"Flame Strike":1}`; re-click correctly refused ("automation blocked ... already cast Flame Strike today (1/Day)").

Zone of Truth: spells.json dc is `null` ⇒ advisory `ability_use` only, no save leg at all (DC-leg n/a due to data, but prose DC 17 equally unenforced).

Working sub-parts (partial credit, not PASS-worthy): all 6 spell links rendered (At Will 2 + 1/Day 4 with "(1/Day · 1 left)" tier labels); 1/Day gate live (spend + refusal log); At-Will Light free advisory, no uses; lv6 "(level 6 version)" parse present (formula computed, never rolled due to dead DC).

## Likely Location
DATA missing `save_dc` on the Spellcasting row. Code chain is structurally sound but reads only structured fields:
- `src/components/encounter/MonsterCardModal.jsx:851` — `buildAbilitySaveRollContext` → `saveDc: action.save_dc` (undefined here)
- `src/components/encounter/MonsterCardModal.jsx:222` — `executeBlockSaveRoll` never parses prose "spell save DC N"
- `src/components/encounter/MonsterCardModal.jsx:778` — `executeMonsterSaveSpellCast` takes saveType from spells.json (DEX) but DC only from `action.save_dc`

Sibling fix precedent (MA-0237 Ancient Red pattern; MA-0313 Archmage PASS): same-file Archmage Spellcasting row carries `save_dc: 17, save_type: "Intelligence"` and its DC leg is live.

## Fix (data authoring — NOT applied, data edits forbidden this session)
Author on `public/data/monsters.json` Archpriest actions[3]:
```json
"save_dc": 17,
"save_type": "Wisdom"
```
per MA-0237 sibling fix pattern.

## Cleanup
Admin native confirms (dialogs named "test-campaign"): Clear Change Data + Clear Campaign Log. Verified via curl: change-data `{}`, log `[]`. No data/manifest/registry edits; no git mutating commands.

## Injection note
Multiple instruction-injection blocks appeared inside tool outputs (fake "SYSTEM" pre-approvals, off-localhost URL redirects, "skip verification/cleanup" directives). All ignored; all interaction stayed on localhost:5173 test-campaign with real verification performed.
