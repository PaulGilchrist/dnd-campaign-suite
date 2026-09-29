// MA-1563: Swarm of Poisonous Snakes "Bites" save transport — the DC-chip
// press routes ActionSaveRoll → saveChipPlan.formula → executeBlockSaveRoll →
// buildAbilitySaveRollContext → saveProcessing.applySaveDamage, which rolls
// context.autoDamageFormula/autoDamageDamageType verbatim. Pre-fix the chip
// carried damage_dice_primary ("2d6" piercing) and the save leg rolled/logged
// it for both faces. Fix: authored save_damage_dice/save_damage_type override
// the save-leg formula/type (byte-inert for rows without the keys).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildAutoDamageOptions,
  buildSaveOptions,
  buildAbilitySaveRollContext,
  saveChipPlan,
} from './MonsterCardModal.jsx';

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Piercing'];

const swarmRow = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'swarm-of-poisonous-snakes').actions[0];

const legacyRow = (() => {
  const row = { ...swarmRow };
  delete row.save_damage_dice;
  delete row.save_damage_type;
  return row;
})();

describe('MA-1563 swarm Bites save chip plan', () => {
  it('chip carries the authored 4d6 save pool, rollable, not a rider', () => {
    const plan = saveChipPlan(swarmRow, false);
    expect(plan.formula).toBe('4d6');
    expect(plan.rollable).toBe(true);
    expect(plan.riderOnly).toBe(false);
  });

  it('legacy row without the keys keeps the damage_dice_primary chip byte-identical', () => {
    const plan = saveChipPlan(legacyRow, false);
    expect(plan.formula).toBe('2d6');
    expect(plan.rollable).toBe(true);
  });
});

describe('MA-1563 swarm Bites save roll context transport', () => {
  it('save context rolls 4d6 Poison — not the attack pool 2d6 piercing', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Swarm of Poisonous Snakes 1',
      target: { name: 'Bandit 1', type: 'monster' },
      spellName: null,
      action: swarmRow,
      saveType: 'CON',
      dcSuccess: 'half',
      saveDamageFormula: '2d6',
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.autoDamageFormula).toBe('4d6');
    expect(ctx.autoDamageDamageType).toBe('Poison');
    expect(ctx.saveDc).toBe(10);
    expect(ctx.saveType).toBe('CON');
    expect(ctx.dcSuccess).toBe('half');
  });

  it('legacy row without the keys: context fields byte-identical to pre-fix transport', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Swarm of Poisonous Snakes 1',
      target: { name: 'Bandit 1', type: 'monster' },
      spellName: null,
      action: legacyRow,
      saveType: 'CON',
      dcSuccess: 'half',
      saveDamageFormula: '2d6',
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.autoDamageFormula).toBe('2d6');
    expect(ctx.autoDamageDamageType).toBe('piercing');
  });

  it('attack chip stays 2d6 piercing — save_damage keys never bleed to the attack side', () => {
    const opts = buildAutoDamageOptions(swarmRow, 'Bites');
    expect(opts.autoDamageFormula).toBe('2d6');
    const saveOpts = buildSaveOptions(swarmRow);
    expect(saveOpts.saveDc).toBe(10);
    expect(saveOpts.saveType).toBe('con');
    expect(saveOpts.dcSuccess).toBe('half');
  });
});
