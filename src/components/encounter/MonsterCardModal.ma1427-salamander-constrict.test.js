// MA-1427: Salamander Constrict (monsters.json actions[2]) — save row carried
// the attack_bonus:0 decoy (household authoring noise, §417/§490 family) which
// satisfied isCompositeAttackSaveRow → saveLegCarriesSecondaryDamage matched the
// "2d6" byte inside save_effect → resolveSaveLegDamageFields REPLACED the save
// leg with secondary "2d6" Fire and nulled autoDamageSecondaryFormula: the
// primary "2d6 + 4" Bludgeoning leg never rolled (live proof: every failed save
// paid 2d6 Fire only, zero Bludgeoning, no secondary leg) AND dc_success was
// ABSENT → dc_success ?? 'half' (MV-20, :255/:1032) paid half of 2d6 Fire on
// SAVE SUCCESS (live proof: nat16 vs DC 15 paid 3). Disk description is truth:
// "Strength Saving Throw: DC 15 … Failure: 11 (2d6 + 4) Bludgeoning damage plus
// 7 (2d6) Fire damage … Success: NO clause" → success pays ZERO.
// DATA fix (zero code): drop attack_bonus:0 so the row classifies pure-save and
// the MA-0427 secondary transport (buildSecondaryDamageTransport →
// saveProcessing.applySecondarySaveDamageLeg / handleNpcSaveDamage secondary
// branch) threads BOTH legs, and author dc_success:"none" (Giant Constrictor
// Snake MA-0798 twin placement — last key; Giant Poisonous Snake save-leg
// byte-shape lineage). Byte-inert for every other row.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildAbilitySaveRollContext,
  isCompositeAttackSaveRow,
  saveLegCarriesSecondaryDamage,
  saveLegIsConditionRider,
  saveChipPlan,
} from './MonsterCardModal.jsx';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Bludgeoning'];

const row = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'salamander').actions[2];

describe('MA-1427 Salamander Constrict — DATA lock: pure-save dual-leg row', () => {
  it('is the DC 15 Strength save row with BOTH damage legs authored', () => {
    expect(row.name).toBe('Constrict');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Strength');
    expect(row.damage_dice_primary).toBe('2d6 + 4');
    expect(row.damage_type_primary).toBe('Bludgeoning');
    expect(row.damage_dice_secondary).toBe('2d6');
    expect(row.damage_type_secondary).toBe('Fire');
  });

  it('attack_bonus:0 decoy REMOVED — row classifies pure-save (Giant Constrictor Snake / Smelting Charge twin)', () => {
    expect(row.attack_bonus).toBeUndefined();
    expect(isCompositeAttackSaveRow(row)).toBe(false);
    expect(saveLegCarriesSecondaryDamage(row)).toBe(false);
    expect(saveLegIsConditionRider(row)).toBe(false);
  });

  it('canonical prose carries NO half-on-success clause; dc_success authored "none" (MV-20 half-leak guard)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/Failure:\s*11 \(2d6 \+ 4\) Bludgeoning damage plus 7 \(2d6\) Fire damage/);
    expect(row.dc_success).toBe('none');
  });

  it('save chip stays clickable adjudicating the primary formula', () => {
    const plan = saveChipPlan(row, false);
    expect(plan.riderOnly).toBe(false);
    expect(plan.formula).toBe('2d6 + 4');
    expect(plan.clickable).toBe(true);
  });
});

describe('MA-1427 save context threads BOTH legs (MA-0427 transport, no primary drop)', () => {
  const ctx = buildAbilitySaveRollContext({
    monsterName: 'Salamander 1',
    target: { name: 'Bandit', type: 'npc' },
    spellName: null,
    action: row,
    saveType: 'STR',
    dcSuccess: row.dc_success,
    saveDamageFormula: '2d6 + 4',
    saveConditions: [],
    usesGate: null,
    prerequisite: null,
    getDamageTypesForAction,
  });

  it('PRIMARY "2d6 + 4" Bludgeoning rides autoDamageFormula (never replaced)', () => {
    expect(ctx.autoDamageFormula).toBe('2d6 + 4');
    expect(ctx.autoDamageDamageType).toBe('Bludgeoning');
  });

  it('SECONDARY "2d6" Fire rides the save transport as its own leg', () => {
    expect(ctx.autoDamageSecondaryFormula).toBe('2d6');
    expect(ctx.autoDamageSecondaryDamageType).toBe('Fire');
  });
});

describe('MA-1427 dc_success "none" seam: full both legs on fail, ZERO both legs on success', () => {
  const dcSuccess = row.dc_success;

  it('computeDamageAfterSave: primary raw 10 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(10, false, dcSuccess)).toBe(10);
    expect(computeDamageAfterSave(10, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterSave: secondary raw 7 full on fail, zero on success (half-leak closed)', () => {
    expect(computeDamageAfterSave(7, false, dcSuccess)).toBe(7);
    expect(computeDamageAfterSave(7, true, dcSuccess)).toBe(0);
  });
});
