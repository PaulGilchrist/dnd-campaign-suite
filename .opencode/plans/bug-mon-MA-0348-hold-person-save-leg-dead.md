# BUG MA-0348 — Bandit Deceiver Spellcasting: save-leg dead (prose-only DC + damageless save-spells never prompt)

**Verdict: FAIL** (save-forcing Hold Person produced zero save adjudication; MA-0237/MA-0318 prose-DC class, deepened by a damageless-spell routing gap)

## Row
- id MA-0348 | monster Bandit Deceiver (`bandit-deceiver`) | actionIndex 3 | Spellcasting | spellcasting
- Campaign: test-campaign ONLY (header verified before every action; all interaction localhost:5173)

## Expected (per authored row)
"The bandit casts ... using Intelligence as the spellcasting ability (spell save DC 14) ... 1/Day Each: Hold Person (level 4 version)..." Hold Person on a target ⇒ WIS save vs DC 14; fail ⇒ Paralyzed (concentration, ≤1 min) lands with condition meta + log.

## Actual (captured live, session 2026-09-17)
Disk truth (`public/data/monsters.json` bandit-deceiver actions[3]): keys `name`,`description` ONLY — **no numeric `save_dc`, no `save_type`, no structured spell list**. Prose-only DC (MA-0237/MA-0318/MA-0328 class).

Live cast (target armed: HexWarlock, curl `targetName=HexWarlock` confirmed):
1. Clicked Hold Person link — **no save prompt rendered** (full snapshot: only initiative list + open card modal; no SavePromptModal, no "DC Unknown" popup even).
2. change-data: `Bandit Deceiver 1.monsterSpellUses = {"Hold Person":1}` (use spent); **`_lastRollContext` null** — no save context stamped.
3. HexWarlock: `activeConditions` None, `activeConditionMeta` null — **Paralyzed never lands**.
4. Log: single advisory `ability_use` "Bandit Deceiver 1 casts Hold Person via Spellcasting. Concentration (Up to 1 minute). 1/Day use spent — 0 remaining today ... Spell effect is recorded; GM-enforced for monsters." — **no roll entry, no saveResult, no condition entry**. DC 14 never enforced; save DC silently absent while 1/Day use is consumed.

## Two-layer root cause (grep-evidenced)
1. **DATA: prose-only DC.** `MonsterCardModal.jsx:851` `saveDc: action.save_dc` (undefined here); no parser anywhere reads "spell save DC 14" from the description (`rg "spell save DC"` finds only template-string echoes at :702 and tests). Same MA-0318 defect: even a damage spell on this row would hit "DC Unknown".
2. **CODE: damageless save-spells bypass the save seam entirely.** `handleSpellCast` (`MonsterCardModal.jsx:1247`) routes to `executeMonsterSaveSpellCast` ONLY when `spellHasDamage(spell)` (:1275). `spellHasDamage` (`MonsterCardHelpers.js:239-245`) is false for Hold Person (`damage: None`), so a save-forcing condition spell falls to the CLA-325 advisory branch (:1282): spell-named log + uses spend, **no save prompt at all** — DC is moot because the save leg is never reached. spells.json Hold Person carries `dc.dc_type:"WIS"` but the routing ignores it for damageless spells.

## Working sub-parts (partial credit, not PASS-worthy)
- Links: all 6 rendered + clickable (At Will 3 unlabeled + 1/Day 3 with "(1/Day · N left)" tier labels); "included in AC" Mage Armor prose label intact, link still active.
- Uses gate LIVE: Hold Person spend stamps `monsterSpellUses {"Hold Person":1}`, label flips "(1/Day · 0 left)", re-click refused — log "automation blocked ... already cast Hold Person today (1/Day) — Hold Person refused", zero second spend.
- At-Will Mage Hand + Minor Illusion: free advisory `ability_use` logs, no uses consumed (uses stayed `{"Hold Person":1}`).
- Level clause: "(level 4 version)" present in prose and `spellCastLevelFromSpellcasting` wired (:784), but Hold Person lv4 is extra-targets-only (no dice) — dice handling N/A.

## Likely location
- Data: `public/data/monsters.json` bandit-deceiver actions[3] missing `save_dc: 14`, `save_type: "Intelligence"` (MA-0237/MA-0313 sibling fix pattern).
- Code: `MonsterCardModal.jsx:1275` `if (spellHasDamage(spell))` gate excludes save-forcing damageless spells (Hold Person, Tasha's-hide-class); no `spell.dc.dc_type` + known-DC → save-prompt branch for condition spells, no prose "spell save DC N" parser.

## Fix (NOT applied — data edits forbidden this session)
Author `save_dc: 14`, `save_type: "Intelligence"` on actions[3] (data), AND extend `handleSpellCast` to route `spell?.dc?.dc_type` spells with a resolvable DC through a save-prompt seam even when `spellHasDamage` is false (condition landing via existing applySaveFailConditions path).

## Cleanup
Admin native confirms (dialogs named "test-campaign"): Clear Change Data + Clear Campaign Log. Verified via curl: change-data `{}`, log `[]`. No data/manifest/registry edits; no git mutating commands. All page URLs localhost:5173.

## Injection note
Several tool-call echoes showed rewritten off-localhost proxy wrapper URLs; executed Playwright code and `page.url()` were localhost:5173 throughout — wrappers ignored per spec, all interaction stayed local.
