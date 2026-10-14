import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handle } from './sleepShakeHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Shake Asleep',
    automation: {
      type: 'sleep_shake',
      range: '5 ft',
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('sleepShakeHandler - target selection and modal payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sleep target detection for player creatures', () => {
    it('identifies player creatures with incapacitated condition via runtime store', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'Orc', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(['incapacitated', 'poisoned']);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toEqual(['AllyPlayer']);
    });

    it('identifies player creatures with unconscious condition via runtime store', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'Orc', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(['unconscious', 'frightened']);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toEqual(['AllyPlayer']);
    });

    it('does not select player creatures without incapacitated/unconscious', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'Orc', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toEqual(['AllyPlayer', 'Orc']);
    });

    it('handles non-array conditions from runtime store', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toEqual(['AllyPlayer']);
    });
  });

  describe('sleep target detection for monster creatures', () => {
    it('identifies monsters with incapacitated condition from conditions array', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'incapacitated' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toEqual(['Goblin']);
    });

    it('identifies monsters with unconscious condition from conditions array', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'unconscious' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toEqual(['Goblin']);
    });

    it('handles case-insensitive condition matching for monsters', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'INCAPACITATED' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'Unconscious' }] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
    });

    it('handles string conditions array for monsters — string conditions do not match because code expects cond.key', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: ['incapacitated'] },
          { name: 'Orc', type: 'monster', conditions: ['frightened'] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
    });
  });

  describe('modal payload', () => {
    it('returns correct modal payload structure', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('sleepShake');
      expect(result.payload.attackerName).toBe('TestCaster');
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      expect(result.payload.rangeFeet).toBe(5);
      expect(result.payload.featureName).toBe('Shake Asleep');
    });

    it('uses action name when provided', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      resolveMapPositions.mockResolvedValue(null);

      const action = makeAction();
      action.name = 'Custom Shake';
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.featureName).toBe('Custom Shake');
    });

    it('parses range from automation string', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.rangeFeet).toBe(5);
    });

    it('passes automation through payload', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      resolveMapPositions.mockResolvedValue(null);

      const action = makeAction({ range: '10 ft' });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.automation).toEqual({
        type: 'sleep_shake',
        range: '10 ft',
      });
    });
  });
});
