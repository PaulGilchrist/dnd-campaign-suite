import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

import { handle, getWardingBondTarget, getWardingBondSource, isWardingBondActive } from './wardingBondHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Warding Bond',
    automation: { type: 'warding_bond', ...automation },
  };
}

describe('wardingBondHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('should return popup when no combat summary', async () => {
      getCombatSummary.mockReturnValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('should return popup when no target from attacker', async () => {
      getCombatSummary.mockReturnValue({ enemies: [] });
      getTargetFromAttacker.mockReturnValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('should apply warding bond when target exists', async () => {
      getCombatSummary.mockReturnValue({ enemies: [] });
      getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Warding Bond');
      expect(result.payload.description).toContain('AllyTarget');
    });
  });

  describe('buff application', () => {
    it('should apply warding bond buff to target with AC +1 and save +1', async () => {
      getCombatSummary.mockReturnValue({ enemies: [] });
      getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'AllyTarget',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'warding_bond',
            acBonus: 1,
            saveBonus: 1,
          }),
        ]),
        campaignName,
      );
    });

    it('should store bond relationship on caster', async () => {
      getCombatSummary.mockReturnValue({ enemies: [] });
      getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'warding_bond',
            bondTarget: 'AllyTarget',
          }),
        ]),
        campaignName,
      );
    });

    it('should add expiration', async () => {
      getCombatSummary.mockReturnValue({ enemies: [] });
      getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCleric',
        'AllyTarget',
        expect.arrayContaining([{ type: 'remove_active_buff', buffName: 'Warding Bond' }]),
        campaignName,
      );
    });
  });


});

describe('wardingBondHandler.getWardingBondTarget', () => {
  it('should return bond target from caster buffs', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', bondTarget: 'AllyTarget' }]);
    const result = getWardingBondTarget('TestCleric', campaignName);
    expect(result).toBe('AllyTarget');
  });

  it('should return null when no bond exists', () => {
    getRuntimeValue.mockReturnValue([]);
    const result = getWardingBondTarget('TestCleric', campaignName);
    expect(result).toBeNull();
  });
});

describe('wardingBondHandler.getWardingBondSource', () => {
  it('should return bond source from target buffs', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', sourceCharacter: 'TestCleric' }]);
    const result = getWardingBondSource('AllyTarget', campaignName);
    expect(result).toBe('TestCleric');
  });

  it('should return null when no bond exists', () => {
    getRuntimeValue.mockReturnValue([]);
    const result = getWardingBondSource('AllyTarget', campaignName);
    expect(result).toBeNull();
  });
});

describe('wardingBondHandler.isWardingBondActive', () => {
  it('should return true when warding bond is active', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', sourceCharacter: 'TestCleric' }]);
    const result = isWardingBondActive('AllyTarget', campaignName);
    expect(result).toBe(true);
  });

  it('should return false when warding bond is not active', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
    const result = isWardingBondActive('AllyTarget', campaignName);
    expect(result).toBe(false);
  });

  it('should return false when no buffs exist', () => {
    getRuntimeValue.mockReturnValue([]);
    const result = isWardingBondActive('AllyTarget', campaignName);
    expect(result).toBe(false);
  });
});
