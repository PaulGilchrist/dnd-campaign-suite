# Bug MA-0816 — Giant Poisonous Snake "Bite": save-leg rolls attack primary dice (1d4+4 Piercing), RAW demands 3d6 Poison

**Verdict: FAIL(a) / DATA** — 2026-09-22, test-campaign only, dev :5173.

## Row
MA-0816 `giant-poisonous-snake` actions[0] Bite — "Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 6 (1d4 + 4) piercing damage, and the target must make a DC 11 Constitution saving throw, taking 10 (3d6) poison damage on a failed save, or half as much damage on a successful one."

## Static disk check — NO drift (FAIL(b) n/a)
monsters.json giant-poisonous-snake.actions[0] byte-matches the row: `attack_bonus:6`, `reach:"10 ft."`, `save_dc:11`, `save_type:"Constitution"`, `damage_dice_primary:"1d4 + 4"`, `damage_type_primary:"Piercing"`, `save_effect:"On a failure, the target takes 10 (3d6) poison damage. On a success, the target takes half as much damage."`, description byte-match. Averages: 6 ✓ (1d4+4), 10 ✓ (3d6). `dc_success` absent → default `half` = RAW half-on-success **correct** (orchestrator-adjudicated; standard template).

## Defect
`damage_dice_secondary` ABSENT while the save-leg dice ("3d6") live only in `save_effect` prose:
- `saveLegCarriesSecondaryDamage` (MonsterCardModal.jsx:867-870) requires authored `damage_dice_secondary` contained in save_effect → false.
- `saveLegIsConditionRider` (:882-886) false ("damage" word present).
- `saveChipPlan` (:891-900) → `plan.rollable=true`, formula = `extractDamageDiceFromDescription(description, damage_dice_primary)` = **"1d4 + 4"** — the existing-dice shortcut (:628-633) returns the ATTACK hit pool.
- `resolveSaveLegDamageFields` (:1300-1317) legacy branch → `autoDamageFormula:"1d4 + 4"`, `autoDamageDamageType` = primary type → **save chip rolls Piercing**.

RAW: save leg = 3d6 **Poison**, half on success. App: save leg = 1d4+4 **Piercing**, half on success (mechanism correct, pool+type wrong).

## Live ledgers (test-campaign, Bandit 1 AC12 clean res[], maxHp999 full-store cs POST)
Card chips (3, per §116/§156 two-chip compound): `+6` attack, `1d4 + 4` dice, `DC 11 Constitution` save-clickable.
- **Attack leg (PASS):** +6 first-click; `roll/attack` Bite rolls:[14,20] total 14 bonus 6 hit:true vs AC12; Done → `roll/damage` formula "1d4 + 4" rolls:[3] total 7 Piercing finalDamage 7 (`note:"combined_damage_roll"` cosmetic §183, secondary:null) → `hp_change` −7 (999→992) exact. Attack chip fired NO save (MA-0551 fork — fixed primary paid full, correct).
- **Leg A force-fail (§209 nested-abbrev `saving_throws:{con:{modifier:-5}}` full-cs POST):** DC chip first-click; `roll/save CON` bonus:-5 rolls:[14,6] (victim fold live; popup prints cosmetic "+0" §208); `roll/save Bite` total 9 = nat14−5 < 11 ✗; `roll/save-damage Bite` formula **"1d4 + 4"** rolls:[2] total 6 type **Piercing** success:false finalDamage 6 (full) → hp −6 (992→986). RAW expects 3d6 Poison (avg 10) — wrong dice pool AND wrong damage type.
- **Leg B force-success (§209 flip `{con:{modifier:+19}}`):** DC chip first-click; `roll/save Bite` total 37 = nat18+19 ✓, machine stamp `dcSuccess:"half"`; `roll/save-damage Bite` formula **"1d4 + 4"** rolls:[4] total 8 → finalDamage **4** = floor(8/2) ✓ half-mechanism exact on the wrong pool. RAW expects floor(3d6/2) Poison.
- Zero condition grants both legs — correct (row authors none).

## Honest gate/crit documentation
- Attack-miss zero-save: NOT mechanized. The two chips are independent affordances (§156 two-chip model); clicking DC chip after a miss still rolls save+damage. RAW hit-gate ("save only on hit") is GM-adjudicated; no consumer gates the DC chip on prior lastAttack.hit. Advisory per §156/MA-0551 codified design, not an additional FAIL axis.
- Crit axis §32: no nat20 occurred; flat modifier non-doubling moot — no observation.
- §138 first-click absorb did NOT occur this session (2/2 DC chips fired first click; §253 twin).

## Fix (DATA, MA-0551 byte-shape — salamander/Constrict twin on disk: primary "2d6 + 4" Bludgeoning + secondary "2d6" Fire in save_effect, dc_success absent=default half)
Author on giant-poisonous-snake.actions[0]:
- `damage_dice_secondary:"3d6"`, `damage_type_secondary:"Poison"`
→ `saveLegCarriesSecondaryDamage` true (save_effect contains "3d6") → `resolveSaveLegDamageFields` save branch: autoDamageFormula="3d6"/Poison, secondary transport nulled → DC chip adjudicates 3d6 Poison full-fail/half-success; attack chip (`buildAttackChipSaveOptions` :905-914) pays 1d4+4 Piercing fixed. Rendered dice chip prints cosmetic "1d4 + 4" (plan.formula) — adjudicate from log (§179 precedent). Poisonous-snake CR1/8 twin (primary "2d4" Poison, flat 1 pierce unauthored) = different wrongness, separate ticket family.

## Injections
§6 active-session: navigate/tool echoes contained only localhost URLs matching intent; no off-site redirect obeyed; one benign tool echo code-wrapper (expected per AGENTS.md).
