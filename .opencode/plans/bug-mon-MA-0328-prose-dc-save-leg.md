# BUG MA-0328 — Azer Pyromancer Spellcasting: prose-only "spell save DC 15", save-leg dead (MA-0237/MA-0318 class)

**Verdict: FAIL** (DC Unknown dead save-leg — MA-0237 class confirmed live)

## Row
- id MA-0328 | monster Azer Pyromancer (`azer-pyromancer`) | actionIndex 2 | Spellcasting | spellcasting
- Campaign: test-campaign ONLY (header verified "test-campaign" post-select; localhost:5173 throughout)

## Expected (per authored row)
> "The azer casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 15): At Will: Elementalism, Mage Hand. 1/Day: Fireball."

Prose "spell save DC 15" should resolve to enforced DC 15 on Fireball (DEX, half on success; fail ⇒ full lv3 8d6 Fire).

## Actual (captured live, session 2026-09-17)
Disk truth (`public/data/monsters.json` actions[2]): keys `name`, `description` ONLY — **no numeric `save_dc`, no `save_type`**. spells.json Fireball dc = `{"dc_type":"DEX","dc_success":"half"}` — **no numeric dc either** (both disk sources checked per MA-0317 recipe). Prose-only DC.

Fireball cast (target armed: ElderPaladin AC19, no fire resist/immunity):
1. Popup rendered: **"DC Unknown — no success or failure"** (snapshot ref f8e9034).
2. Log roll entry (ElderPaladin, name "Fireball", rollType save, saveType DEX, rolls [12], total 12): **`saveResult: null`**, `dcSuccess:"half"`, no saveDc — **no damage roll entry at all** (8d6 Fire abandoned despite a 12-vs-15 fail).
3. Uses spent anyway: `monsterSpellUses {"Fireball":1}`; label flipped "(1/Day · 1 left)" → "(1/Day · 0 left)".
4. Re-click refusal LIVE: "automation blocked | Fireball refused. Uses reset at a long rest" log; zero further rolls, uses unchanged.

Working sub-parts (partial credit, not PASS-worthy):
- Links: 3/3 rendered — Elementalism, Mage Hand (At Will) + Fireball with "(1/Day · 1 left)" tier label.
- 1/Day gate: spend + refusal exact.
- At-Will: Elementalism resolved via 2024 spells.json fallback (dc None, absent from 5e — zero console "not found" errors; MA-0087 no-dc advisory path), Mage Hand advisory; both logged `ability_use` "Spell effect is recorded; GM-enforced for monsters."; uses counter untouched ({Fireball:1} only).

## Likely Location (grep-evidenced)
Code chain reads structured fields only; prose never parsed:
- `src/components/encounter/MonsterCardModal.jsx:851` — buildAbilitySaveRollContext → `saveDc: action.save_dc` (undefined here)
- `src/components/encounter/MonsterCardModal.jsx:222` — executeBlockSaveRoll: no prose "spell save DC N" parse
- `src/components/encounter/MonsterCardModal.jsx:778` — executeMonsterSaveSpellCast: saveType from spells.json (DEX), DC only via action.save_dc
- `src/components/encounter/MonsterCardModal.jsx:1247` — handleSpellCast → spellHasDamage(Fireball) true → save path above
- `src/components/char-sheet/DiceRollResult.jsx:348` — showDcUnknown = rollType 'save' && saveDc == null

Sibling precedents: MA-0318 Archpriest identical prose-DC FAIL; MA-0313 Archmage PASS (row authors `save_dc: 17, save_type: "Intelligence"`); MA-0237 Ancient Red same class.

## Fix (data authoring — NOT applied, data edits forbidden this session)
Author on `public/data/monsters.json` azer-pyromancer actions[2]:
```json
"save_dc": 15,
"save_type": "Wisdom"
```
per MA-0237/MA-0318 sibling fix pattern.

## Cleanup
Admin native confirms (both dialogs named "test-campaign"): Clear Change Data + Clear Campaign Log. Curl-verified: change-data `{}`, log `[]`. No data/manifest/registry edits; no git mutating commands.

## Injection note
Playwright code-echo wrappers in tool outputs are expected tool format; no off-localhost URLs followed; all interaction on localhost:5173 test-campaign.
