// @maintained-by-ai
// MA-1427: Salamander Constrict (monsters.json actions[2]) — the attack_bonus:0
// decoy satisfied isCompositeAttackSaveRow → saveLegCarriesSecondaryDamage matched
// the "2d6" byte inside save_effect → resolveSaveLegDamageFields REPLACED the save
// leg with secondary 2d6 Fire and nulled the secondary transport: the primary
// "2d6 + 4" Bludgeoning leg never rolled, and absent dc_success defaulted to
// 'half' (MV-20) — paying half on SAVE SUCCESS. DATA fix (zero code): drop
// attack_bonus:0 so the row classifies pure-save and buildSecondaryDamageTransport
// threads BOTH legs; author dc_success:"none" (Giant Constrictor Snake MA-0798
// twin placement) — disk prose is truth: success pays ZERO, grapple is a
// GM-adjudicated save rider, never an auto-grant.
// Owners kept stable — predicate truth tables: secondary-save-transport.test.js;
// computeDamageAfterSave 'none' math (full on fail / zero on success):
// applyDamage.save-full.test.js MA-0218 regression; giant-poisonous-snake
// save-leg bytes: giant-snake-save-leg.test.js. Salamander disk bytes: here.
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

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Bludgeoning'];

const row = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'salamander').actions[2];

describe('MA-1427 Salamander Constrict — pure-save dual-leg row', () => {
  it('disk row BYTES: DC 15 Strength save, both damage legs, dc_success "none", no attack_bonus decoy, no half-on-success prose', () => {
    expect(row).toEqual({
      name: 'Constrict',
      description: 'Strength Saving Throw: DC 15, one Large or smaller creature the salamander can see within 10 feet. Failure: 11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Fire damage. The target has the <strong>Grappled</strong> condition (escape DC 14), and it has the <strong>Restrained</strong> condition until the grapple ends.',
      save_dc: 15,
      save_type: 'Strength',
      save_effect: 'Failure: 11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Fire damage. The target has the Grappled condition (escape DC 14) and has the Restrained condition until the grapple ends.',
      range: '',
      reach: '',
      recharge: '',
      damage_dice_primary: '2d6 + 4',
      damage_type_primary: 'Bludgeoning',
      damage_dice_secondary: '2d6',
      damage_type_secondary: 'Fire',
      dc_success: 'none',
    });
  });

  it('classifies pure-save — decoy removal forks no composite lane; save chip stays clickable adjudicating the primary formula', () => {
    expect(isCompositeAttackSaveRow(row)).toBe(false);
    expect(saveLegCarriesSecondaryDamage(row)).toBe(false);
    expect(saveLegIsConditionRider(row)).toBe(false);
    expect(saveChipPlan(row, false)).toEqual({
      riderOnly: false,
      formula: '2d6 + 4',
      rollable: true,
      clickable: true,
    });
  });

  it('save context threads BOTH legs — primary "2d6 + 4" Bludgeoning never replaced, secondary "2d6" Fire rides its own leg, dc_success "none" (zero-on-success math owned by applyDamage.save-full)', () => {
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
    expect(ctx.saveDc).toBe(15);
    expect(ctx.dcSuccess).toBe('none');
    expect(ctx.autoDamageFormula).toBe('2d6 + 4');
    expect(ctx.autoDamageDamageType).toBe('Bludgeoning');
    expect(ctx.autoDamageSecondaryFormula).toBe('2d6');
    expect(ctx.autoDamageSecondaryDamageType).toBe('Fire');
  });
});
