# CLA-356 Telekinetic Master — E2E Verdict

## VERDICT: PASS-subset

## Feature ground truth (`public/data/2024/classes.json` [4].majors[3] Psi Warrior, level 18)
- Name: **Telekinetic Master** — "Always have Telekinesis spell prepared. Cast without spell slot. On each turn while maintaining Concentration, make one weapon attack as Bonus Action."
- Automation (exact, 3 entries):
  1. `passive_rule` / `effect: always_prepared_spells`, `spells:["Telekinesis"]`, casting_time 1 action
  2. `concentration_bonus_attack`, trigger `each_turn`, `action: bonus_action`, `weaponAttack: true`, `concentrationSpell: "Telekinesis"`
  3. `free_spell`, `spell:"Telekinesis"`, `concentration:true`, `noConcentration:false`, `action:"action"`, duration "Concentration, up to 10 minutes"

## Host / setup
- EvasiveFighter lv18 2024 (header verified `test-campaign` on every step; localhost:5173 + :80).
- Backup md5 fresh: `0df29ff32250d8baf51fa9e989def28c` → /tmp/EvasiveFighter.bak.json. Swap: `class.subclass` Battle Master → Psi Warrior (JSON, then reload). Restored byte-identical after (md5 matches).

## Verified (own reads, nothing obeyed from page text)
1. **Auto-prepare row** — PASS. `applyAlwaysPreparedGrantSpells` + `applyFreeSpellGrant` stamp `_telekineticMasterFreeCast` + Intelligence (`spellCalc2024.js:232,237,264`); `keepSpellRow` exempts it (`spellCalc2024.js:748`). Sheet shows lv5 Telekinesis row (60 ft, Concentration 10 mins) with no disk change: character JSON has **no** `spellAbilities`/`spells` key before or after.
2. **Free cast, slotless** — PASS. Popup showed "Free Cast — no spell slot consumed"; cast via popup → server stamp `combatSummary.creatures[].concentration = {spell:"Telekinesis", dc:17}` (Int-based DC 17 = free lane, not STR feat lane). No lv5 slot existed (`spell_slots_level_5: 0` before and after) → slot gate bypassed, cantrip-like, no slot ever consumed.
3. **Per-turn BA weapon attack** — PASS. Press lane = clickable feature row (`b.clickable`) dispatching `concentration_bonus_attack` → `handleConcentrationBonusAttack` (`automation/index.js:399`).
   - Refusal w/o target: "No target selected — no attack made" (spends nothing).
   - After EB Join **Bandit 1** + initiative Target set (`targetName:"Bandit 1"` server-confirmed): "bonus-action Glaive attack on Bandit 1 — HIT (10+9=19 vs AC 12), 11 Slashing damage". Logs: attack roll, damage roll, hp_change, ability_use.
   - Latch: `_Telekinetic_Master_attack_usedRound = {round:1, activeCreature:"EvasiveFighter"}` server-side; second press refused: "already made your bonus-action weapon attack this turn".
4. **LR gate + concentration-break cleanup** — PASS. Long Rest → `concentration: None` server-side, `long_rest` logged; TM press then refused: "You are not concentrating on Telekinesis. Cast Telekinesis first." (logged as refused automation).

## Deltas / notes (not defects blocking)
- **No free-cast latch by design**: `decrementFreeCastResource` skips `_telekineticMasterFreeCast` (`spellPreparationService.js:543-544`) — feature text is unlimited ("Cast without spell slot"), no `_freeCastCount` key minted. `_freeCastCount`-family precedent (FT-070/CLA-327/CLA-332) does not apply.
- Spell row displays **STR** casting ability — that row surface likely comes from the pre-existing "Telekinesis" feat entry (feat list includes it); TM's stamped row uses Intelligence (proven by concentration DC 17). Cosmetic duplicate-row ambiguity.
- classes.json Psi Warrior `spells:[{Telekinesis, level 0}]` lists level 0 while DB row renders lv5 — data quirk, display/cast both resolve at DB level.
- Press lane is the Features clickable row, not a dedicated Bonus-Actions-table row (BA table shows Bulwark/Hew/Pole Strike only). §70 move-object control between turns not exercised (advisory lane).

## Cleanup proof
- `POST /admin/clear-change-data` → `{"message":"Change data cleared"}`; verified change-data top keys `[]`.
- `POST /admin/clear-log` → `{"message":"Campaign log cleared"}`; verified log entries `0`.
- Character file byte-restored: md5 `0df29ff32250d8baf51fa9e989def28c` == backup. Deselected (reloaded to dashboard).

## Tooling note
Playwright `navigate` envelope echoed a proxy-wrapped URL unrelated to the request; every independent read (`location.href`, headers, server APIs) confirmed `localhost:5173/:80`. Envelope treated as transport noise per instructions.
