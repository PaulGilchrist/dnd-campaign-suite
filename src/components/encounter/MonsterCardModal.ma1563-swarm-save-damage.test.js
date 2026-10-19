// @maintained-by-ai
// MA-1563: Swarm of Poisonous Snakes "Bites" save transport — the DC-chip
// press routes ActionSaveRoll → saveChipPlan.formula → executeBlockSaveRoll →
// buildAbilitySaveRollContext → saveProcessing.applySaveDamage, which rolls
// context.autoDamageFormula/autoDamageDamageType verbatim. Pre-fix the chip
// carried damage_dice_primary ("2d6" piercing) and the save leg rolled/logged
// it for both faces. Fix: authored save_damage_dice/save_damage_type override
// the save-leg formula/type (byte-inert for rows without the keys).
//
// Cite-skips (covered elsewhere, never re-anchored here):
// • swarm Bites disk row byte-lock + file-wide 4d6 uniqueness:
//   MonsterCardModal.ma1578-tarrasque-swallow.test.js :150-165
// • parseSaveDamageFields structured-key helper (incl. legacy byte-inert null):
//   MonsterCardHelpers.ma1563-swarm-save-damage.test.js
// • predicate truth tables + generic dc/type/secondary transport:
//   MonsterCardModal.secondary-save-transport.test.js :111-128
// • full-on-fail/zero-on-success half math: applyDamage.save-full.test.js (MA-0218)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildAutoDamageOptions,
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
  it('authored save_damage_dice owns the chip formula — exact plan shape, 4d6 pool rollable', () => {
    // clickable:false is byte-correct here: it only gates the UNROLLABLE fallback
    // chip; the rollable:true branch renders the dice + "DC 10 Constitution"
    // spans unconditionally clickable (ActionSaveRoll), so the press works.
    expect(saveChipPlan(swarmRow, false)).toEqual({
      riderOnly: false,
      formula: '4d6',
      rollable: true,
      clickable: false,
    });
  });
});

describe('MA-1563 swarm Bites save roll context transport', () => {
  it('save context overrides with authored 4d6 Poison — discriminating legacy "2d6" formula input never rolls/logs the attack pool', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Swarm of Poisonous Snakes 1',
      target: { name: 'Bandit 1', type: 'monster' },
      spellName: null,
      action: swarmRow,
      saveType: 'CON',
      dcSuccess: 'half',
      // Discriminator: a refactored-away MA-1563 branch falls through to this
      // param and rolls 2d6 piercing — the exact ticket bug — so this input,
      // not plan.formula, keeps the ctx-level override itself under test.
      saveDamageFormula: '2d6',
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.autoDamageFormula).toBe('4d6');
    expect(ctx.autoDamageDamageType).toBe('Poison');
    // no fabricated second leg — the save pool rides the primary save leg alone
    expect(ctx.autoDamageSecondaryFormula).toBeNull();
    expect(ctx.autoDamageSecondaryDamageType).toBeNull();
  });

  it('byte-inert face: legacy swarm row without the keys — chip AND context keep the pre-fix 2d6 piercing transport', () => {
    const plan = saveChipPlan(legacyRow, false);
    expect(plan.formula).toBe('2d6');
    expect(plan.rollable).toBe(true);
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Swarm of Poisonous Snakes 1',
      target: { name: 'Bandit 1', type: 'monster' },
      spellName: null,
      action: legacyRow,
      saveType: 'CON',
      dcSuccess: 'half',
      saveDamageFormula: plan.formula, // ActionSaveRoll hands off the chip plan
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.autoDamageFormula).toBe('2d6');
    expect(ctx.autoDamageDamageType).toBe('piercing');
  });

  it('attack chip stays 2d6 Piercing — save_damage keys never bleed to the attack side', () => {
    const opts = buildAutoDamageOptions(swarmRow, 'Bites');
    expect(opts.autoDamageFormula).toBe('2d6');
    expect(opts.autoDamageName).toBe('Bites');
  });
});
