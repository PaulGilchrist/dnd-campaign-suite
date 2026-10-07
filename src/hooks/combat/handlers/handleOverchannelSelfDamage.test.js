// CLA-244 regression: Overchannel backlash dice count — dicePerLevel = max(2, useCount),
// scaled by slot level; use #1 deals no damage; IRV-ignore note preserved.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula) return null;
    const match = formula.match(/^(\d+)d(\d+)$/i);
    if (!match) return null;
    const count = parseInt(match[1], 10);
    const rolls = Array(count).fill(6);
    return { total: rolls.reduce((s, r) => s + r, 0), rolls, modifier: 0 };
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

const characters = [];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleOverchannelSelfDamage — CLA-244 backlash dice count', () => {
  it('rolls nothing when overchannel is inactive', async () => {
    const logEntry = vi.fn();
    await handleOverchannelSelfDamage('TestWizard', 'test-campaign', { overchannelActive: false, overchannelUseCount: 2, overchannelSpellLevel: 2 }, logEntry, characters);
    expect(rollExpression).not.toHaveBeenCalled();
    expect(logEntry).not.toHaveBeenCalled();
  });

  it('rolls nothing on first use (useCount 1)', async () => {
    const logEntry = vi.fn();
    await handleOverchannelSelfDamage('TestWizard', 'test-campaign', { overchannelActive: true, overchannelUseCount: 1, overchannelSpellLevel: 2 }, logEntry, characters);
    expect(rollExpression).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(logEntry).not.toHaveBeenCalled();
  });

  it('rolls 4d12 for use #2 level 2 slot and applies ignoring resistance/immunity', async () => {
    const logEntry = vi.fn();
    await handleOverchannelSelfDamage('TestWizard', 'test-campaign', { overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 2 }, logEntry, characters);

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

  it('rolls 9d12 for use #3 level 3 slot (dicePerLevel = useCount)', async () => {
    const logEntry = vi.fn();
    await handleOverchannelSelfDamage('TestWizard', 'test-campaign', { overchannelActive: true, overchannelUseCount: 3, overchannelSpellLevel: 3 }, logEntry, characters);
    expect(rollExpression).toHaveBeenCalledWith('9d12');
  });

  it('rolls 2d12 for use #2 level 1 slot', async () => {
    const logEntry = vi.fn();
    await handleOverchannelSelfDamage('TestWizard', 'test-campaign', { overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 1 }, logEntry, characters);
    expect(rollExpression).toHaveBeenCalledWith('2d12');
  });

  it('does not apply or log when the roll fails', async () => {
    rollExpression.mockReturnValueOnce(null);
    const logEntry = vi.fn();
    await handleOverchannelSelfDamage('TestWizard', 'test-campaign', { overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 2 }, logEntry, characters);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(logEntry).not.toHaveBeenCalled();
  });
});
