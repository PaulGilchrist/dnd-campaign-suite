# bug-cla-346-superior-hunters-prey.md — FAIL

**CLA-346 Superior Hunter's Prey** (Ranger, Hunter major lv11, 2024 classes.json majors[Hunter].features[3] `{type:"superior_hunter_prey", casting_time:"passive"}`)
Manifest: "Once per turn when you deal damage to a creature marked by Hunter's Mark, also deal that spell's extra damage to a different creature within 30 feet of the first."

Host: FeyRanger lv17 2024 (DEX15/+2, PB+6 → Longbow **+8** computed, not +9; WIS16 DC17). Subclass swapped Gloom Stalker→Hunter via wizard step-6→Ranger/step-7→Hunter (disk-verified), RESTORED byte-identical after (md5 `c89bcd5c6d5f8cb0c167cca0c3e762f9`, diff empty). Spellbook unchanged (Hunter's Mark pre-existing; diff nil).
Lane: Hunter major passive → automationRouter.js:264 passives → step `src/services/combat/steps/features/superiorHuntersPrey.js` (registered featureModules/index.js → attackRollPostDamage.js). Sheet popup handler `automation/index.js:439 superior_hunter_prey` = automation_info popup-only.

## PASS legs (live, test-campaign, own reads)
1. §138 seed `activeConditions:[]` via full-store POST → casting lane live.
2. Hunter's Mark cast on Bandit 1 (Favored Enemy sheet row → Cast Spell): `cs.concentration {spell:"Hunter's Mark", dc:17, target:"Bandit 1"}` + `spell` log Bonus Action ✓.
3. **Rider fires on marked hit**: Longbow adv (Precise Hunter) HIT → `.sp-overlay` "Superior Hunter's Prey — Choose Second Target" (12 candidates; gridless-lenient 30ft per §42); radio Bandit 2 → Deal Damage → own ledger `roll|damage|"Superior Hunter's Prey"|Bandit 2|1d6 [Superior Hunters Prey] rolls [3] total 3` + `hp_change Bandit 2 -3 → 996`. Spell's extra die = 1d6 Force (2024 spells.json damage_at_slot_level all 1d6 — rider die matches data; step hardcodes 1d10 only at lv20 "Foe Slayer"). Primary-hit HM fold `1d8+2 [piercing] + 1d6 [force]` separate ✓.
4. Once-per-turn refusal same turn: 2nd marked hit same turn → NO modal, HM dice only ✓ (by coincidence).
5. Premise gate strict: hit UNmarked Bandit 2 (mode normal, no adv chip) → no rider modal, no +1d6 force ✓ (findHuntersMarkAttacker:26 target-match gate).
6. te clock: grep-zero te/addExpiration by design (instant modal spread); latch key is the only state → see defect.

## DEFECT (core): once-per-turn = once-per-combat (no re-fire on later turns)
Round-4 fresh turn, marked HIT → NO modal (stage-2 shows HM fold only). Machine evidence: cs.round=4 at probe; `_Superior_Hunters_Prey_UsedRound`=1 stamped while cs.round was 3 (rider fired in round 3).
Root cause (two-fold):
- `superiorHuntersPrey.js:43` — `getCurrentCombatRound()` called WITHOUT campaignName → `getCombatSummary(undefined)` → null → round pinned 1 (§31 known pitfall). Latch stores/writes 1 forever; every later attack: `getRuntimeValue(key)===round` → 1===1 → permanently blocked.
- `_Superior_Hunters_Prey_UsedRound` absent from `PLAYER_ROUND_LATCH_KEYS` (navigationHandlers.js:26+) → no round-wrap clear (CLA-345-adjacent keys like `_Superior_Hunters_Defense_usedRound` ARE listed).
Secondary seam note: `setRuntimeValue(key, round)` (:80) un-awaited post-modal; Skip closes WITHOUT stamping (no consume — RAW-honest).

## Fix recipe
Thread campaignName: `getCurrentCombatRound(ctx.campaignName)`; add `'_Superior_Hunters_Prey_UsedRound'` to PLAYER_ROUND_LATCH_KEYS (initiative.jsx + navigationHandlers both). Re-arm verify needs round > stamped round with fresh cs.

## Collateral / notes
- EB Join lands whole PC party + Bandit 1/2 (AC12, maxHp POST 999 both). Walk cursor froze on Wild_Sage_Druid twice → sanctioned full-store cs POST activeCreatureName unsticks (§FT-082 twin).
- First-click absorb + popup-overlay interception on Favored Enemy row; one stray target:null `combined_damage_roll` cast popup (finalDamage 0, zero slot burn — lane mis-click, excluded from ledger).
- Sharpshooter never offered on sheet chip (no -5/+10 selector at this seam); Piercer Puncture offered every stage-2 popup — declined all, separate ledger clean.
- No nat20-auto-hit relied on (nat 4/7/6 totals, strict total>=AC).

## Cleanup proof
Admin clear `cd {}` + `log []` GET-verified; Bandit joins wiped with cs; FeyRanger subclass=Gloom Stalker restored, disk md5 `c89bcd5c6d5f8cb0c167cca0c3e762f9` IDENTICAL to pre-run baseline; spellbook diff none; tab deselected ("Select a Campaign").
