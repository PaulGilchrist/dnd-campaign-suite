# BUG MA-0860 — Githzerai Zerth "Spellcasting" Phantasmal Killer: 1/Day SPENT, "DC Unknown" zero RAW effect (FAIL(a)/DATA)

**Orchestrator re-adjudication (2026-09-22): FAIL(a)/DATA — supersedes subagent PASS(-subset).**
Fingerprint: consumable resolves to NOTHING yet burns its charge — MA-0765 "effect-absent = FAIL(a)/DATA" family. Strictly worse than the MA-0611 refusal twins (Plane Shift refused WITHOUT spending; PK spent + nothing).

## Row
MA-0860, githzerai-zerth, actions[2] "Spellcasting", spellcasting, Wisdom DC 14.

## Disk quote — public/data/monsters.json actions[2] (FULL; row `save_dc` ABSENT)
```json
{"name":"Spellcasting","description":"The githzerai casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability (spell save DC 14):\n<strong>At Will:</strong> <strong>Mage Hand</strong> (the hand is <strong>Invisible</strong>)\n<strong>1/Day Each:</strong> <strong>Phantasmal Killer</strong> (level 6 version), <strong>Plane Shift</strong>, <strong>See Invisibility</strong>","spell_save_dc":14,"spellcasting_ability":"Wisdom"}
```
Row-level `save_dc`/`save_type` ABSENT — DC lives ONLY in prose + cosmetic `spell_save_dc:14`.

## RAW (public/data/spells.json, phantasmal-killer, 5e — 5e-first findMonsterSpell)
level 4, `dc:{dc_type:"WIS", dc_success:"none"}`, `damage_at_slot_level:{"4":"4d10","6":"6d10"}`. lv6 version = WIS save DC 14, on fail Frightened + 6d10 Psychic repeat.

## LIVE PK-leg ledger (test-campaign, EB join exact "Githzerai Zerth 1"+"Bandit 1"; Bandit staged 999/999 + nested `saving_throws:{wis:{modifier:-5}}` §209; armed via own initiative-card select `cs.targetName=Bandit 1`)
1. Click #1: **absorbed §138** — log 8→8, no popup, zero delta.
2. Click #2 (re-armed, native `el.click()`):
   - `ability_use` — "Githzerai Zerth 1 casts Phantasmal Killer via Spellcasting. **1/Day use spent — 0 remaining today** (resets at a long rest, GM-enforced for monsters)." → **charge CONSUMED first** (handleSpellCast MA-0276 spend-before-route, skipLog=false).
   - inline NPC auto-save, **NO .sp-modal** — victim `roll` rolls:[3] **total:-2 bonus:-5 saveType:"WIS"** (§209 stamp folded; popup "d20 3 -5 / -2"); **saveResult:null**.
   - popup verbatim: **"DC Unknown — no success or failure / click to dismiss"**.
   - `change-data['Bandit 1']` keys `[]` — zero Frightened, zero te; **hp 999 held**; whole-ledger `damage` entries 0, `condition applied` entries 0.
   - `cs.lastAttack` UNSTAMPED (`{}` — stampNpcSaveLastAttack gated on `saveDc != null`, saveProcessing.js:292).
   - `monsterSpellUses` final `{"See Invisibility":1,"Phantasmal Killer":1}` — **PK use SPENT for zero RAW effect**.
3. Refire: refused "has already cast Phantasmal Killer today (1/Day) — Phantasmal Killer refused" (`automation blocked`), uses HELD, chip `mc-dice-link-spell-spent` §121 — honest gate, but charge already lost on leg 2.

## Consumer cites (seam fully armed — starved ONLY by null row DC)
- `spellCastLevelFromSpellcasting` MonsterCardHelpers.js:**454** — "(level 6 version)" parses → castLevel 6; `spellDamageFormulaAtLevel` :444 → `damage_at_slot_level["6"]` = **"6d10"** formula ARMED on save context (MA-0087).
- MA-0362 `spellDamageLegFailCondition`/`spellSaveLegOutcome` Helpers:367/:391 — "On a failed save, the target becomes frightened" → `saveConditions:["frightened"]` ARMED (canonical word ✓), `dcSuccess:'none'` from spell dc (MA-0003 spell-attributed routing).
- **The starvation:** `buildAbilitySaveRollContext` MonsterCardModal.jsx:**1329** `saveDc: action.save_dc` → null (no `spell_save_dc` fallback anywhere in the block-save chain, §54/§215); `processSaveRoll` saveProcessing.js:29 → NPC inline; `saveSuccess = saveDc != null ? ... : null` (:267); `applySaveOutcome` damage branch gated `context.autoDamageFormula && saveDc != null` (:539) → skipped; `applyDamagelessSaveConditions` early-return `saveDc == null` → 6d10 never rolls, frightened never grants, lastAttack gate :292 never stamps. Dice-doubling/half-leak vacuous — zero paid.
- "level 6 version" lives OUTSIDE `<strong>` → chip renders clean (MA-0724); §209/§160 force-fail rigs inert at this seam (bonus displayed, never judged — no DC).

## Contrast: MA-0611 refusal twins (better fingerprint)
Plane Shift same session: `attack_type:"melee"` + no row `spell_attack_bonus` → validated **BEFORE spend** → popup "Spell Cast Refused … Nothing spent, no roll." + `automation blocked` + console ERROR :1450, **counter HELD, no uses key**. PK validates nothing, spends, then dead-ends at DC — consumable destroyed with zero adjudication.

## Fix (one-field DATA pair, byte-shape MA-0237/0318/0328/0362 + MA-0724/0739 documented pattern)
Author on actions[2]: `"save_dc":14, "save_type":"Wisdom"`. Seam already live: castLevel-6 6d10 + WIS + dc_success:'none' + frightened grant land via existing saveProcessing legs; At-Will/utility chips on the row are DC-agnostic (§532 SpellCastLinks unaffected); MA-0765-family authored-fix precedent for effect-absent rows.
Acceptance: PK click → inline save vs armed target DC 14 (bonus judged, saveResult stamped, lastAttack stamped); fail → Frightened + 6d10 Psychic; refire refused zero-double-spend; lv6 (not lv4 base) dice in save-damage log.

## Cleanup
Board quiet verified post-session: own-curl `/api/campaigns/test-campaign/log` = `[]`, `/change-data` = `{}` (admin clears 200/200). Registry "Githzerai Zerth" verifiedRow re-stamped FAIL(a)/DATA (DIRECT, JSON.parse-checked). test-campaign ONLY; no manifest edits; no git writes.
