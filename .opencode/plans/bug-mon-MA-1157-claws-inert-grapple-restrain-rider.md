# BUG MA-1157 — Mezzoloth Claws: INERT GRAPPLED+RESTRAINED RIDER (FAIL(a)/DATA)

**Date:** 2026-09-25 · **Campaign:** test-campaign · **Row:** mezzoloth actions[1] "Claws"
**Manifest:** MA-1157 (`conditions:["grappled","restrained"]`, actionType "attack+save", attackBonus 7, saveDc 0) → **FAIL(a)**.
**Class:** MA-1153 Merrow Bite / MA-1141 / MA-1149 twin — auto-condition-on-hit rider, no save. §449 transport=hit_conditions/hit_target_effect/hit_condition_roll only, MonsterCardHelpers.js:648 → handlePlainDamage.js:543. Marilith Constrict (MA-1139) is the SAVE-based twin — different seam, not applicable.

## Expected (row quote)
> "Melee Attack Roll: +7, reach 5 ft. Hit: 9 (2d4 + 4) Slashing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from two of four claws, and it has the Restrained condition until the grapple ends."

Claws hit on a Large-or-smaller victim (Bandit 1 Medium — RAW-owed) must grant **Grappled + Restrained** (escape DC 14) alongside Slashing damage.

## Actual
Damage axis lands byte-exact; **Grappled+Restrained rider NEVER lands** — zero grant on hit, disk authors no structured grant field.

## Disk truth (`public/data/monsters.json` mezzoloth.actions[1]) — byte-checked 2026-09-25
`attack_bonus:7 ✓ · damage_dice_primary:"2d4 + 4" ✓ · damage_type_primary:"Slashing" ✓ · reach:"5 ft." ✓ · save_dc:0 · save_type:"" · save_effect:""` · description byte-matches row prose (HTML `<strong>Grappled</strong>` / `<strong>Restrained</strong>` wrap, "(escape DC 14)" present).
Row action keys are ONLY: name, description, attack_bonus, save_dc, save_type, save_effect, range, reach, recharge, damage_dice_primary, damage_type_primary.
**`hit_conditions` ABSENT · `escape_dc` ABSENT · `hit_target_effect` ABSENT · `hit_condition_roll` ABSENT · `target_prerequisite` ABSENT** (manifest `conditions:["grappled","restrained"]` is prose-derived only — zero attack-path consumers, §449).

## Transport / registry analysis
- Grant transport = `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:648-661) reads `action.hit_conditions` (+`escape_dc`, `hit_target_effect`, `hit_condition_roll`) ONLY → clause collapses to null (conditions.length===0 && !targetEffect && !conditionRoll) → `maybeApplyHitClause` early-return. **Consumer LIVE but UNARMED.**
- Size gate "Large or smaller": standard-condition grant applies to any humanoid victim; Bandit 1 (cs size "Medium or Small") is RAW-owed both conditions. No `target_prerequisite` needed (not a pre-existing-condition gate).
- te registry (`targetEffectDefinitions.js`): grappled/restrained ride the standard-condition channel (`hit_conditions`), not te — no te key required.
- Precedent, same-shape disk rows (grapple prose + authored keys): **Grick Tentacles** (`hit_conditions:['grappled'] + escape_dc:12`, MA-0930 fix), **Giant Crab Claw** (`hit_conditions`, MA-0799). Marilith Constrict MA-1139 = save_dc seam (`save_effect`), NOT this twin.

## Live E2E (Playwright, test-campaign, 2026-09-25)
Rig: header verified `test-campaign`; EB join 1× Mezzoloth 1 (AC18 HP75) + 1× Bandit 1 (AC12 HP11, Medium-or-Small, resistances [] clean Slashing victim) — fresh join, no prior instances in initiative; target armed on Mezzoloth 1 initiative-row Target select (`cs.creatures['Mezzoloth 1'].targetName:"Bandit 1"` server-verified pre-fire §452).
- Chip audit: Claws row = exactly ONE `span.mc-dice-link` "+7"; DC chips **0** ✓ (row text "Melee Attack Roll: +7 …" carries prose +7 only).
- **Press 1 = honest MISS:** popup+log `roll attack` name "Claws" rolls[3] +7 → 10 vs AC12 `hit:false`; Bandit 11→11 zero-delta ✓ (§442).
- **Press 2 = HIT:** popup total 18, d20Rolls[11,12]→11, `hit:true isCrit:false` (§32: no crit; popup outside-click re-roll quirk consumed once — natural 12 offered, 11 retained, still ≥5 vs AC12).
- `roll damage` name "Claws" **formula:"2d4 + 4"** rolls[1,2] modifier 4 total 7 **damageType:"Slashing"** — byte-exact dice string ✓.
- `hp_change` Bandit 1 **delta −7, currentHp 4** (11→4): **|hpΔ| == finalDamage 7 ✓** (§442 log-delta ledger; cs GET combatSummary currentHp:4).
- **GRAPPLE+RESTRAIN axis: ZERO grant** —
  - Bandit 1 cs record: keys = name,type,monsterType,size,initiative,targetName,ac,resistances,immunities,vulnerabilities,concentration,maxHp,currentHp,saveBonuses,monsterIndex — **activeConditions / activeConditionMeta / targetEffects keys ABSENT**;
  - whole-log `/grappled|restrained/gi`: **zero** occurrences (8 entries: join, ×2 initiative, ×3 attack, 1 damage, 1 hp_change);
  - whole-change-data `/grappled|restrained/gi`: **zero raw matches** (§457 viewingMonster echo excluded — none even present; card closed at scan);
  - card badges: Bandit 1 opened card shows ONLY "Allies (1)"; zero grappled/restrained badges on card or initiative row;
  - escape_dc stamp: N/A — no grant to stamp.

## Likely Location & Fix (`public/data/monsters.json` mezzoloth.actions[1])
Add two fields after `damage_type_primary` (MA-0930 Grick byte-shape):
**`"hit_conditions": ["grappled", "restrained"]`** and **`"escape_dc": 14`** — the seam supports both (buildHitConditionClause:656 reads `escape_dc` onto the clause; MA-0930 precedent authors `escape_dc:12` alongside `hit_conditions:['grappled']`). Consumer live: grants stamp `activeConditions` + `activeConditionMeta.{grappled,restrained}.source:"Mezzoloth 1"` + condition-applied log via handlePlainDamage.js:543+. RAW nuance "from two of four claws" / "until the grapple ends" = flavour; escape DC 14 is the mechanical release, carried by escape_dc.

## Verdict
**FAIL(a)/DATA** — numeric axis byte-exact (one "+7" chip, zero DC chips, "2d4 + 4" Slashing, honest HIT, |hpΔ|==fd) but the row's core Grappled+Restrained clause never applies: grant fields unauthored + manifest `conditions` unconsumed (§449 codified; MA-1141/MA-1153 twin family). DATA fix, two fields.

## Notes
- Popup outside-click re-roll quirk: clicking the ATTACK popup body (not `button.dice-roll-reroll-btn`) re-rolls the d20 and stacks popups; "Done" commits + opens damage popup; stacked miss popups need one dismiss each (§448 adjacent).
- §477 cosmetic: Claws row carries trailing empty "()" range artifact.
- Cleanup: Admin cleared change-data + campaign log post-verdict, post-GET empty proof in session transcript.
