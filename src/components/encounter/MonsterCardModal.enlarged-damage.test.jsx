// @maintained-by-ai
// MA-0655: Enlarge STR-dice consumer — the monster attack-damage seam
// (buildAutoDamageOptions via enlargedAttackDamageFields in handleAttack)
// doubles the PRIMARY dice count of `strength_based:true` rows ONLY while
// the attacker carries te `enlarged` (1d8 + 2 → 2d8 + 2, 1d6 + 2 →
// 2d6 + 2); modifier NEVER doubled; flat constants stay dice-less even
// INSIDE the doubling branch (doublePrimaryDiceCount pass-through,
// owner: monsterSelfBuff.test.js); every un-enlarged / non-STR attack
// stays byte-identical. Crit ×2 still multiplies the (possibly doubled)
// formula downstream unchanged — distinct multiplier, verified by the
// doubled formula string being the input.
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
// strength_based:true on purpose: enters the doubling branch so the flat
// constant proves dice-less pass-through, not the non-STR guard (that is
// the Dagger's job above).
const FLAT_STR_ROW = { name: 'Flat Hit', attack_bonus: 2, damage_dice_primary: '1', damage_type_primary: 'slashing', strength_based: true, description: 'Hit: 1 Slashing damage.' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0655 buildAutoDamageOptions enlarged doubling', () => {
  it.each([
    ['War Pick', WAR_PICK, '1d8 + 2', '2d8 + 2'],
    ['Javelin', JAVELIN, '1d6 + 2', '2d6 + 2'],
  ])('enlarged STR %s doubles dice count, modifier untouched; un-enlarged byte-identical (explicit false + default arity)', (_label, row, base, doubled) => {
    expect(buildAutoDamageOptions(row, _label, true).autoDamageFormula).toBe(doubled);
    expect(buildAutoDamageOptions(row, _label, false).autoDamageFormula).toBe(base);
    expect(buildAutoDamageOptions(row, _label).autoDamageFormula).toBe(base);
  });

  it('non-STR row never doubles; flat STR constant stays dice-less through the doubling branch', () => {
    expect(buildAutoDamageOptions(NON_STR_ROW, 'Dagger', true).autoDamageFormula).toBe('1d4 + 0');
    expect(buildAutoDamageOptions(FLAT_STR_ROW, 'Flat Hit', true).autoDamageFormula).toBe('1');
  });

  it('enlarged opts carry the doubled byte beside untouched identity/transport keys — no fabricated secondary or rider legs', () => {
    const opts = buildAutoDamageOptions(WAR_PICK, 'War Pick', true);
    expect(opts.autoDamageName).toBe('War Pick');
    expect(opts.autoDamageSecondaryFormula).toBeNull();
    expect(opts.bestialFuryRider).toBeUndefined();
    expect(opts.thrallHexRider).toBeUndefined();
  });
});

describe('MA-0655 enlargedAttackDamageFields discriminator', () => {
  it('self te + STR row arms doubling (target-matched AND targetless te) and logs each arm marked enlarged', () => {
    const base = { action: WAR_PICK, name: 'War Pick', monsterName: 'Duergar 1', campaignName: 'test-campaign' };
    expect(enlargedAttackDamageFields({ ...base, monsterTargetEffects: ENLARGE_TE })).toEqual({ enlarged: true });
    expect(enlargedAttackDamageFields({ ...base, monsterTargetEffects: [{ effect: 'enlarged', source: 'Duergar 1' }] })).toEqual({ enlarged: true });
    expect(addEntry).toHaveBeenCalledTimes(2);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.automationType).toBe('enlarge_damage_doubled');
    expect(entry.note).toBe('enlarged');
    expect(entry.description).toContain('1d8 + 2 → 2d8 + 2');
    expect(entry.description).toContain('modifier not doubled');
  });

  it.each([
    ['no te', [], WAR_PICK],
    ['non-STR row', ENLARGE_TE, NON_STR_ROW],
    ['te belonging to another creature', [{ target: 'Other', effect: 'enlarged', source: 'Duergar 1' }], WAR_PICK],
  ])('inert face — %s: { enlarged: false } with zero log', (_label, tes, row) => {
    expect(enlargedAttackDamageFields({ monsterTargetEffects: tes, action: row, name: row.name, monsterName: 'Duergar 1', campaignName: 'test-campaign' })).toEqual({ enlarged: false });
    expect(addEntry).not.toHaveBeenCalled();
  });
});
