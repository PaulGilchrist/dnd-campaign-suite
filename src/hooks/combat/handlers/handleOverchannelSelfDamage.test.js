// @maintained-by-ai: 2026-10-14
// CLA-244 regression: Overchannel backlash dice count — dicePerLevel = max(2, useCount),
// scaled by slot level; use #1 deals no damage; IRV-ignore note preserved.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    const match = formula?.match(/^(\d+)d(\d+)$/i);
    if (!match) return null;
    const rolls = Array(parseInt(match[1], 10)).fill(6);
    return { total: rolls.length * 6, rolls, modifier: 0 };
  }),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((_cs, _name, dmg) => ({ finalDamage: dmg, newHp: 82 - dmg })),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'TestWizard', type: 'player', currentHp: 82, maxHp: 82 }] })),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';

const invoke = async (context) => {
  const logEntry = vi.fn();
  await handleOverchannelSelfDamage('TestWizard', 'test-campaign', context, logEntry, []);
  return logEntry;
};

beforeEach(() => vi.clearAllMocks());

describe('handleOverchannelSelfDamage — CLA-244 backlash dice count', () => {
  it.each([
    ['overchannel inactive', { overchannelActive: false, overchannelUseCount: 2, overchannelSpellLevel: 2 }],
    ['first use (useCount 1)', { overchannelActive: true, overchannelUseCount: 1, overchannelSpellLevel: 2 }],
  ])('rolls nothing when %s', async (_label, context) => {
    const logEntry = await invoke(context);
    expect(rollExpression).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(logEntry).not.toHaveBeenCalled();
  });

  it('rolls 4d12 for use #2 level 2 slot and applies ignoring resistance/immunity', async () => {
    const logEntry = await invoke({ overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 2 });

    expect(rollExpression).toHaveBeenCalledWith('4d12');
    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(),
      'TestWizard',
      24,
      ['Necrotic'],
      expect.objectContaining({ campaignName: 'test-campaign', ignoreResistance: true, attackerName: 'TestWizard' })
    );
    expect(logEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'roll',
      rollType: 'overchannel-damage',
      name: 'Overchannel',
      formula: '4d12',
      damageType: 'Necrotic',
      targetName: 'TestWizard',
      note: 'Overchannel self-damage (ignores resistance/immunity)',
    }));
  });

  it.each([
    [2, 1, '2d12'],
    [3, 3, '9d12'],
  ])('use #%i level %i slot rolls %s', async (useCount, spellLevel, formula) => {
    await invoke({ overchannelActive: true, overchannelUseCount: useCount, overchannelSpellLevel: spellLevel });
    expect(rollExpression).toHaveBeenCalledWith(formula);
  });

  it('does not apply or log when the roll fails', async () => {
    rollExpression.mockReturnValueOnce(null);
    const logEntry = await invoke({ overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 2 });
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(logEntry).not.toHaveBeenCalled();
  });
});
