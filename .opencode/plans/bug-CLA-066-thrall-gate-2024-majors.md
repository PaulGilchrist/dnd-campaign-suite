# Bug CLA-066 — Create Thrall (GOO lv14, 2024): none of the Summon Aberration modifications apply

**VERDICT: FAIL** — automation `create_thrall` exists on the sheet but the cast resolves as a vanilla Concentration summon.

## Canonical (public/data/2024/classes.json, Warlock → Great Old One Patron → level 14 "Create Thrall")

> "When you cast Summon Aberration, you can modify it so that it doesn't require Concentration. Duration becomes 1 minute. When summoned, the Aberration has Temporary Hit Points equal to Warlock level + Charisma modifier. First time each turn the Aberration hits a creature under Hex, deals extra Psychic damage equal to the bonus damage of that spell."

Automation metadata in JSON: `[{type:"create_thrall", spell:"Summon Aberration", tempHpExpression:"warlock level + CHA modifier"}, {type:"passive_rule", effect:"create_thrall_temp_hp"}, {type:"attack_rider", trigger:"companion_aberration_hit", damageExpression:"1d6", damageType:"Psychic", oncePerTurn:true}]`

## Test setup (live, localhost GM, test-campaign)
- Host: **HexWarlock**, lv14 2024 Warlock, CHA 17/+3, spell attack +8, DC 16
- Subclass swapped Archfey → **Great Old One Patron** (wizard step 7, disk-verified `class.subclass.name`)
- Summon Aberration auto-granted via GOO expanded list; Hex te seeded on Goblin 1 via GM EffectAdder (`hex_ability_check_disadvantage` live in targetEffects); Skeleton 1 = control
- EffectAdder round-trip done on caster; cast from spellbook row → variant chooser modal → Mind Flayer → Summon

## Observed (runtime + disk evidence)
| Canonical | Expected | Actual (runtime) |
|---|---|---|
| No Concentration | caster not concentrating | **`combatSummary.HexWarlock.concentration = {spell:"Summon Aberration", dc:16}`** |
| Duration 1 minute | expiry ~10 rounds, te `duration:"1_minute"` | **`pendingExpirations: remove_summoned_creatures expiryRounds:600` (1 hour)**; no `summoned` te marker POST at all |
| THP = lv + CHA mod | `tempHp: 17` under summon key | **no tempHp key anywhere; card shows 40/40** |
| Hex rider | "Psychic Strike" row (1d6 Psychic) on summon card | **summon actions = ["Psychic Slam"] only; no rider row** |
| Modify-choice affordance | explicit option on cast | **modal offers only the 3 variant radios ("Choose the form your summoned creature takes") — no Create Thrall modify choice; modification is implicit-by-design then silently absent** |

Log: `summons | HexWarlock casts Summon Aberration (slot level 4), summoning Aberrant Spirit (Mind Flayer) (40/40 HP).` — no THP line, no thrall mention.

## Root cause
`src/services/automation/handlers/spells/summonSpiritHandler.js:213` `hasCreateThrallFor()` scans
`playerStats.class.class_levels[].features` + `playerStats.class.subclass.class_levels[].features` for `automation.type==='create_thrall'`.
Runtime fiber confirms **`playerStats.class.subclass` is `{name:"Great Old One Patron"}` only — no `class_levels`, no `features`** (2024 classes.json stores patron features FLAT under `classes[10].majors[3].features`; `Warlock.subclasses` is `[]`; disk save saves subclass as `{name}` only; `classRules.js` merges via `characterClass.subclasses` which is empty for 2024).
⇒ `hasCreateThrallFor()` → **false** ⇒ `noConcentration=false` (line 324), THP skipped (line 340), Psychic Strike row skipped (line 150), concentration + 1-hour clock applied (lines 352-360).

Meanwhile `automationCollector` DOES flatten the majors correctly: `playerStats.automation.specialActions` contains **`create_thrall:Create Thrall`** and passives contain `create_thrall_temp_hp` + `attack_rider` (fiber-verified). The handler gate reads the wrong data shape — it should check `playerStats.automation.specialActions` (or expand majors into `subclass.class_levels`).

Compounding: `buildSpiritCreature` stamps `createThrall:true` UNCONDITIONALLY (line 181) — a false positive on every summon, masking the failure in cs.

## Secondary findings (same session)
1. **attack_rider trigger `companion_aberration_hit` has NO consumer** anywhere in src/ — rider realized only via the Psychic Strike card row approximation (which never appeared because of the gate bug).
2. **Hex cast lane dead-end (separate automation)**: bonus-action row → SpellDetailPopup "Cast Spell" → HexAbilityModal (ability WIS) → `gateMetamagic` → `tryGateSpell('hex')` → `cfSetPending('hex')` — but CharBonusActions mounts `TargetSpellPopups` only inside `{pendingLesserRestoration && …}` without `pendingHex`/`handleHexConfirm` props ⇒ target modal never renders; cast fizzles silently (zero POST, zero slot spend, zero log; reproduced 3×, fetch-hook confirmed).
3. Passive `create_thrall_temp_hp` turn-start handler (`createThrallTempHpHandler.js`) writes orphan runtime key `_<Name>_tempHp` (no consumer reads it; card reads plain `tempHp`) AND its modifier math subtracts `floor((level−1)/2)` from ability bonuses → would log/produce wrong THP (11 not 17) even if the summon existed.

## Fix sketch
- Gate on `playerStats.automation.specialActions.some(a => a.type==='create_thrall' && a.spell===spellName)` (or hydrate `majors[].features` into `subclass.class_levels` for rules 2024).
- Make `createThrall:true` in buildSpiritCreature conditional on the gate.
- Add `pendingHex` props to the CharBonusActions `TargetSpellPopups` mount (or hoist it out of the pendingLesserRestoration guard).
- Consume `companion_aberration_hit` rider or drop it from the JSON.
