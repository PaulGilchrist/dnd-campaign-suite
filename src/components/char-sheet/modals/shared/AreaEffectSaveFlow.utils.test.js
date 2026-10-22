// AreaEffectSaveFlow.utils.rollNpcSave — saveBonus key-contract regression.
// Confirmed defect (test-maintain-bugs ledger): combatSummary saveBonuses
// carry lowercase-abbreviation keys (getMonsterSaveBonuses / CLA-303), but
// disk monster rows deliver save_type as full names ('Constitution',
// 'Dexterity'), so saveType.toLowerCase() looked up 'dexterity' against a
// 'dex'-keyed store and silently computed +0 in real gameplay.
// Fix: normalize saveType with the canonical normalizeSaveType()
// (applyDamage.js) before keying the store. Probes below pin all three
// live shapes against a nonzero abbreviated bonus.
import { describe, it, expect } from 'vitest';
import { rollNpcSave } from './AreaEffectSaveFlow.utils.js';

describe('rollNpcSave saveBonus key normalization (CLA-303 key-mismatch family)', () => {
  // Guard-style store as the producer writes it: dex = 7.
  const target = { saveBonuses: { str: 1, dex: 7, con: 1, int: 0, wis: 0, cha: 0 } };

  it.each([
    ['Dexterity (disk monster save_type bytes)', 'Dexterity'],
    ['DEX (spells.json bytes)', 'DEX'],
    ['dex (lowercase bytes)', 'dex'],
    ['Dex (mixed-case bytes)', 'Dex'],
  ])('resolves the real bonus, never silent +0, for %s', (_label, saveType) => {
    const result = rollNpcSave(target, saveType, 15, false);
    expect(result.saveBonus).toBe(7);
    expect(result.saveTotal).toBe(result.saveRoll + 7);
  });

  it('still defaults missing abilities to an honest 0', () => {
    expect(rollNpcSave(target, 'Charisma', 15, false).saveBonus).toBe(0);
    expect(rollNpcSave({}, 'Dexterity', 15, false).saveBonus).toBe(0);
  });
});
