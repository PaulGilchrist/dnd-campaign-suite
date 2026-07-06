// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './soulOfVengeanceHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
  return {
    name: 'Soul of Vengeance',
    automation: { type: 'soul_of_vengeance', trigger: 'after_vow_of_enmity_target_attacks', ...overrides.automation },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 15,
    attacks: [
      { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6, damage: '1d8+3', damageType: 'Slashing' },
    ],
    ...overrides,
  };
}

function setupVowOfEnmityActive(vowTarget = 'Orc') {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
    if (key === 'vowOfEnmityTarget') return vowTarget;
    return null;
  });
}

function setupDefaultCombatContext(targetName = 'Orc') {
  getCombatContext.mockResolvedValue({
    targets: [{ attackerName: 'TestHero', targetName }],
    creatures: [{ name: targetName }],
  });
  getTargetFromAttacker.mockReturnValue({ name: targetName });
}

describe('soulOfVengeanceHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [];
      if (key === 'vowOfEnmityTarget') return null;
      return null;
    });
    getCombatContext.mockResolvedValue(null);
    getTargetFromAttacker.mockReturnValue(null);
  });

  describe('vow of enmity checks', () => {
    it('should return popup when Vow of Enmity is not active', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Soul of Vengeance');
      expect(result.payload.automationType).toBe('soul_of_vengeance');
      expect(result.payload.description).toContain('Vow of Enmity is not active');
    });

    it('should return popup when Vow of Enmity target is missing', async () => {
      setupVowOfEnmityActive(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No Vow of Enmity target selected');
    });
  });

  describe('combat context checks', () => {
    it('should return popup when combat context or target is missing', async () => {
      setupVowOfEnmityActive('Orc');
      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected in combat');
    });
  });

  describe('attack selection', () => {
    it('should return popup when no attacks are available', async () => {
      setupVowOfEnmityActive('Orc');
      setupDefaultCombatContext('Orc');
      const stats = makePlayerStats({ attacks: [] });

      const result = await handle(makeAction(), stats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No melee attack available');
    });

    it('should prefer melee attack over ranged', async () => {
      setupVowOfEnmityActive('Orc');
      setupDefaultCombatContext('Orc');
      const stats = makePlayerStats({
        attacks: [
          { name: 'Crossbow', type: 'Action', range: 10, hitBonus: 6, damage: '1d8+3', damageType: 'Piercing' },
          { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6, damage: '1d8+3', damageType: 'Slashing' },
        ],
      });

      const result = await handle(makeAction(), stats, campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.attack.name).toBe('Longsword');
    });

    it('should fall back to ranged when no melee attack is available', async () => {
      setupVowOfEnmityActive('Orc');
      setupDefaultCombatContext('Orc');
      const stats = makePlayerStats({
        attacks: [
          { name: 'Crossbow', type: 'Action', range: 10, hitBonus: 6, damage: '1d8+3', damageType: 'Piercing' },
        ],
      });

      const result = await handle(makeAction(), stats, campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.attack.name).toBe('Crossbow');
    });
  });

  describe('successful attack_roll path', () => {
    it('should return attack_roll with correct payload structure', async () => {
      setupVowOfEnmityActive('Orc');
      setupDefaultCombatContext('Orc');

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.attack).toEqual(
        expect.objectContaining({
          name: 'Longsword',
          type: 'Action',
          range: 5,
          hitBonus: 6,
          damage: '1d8+3',
          damageType: 'Slashing',
        }),
      );
      expect(result.payload.targetName).toBe('Orc');
      expect(result.payload.sourceName).toBe('Soul of Vengeance');
    });

    it('should call addEntry with ability_use on success', async () => {
      setupVowOfEnmityActive('Orc');
      setupDefaultCombatContext('Orc');

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Soul of Vengeance',
        description: 'Soul of Vengeance used against Orc',
      }));
    });

    it('should use vow target name in addEntry description', async () => {
      setupVowOfEnmityActive('Dragon');
      setupDefaultCombatContext('Dragon');

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: 'Soul of Vengeance used against Dragon',
      }));
    });
  });
});
