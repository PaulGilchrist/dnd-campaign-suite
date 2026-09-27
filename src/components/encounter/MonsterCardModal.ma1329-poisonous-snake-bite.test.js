// MA-1329: Poisonous Snake "Bite" (attack+save composite) — the row shipped
// damage_dice_primary "2d4" (the SAVE-leg poison pool) with no authored flat
// primary, so extractDamageDiceFromDescription short-circuited and the attack
// chip paid the save-gated 2d4 poison FULL as direct hit damage
// (combined_damage_roll), while the RAW flat 1 Piercing never landed.
// DATA fix mirrors the giant-poisonous-snake byte-twins (MA-0816):
// damage_dice_primary "1" Piercing (MA-0885/MA-0710 flat lane) +
// damage_dice_secondary "2d4" Poison save leg (byte rides save_effect
// failure clause "5 (2d4)"), so buildAttackChipSaveOptions pays fixed flat 1
// with save keys nulled and the DC chip adjudicates 2d4 full/half.
// CODE guard: saveChipPlan must keep the DC chip CLICKABLE on a composite row
// whose flat "1" primary is not rollExpression-parseable — the clickable
// secondary save leg is the save adjudication affordance (MA-0551 fork).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildAutoDamageOptions,
  buildSaveOptions,
  buildAbilitySaveRollContext,
  isCompositeAttackSaveRow,
  saveLegCarriesSecondaryDamage,
  saveLegIsConditionRider,
  saveChipPlan,
} from './MonsterCardModal.jsx';

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Piercing'];

const snakeRow = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'poisonous-snake').actions[0];

describe('MA-1329 poisonous-snake Bite — attack+save composite data shape', () => {
  it('disk row authors flat "1" Piercing primary + "2d4" Poison secondary', () => {
    expect(snakeRow.name).toBe('Bite');
    expect(snakeRow.attack_bonus).toBe(5);
    expect(snakeRow.save_dc).toBe(10);
    expect(snakeRow.save_type).toBe('Constitution');
    expect(snakeRow.damage_dice_primary).toBe('1');
    expect(snakeRow.damage_type_primary).toBe('Piercing');
    expect(snakeRow.damage_dice_secondary).toBe('2d4');
    expect(snakeRow.damage_type_secondary).toBe('Poison');
  });

  it('saveLegCarriesSecondaryDamage: true — "2d4" byte lives inside save_effect', () => {
    expect(isCompositeAttackSaveRow(snakeRow)).toBe(true);
    expect(snakeRow.save_effect.includes('2d4')).toBe(true);
    expect(saveLegCarriesSecondaryDamage(snakeRow)).toBe(true);
    expect(saveLegIsConditionRider(snakeRow)).toBe(false);
  });

  it('attack-chip producer carries flat "1" primary; save keys ride buildSaveOptions and are stripped by the MA-0551 attack-chip fork upstream', () => {
    const opts = buildAutoDamageOptions(snakeRow, 'Bite');
    expect(opts.autoDamageFormula).toBe('1');
    const saveOpts = buildSaveOptions(snakeRow);
    expect(saveOpts.saveDc).toBe(10);
    expect(saveOpts.dcSuccess).toBe('half');
    expect(saveOpts.autoDamageSecondaryFormula).toBe('2d4');
    expect(saveOpts.autoDamageSecondaryDamageType).toBe('Poison');
    // saveLegCarriesSecondaryDamage true => the composite fork (verified in
    // MonsterCardModal.secondary-save-transport / giant-snake-save-leg twins)
    // nulls saveDc/saveType/dcSuccess + secondary on the ATTACK chip.
    expect(saveLegCarriesSecondaryDamage(snakeRow)).toBe(true);
  });

  it('save chip adjudicates 2d4 Poison full/half, never the flat attack primary', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Poisonous Snake 1',
      target: { name: 'Bandit 1', type: 'monster' },
      spellName: null,
      action: snakeRow,
      saveType: 'CON',
      dcSuccess: 'half',
      saveDamageFormula: '1',
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.autoDamageFormula).toBe('2d4');
    expect(ctx.autoDamageDamageType).toBe('Poison');
    expect(ctx.autoDamageSecondaryFormula).toBeNull();
    expect(ctx.dcSuccess).toBe('half');
  });

  it('saveChipPlan keeps the DC chip clickable despite unrollable flat "1" formula', () => {
    const plan = saveChipPlan(snakeRow, false);
    expect(plan.formula).toBe('1');
    expect(plan.rollable).toBe(false);
    expect(plan.clickable).toBe(true);
  });
});
