// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './soulOfVengeanceHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
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

function setupLastAttack(attackerName = 'Orc') {
  findLastAttack.mockResolvedValue({
    attackEvent: {
      attackerName,
      targetName: 'Ally',
      d20: 15,
      bonus: 6,
      total: 21,
      targetAc: 14,
      hit: true,
      isCrit: false,
      damageType: 'Slashing',
      damageFormula: '1d8+3',
      attackName: 'Longsword',
    },
    attackerName,
    targetName: 'Ally',
    primaryDamage: 7,
    secondaryDamage: 0,
    totalDamage: 7,
    damageTypes: ['Slashing'],
  });
}

describe('soulOfVengeanceHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [];
      if (key === 'vowOfEnmityTarget') return null;
      return null;
    });
    findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
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
      expect(result.payload.description).toContain('Vow of Enmity is not active');
    });
  });

  describe('lastAttack checks', () => {
    it('should return popup when no lastAttack found', async () => {
      setupVowOfEnmityActive('Orc');
      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent attack found');
    });

    it('should return popup when last attacker is not the Vow target', async () => {
      setupVowOfEnmityActive('Orc');
      setupLastAttack('Goblin');

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('Orc');
      expect(result.payload.description).toContain('last attacker');
    });

    it('should return popup when last attacker is not the Vow target (different names)', async () => {
      setupVowOfEnmityActive('Dragon');
      setupLastAttack('Bandit');

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bandit');
      expect(result.payload.description).toContain('Dragon');
    });
  });

  describe('attack selection', () => {
    it('should return popup when no attacks are available', async () => {
      setupVowOfEnmityActive('Orc');
      setupLastAttack('Orc');
      const stats = makePlayerStats({ attacks: [] });

      const result = await handle(makeAction(), stats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No melee attack available');
    });

    it.each([
      {
        name: 'prefers melee over ranged',
        attacks: [
          { name: 'Crossbow', type: 'Action', range: 10, hitBonus: 6, damage: '1d8+3', damageType: 'Piercing' },
          { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6, damage: '1d8+3', damageType: 'Slashing' },
        ],
        expectedAttack: 'Longsword',
      },
      {
        name: 'falls back to ranged when no melee available',
        attacks: [
          { name: 'Crossbow', type: 'Action', range: 10, hitBonus: 6, damage: '1d8+3', damageType: 'Piercing' },
        ],
        expectedAttack: 'Crossbow',
      },
    ])('should $name', async ({ attacks, expectedAttack }) => {
      setupVowOfEnmityActive('Orc');
      setupLastAttack('Orc');
      const stats = makePlayerStats({ attacks });

      const result = await handle(makeAction(), stats, campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.attack.name).toBe(expectedAttack);
    });
  });

  describe('successful attack_roll path', () => {
    it('should return attack_roll targeting the Vow target and log ability_use', async () => {
      setupVowOfEnmityActive('Orc');
      setupLastAttack('Orc');

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
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Soul of Vengeance',
        description: expect.stringContaining('Soul of Vengeance'),
        targetName: 'Orc',
      }));
    });

    it('should use the custom action name from the automation', async () => {
      setupVowOfEnmityActive('Goblin');
      setupLastAttack('Goblin');

      const result = await handle(makeAction({ name: 'My Soul of Vengeance' }), makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.sourceName).toBe('My Soul of Vengeance');
    });
  });
});
