// SP-126: processWebAreaSave had ZERO callers and `_web_<caster>` ZERO
// producers — the turn-start recurring save was permanently inert.
// expireStaleEffects gained a Web phase consuming `web` zone tes at each
// carrier's turn start. Locked here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 2),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/sleetStormHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(null),
  processSleetStormAreaSave: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../automation/handlers/spells/stinkingCloudHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(null),
  processStinkingCloudAreaSave: vi.fn().mockResolvedValue(null),
  applyStinkingCloudTurnEnd: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../automation/handlers/spells/webAreaSaveHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(null),
  processWebAreaSave: vi.fn().mockResolvedValue(null),
}));

import { expireStaleEffects } from './expireStaleEffects.js';
import { processWebAreaSave } from '../../automation/handlers/spells/webAreaSaveHandler.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';

const campaignName = 'test-campaign';

describe('expireStaleEffects — Web turn-start recurring save (SP-126)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveCreatureName.mockReturnValue('Zombie 1');
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'TestCaster' },
        { name: 'Zombie 1' },
        { name: 'Thug 1' },
      ],
    });
  });

  it('forces a recurring save for the active creature carrying a live web zone te', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') {
        return [
          { target: 'Zombie 1', effect: 'web', source: 'TestCaster', dc: 19, duration: 'concentration' },
        ];
      }
      if (name === 'TestCaster' && key === '_web_TestCaster') {
        return { caster: 'TestCaster', saveDc: 19, saveType: 'DEX', mapName: null };
      }
      return null;
    });

    await expireStaleEffects(campaignName);

    expect(processWebAreaSave).toHaveBeenCalledWith('TestCaster', 'Zombie 1', campaignName, null);
  });

  it('does not fire when the caster zone tracking is gone (concentration swept)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') {
        return [
          { target: 'Zombie 1', effect: 'web', source: 'TestCaster', dc: 19, duration: 'concentration' },
        ];
      }
      return null;
    });

    await expireStaleEffects(campaignName);

    expect(processWebAreaSave).not.toHaveBeenCalled();
  });

  it('does not fire for creatures without a web zone te', async () => {
    getActiveCreatureName.mockReturnValue('Thug 1');
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') {
        return [
          { target: 'Zombie 1', effect: 'web', source: 'TestCaster', dc: 19, duration: 'concentration' },
        ];
      }
      if (name === 'TestCaster' && key === '_web_TestCaster') {
        return { caster: 'TestCaster', saveDc: 19, saveType: 'DEX', mapName: null };
      }
      return null;
    });

    await expireStaleEffects(campaignName);

    expect(processWebAreaSave).not.toHaveBeenCalled();
  });
});
