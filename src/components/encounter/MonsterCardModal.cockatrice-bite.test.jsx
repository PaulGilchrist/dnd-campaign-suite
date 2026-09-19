// MA-0501: Cockatrice Petrifying Bite transport + dc_success adjudication —
// the attack+save combo rides buildSaveOptions to handleNpcSaveDamage (NPC
// inline) / buildAbilitySaveRollContext to saveProcessing (PC prompt).
// ADJUDICATED: damage rides the ATTACK HIT; the CON save gates only the
// petrify rider → authored dc_success:"full" (MA-0367 mode). dc_success:
// "none" would ZERO the bite on save success (computeDamageAfterSave returns
// 0) — WRONG for this row; half-default MV-20 leak fixed by the same field.
import { describe, it, expect } from 'vitest';
import { buildSaveOptions, parseStagedPetrifyClause, buildAbilitySaveRollContext } from './MonsterCardModal.jsx';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import monstersData from '../../../public/data/monsters.json';

const cockatrice = (monstersData.monsters || monstersData).find(m => m.name === 'Cockatrice');
const bite = cockatrice.actions[0];

describe('MA-0501 cockatrice Petrifying Bite transport', () => {
  it('authored data lock: dc_success full + staged_petrify 24 hours on actions[0]', () => {
    expect(bite.name).toBe('Petrifying Bite');
    expect(bite.attack_bonus).toBe(3);
    expect(bite.save_dc).toBe(11);
    expect(bite.save_type).toBe('Constitution');
    expect(bite.dc_success).toBe('full');
    expect(bite.staged_petrify).toEqual({ petrified_hours: 24 });
    expect(bite.damage_dice_primary).toBe('1d4 + 1');
    expect(bite.damage_type_primary).toBe('Piercing');
  });

  it('parseStagedPetrifyClause arms ONLY on the structured key (no prose parse)', () => {
    expect(parseStagedPetrifyClause(bite)).toEqual({ petrifiedRounds: 14400 });
    expect(parseStagedPetrifyClause({ name: 'Bite', save_effect: 'Second Failure: Petrified for 24 hours' })).toBeNull();
    expect(parseStagedPetrifyClause(undefined)).toBeNull();
  });

  it('buildSaveOptions carries stagedPetrify + dcSuccess full; byte-inert null elsewhere', () => {
    const opts = buildSaveOptions(bite);
    expect(opts.stagedPetrify).toEqual({ petrifiedRounds: 14400 });
    expect(opts.dcSuccess).toBe('full');
    expect(opts.saveDc).toBe(11);

    const legacy = buildSaveOptions({ name: 'Claw', attack_bonus: 5, damage_dice_primary: '1d4+1' });
    expect(legacy.stagedPetrify).toBeNull();
    expect(legacy.dcSuccess).toBeNull();

    const saveHalfDefault = buildSaveOptions({ name: 'Breath', save_dc: 15, save_type: 'Constitution' });
    expect(saveHalfDefault.dcSuccess).toBe('half');
    expect(saveHalfDefault.stagedPetrify).toBeNull();
  });

  it('buildAbilitySaveRollContext arms stagedPetrify for the PC-prompt seam', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Cockatrice 1', target: { name: 'Bandit 1' }, spellName: null, action: bite,
      saveType: 'CON', dcSuccess: 'full', saveDamageFormula: '1d4 + 1', saveConditions: [],
      usesGate: null, prerequisite: null, getDamageTypesForAction: () => ['Piercing'],
    });
    expect(ctx.stagedPetrify).toEqual({ petrifiedRounds: 14400 });
    expect(ctx.saveDc).toBe(11);
    expect(ctx.dcSuccess).toBe('full');
  });

  it('dc_success adjudication: save-success pays FULL bite damage; none would zero it', () => {
    expect(computeDamageAfterSave(3, true, 'full')).toBe(3);
    expect(computeDamageAfterSave(3, false, 'full')).toBe(3);
    // contrast (why the bug-file's 'none' suggestion is WRONG here):
    expect(computeDamageAfterSave(3, true, 'none')).toBe(0);
    // the old MV-20 half-leak this field fixes:
    expect(computeDamageAfterSave(3, true, 'half')).toBe(1);
  });
});
