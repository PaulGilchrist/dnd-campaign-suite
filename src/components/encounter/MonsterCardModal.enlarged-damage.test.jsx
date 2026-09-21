// MA-0655: Enlarge STR-dice consumer — the monster attack-damage seam
// (buildAutoDamageOptions via enlargedAttackDamageFields in handleAttack)
// doubles the PRIMARY dice count of `strength_based:true` rows ONLY while
// the attacker carries te `enlarged` (1d8 + 2 → 2d8 + 2, 1d6 + 2 →
// 2d6 + 2); modifier NEVER doubled; flat constants stay dice-less; every
// un-enlarged / non-STR attack stays byte-identical. Crit ×2 still
// multiplies the (possibly doubled) formula downstream unchanged — distinct
// multiplier, verified by the doubled formula string being the input.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAutoDamageOptions, enlargedAttackDamageFields } from './MonsterCardModal.jsx';
import { addEntry } from '../../services/ui/logService.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const duergar = monstersData.find(m => m.index === 'duergar');
const WAR_PICK = duergar.actions.find(a => a.name === 'War Pick');
const JAVELIN = duergar.actions.find(a => a.name === 'Javelin');
const ENLARGE_TE = [{ target: 'Duergar 1', effect: 'enlarged', source: 'Duergar 1' }];
const NON_STR_ROW = { name: 'Dagger', attack_bonus: 2, damage_dice_primary: '1d4 + 0', damage_type_primary: 'piercing' };
const FLAT_ROW = { name: 'Flat Hit', attack_bonus: 2, damage_dice_primary: '1', damage_type_primary: 'slashing', description: 'Hit: 1 Slashing damage.' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0655 buildAutoDamageOptions enlarged doubling', () => {
  it('enlarged STR War Pick rolls double dice, modifier untouched', () => {
    expect(buildAutoDamageOptions(WAR_PICK, 'War Pick', true).autoDamageFormula).toBe('2d8 + 2');
  });

  it('enlarged STR Javelin doubles dice count (1d6 + 2 → 2d6 + 2)', () => {
    expect(buildAutoDamageOptions(JAVELIN, 'Javelin', true).autoDamageFormula).toBe('2d6 + 2');
  });

  it('un-enlarged STR rows stay byte-identical (legacy default too)', () => {
    expect(buildAutoDamageOptions(WAR_PICK, 'War Pick', false).autoDamageFormula).toBe('1d8 + 2');
    expect(buildAutoDamageOptions(JAVELIN, 'Javelin').autoDamageFormula).toBe('1d6 + 2');
  });

  it('non-STR rows never double while enlarged; flat constants stay dice-less', () => {
    expect(buildAutoDamageOptions(NON_STR_ROW, 'Dagger', true).autoDamageFormula).toBe('1d4 + 0');
    expect(buildAutoDamageOptions(FLAT_ROW, 'Flat Hit', true).autoDamageFormula).toBe('1');
  });

  it('secondary transport + hit clause ride the options byte-identical beside the doubled primary', () => {
    const opts = buildAutoDamageOptions(WAR_PICK, 'War Pick', true);
    expect(opts.autoDamageName).toBe('War Pick');
    expect(opts.autoDamageSecondaryFormula ?? null).toBeNull();
  });
});

describe('MA-0655 enlargedAttackDamageFields discriminator', () => {
  it('te active + STR row: arms doubling and logs the marked enlarged entry', () => {
    const fields = enlargedAttackDamageFields({ monsterTargetEffects: ENLARGE_TE, action: WAR_PICK, name: 'War Pick', monsterName: 'Duergar 1', campaignName: 'test-campaign' });
    expect(fields).toEqual({ enlarged: true });
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.automationType).toBe('enlarge_damage_doubled');
    expect(entry.note).toBe('enlarged');
    expect(entry.description).toContain('1d8 + 2 → 2d8 + 2');
    expect(entry.description).toContain('modifier not doubled');
  });

  it('no te / non-STR row: inert { enlarged: false } with zero log', () => {
    expect(enlargedAttackDamageFields({ monsterTargetEffects: [], action: WAR_PICK, name: 'War Pick', monsterName: 'Duergar 1', campaignName: 'test-campaign' })).toEqual({ enlarged: false });
    expect(enlargedAttackDamageFields({ monsterTargetEffects: ENLARGE_TE, action: NON_STR_ROW, name: 'Dagger', monsterName: 'Duergar 1', campaignName: 'test-campaign' })).toEqual({ enlarged: false });
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('enlarged te belongs to another creature: no doubling', () => {
    const fields = enlargedAttackDamageFields({ monsterTargetEffects: [{ target: 'Other', effect: 'enlarged', source: 'Duergar 1' }], action: WAR_PICK, name: 'War Pick', monsterName: 'Duergar 1', campaignName: 'test-campaign' });
    expect(fields).toEqual({ enlarged: false });
  });
});
