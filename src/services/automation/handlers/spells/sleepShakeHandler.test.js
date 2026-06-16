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
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

import { handle, handleConfirm } from './sleepShakeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', level: 10, proficiency: 4, abilities: [], ...overrides };
}

function makeAction(automation = {}) {
  return { name: 'Shake Asleep', automation: { range: '5 ft', ...automation } };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', conditions: [{ key: 'incapacitated' }, { key: 'unconscious' }] },
    { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('sleepShakeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
    });
  });

  describe('target filtering', () => {
    it('should prioritize sleep targets over eligible targets', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targets).toEqual(['Goblin']);
    });

    it('should return eligible targets when no sleep targets', async () => {
      const combatNoSleep = {
        creatures: [
          { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(combatNoSleep);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targets).toContain('Orc');
    });

    it('should exclude the caster from targets', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).not.toContain('TestCaster');
    });

    it('should return popup when no eligible targets', async () => {
      const emptyCombat = { creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }] };
      getCombatContext.mockResolvedValue(emptyCombat);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No eligible targets');
    });

    it('should return modal with correct payload', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('sleepShake');
      expect(result.payload.attackerName).toBe('TestCaster');
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.rangeFeet).toBe(5);
    });

    it('should use custom feature name from action', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle({ name: 'Custom Shake', automation: { range: '5 ft' } }, makePlayerStats(), campaignName, null);

      expect(result.payload.featureName).toBe('Custom Shake');
    });

    it('should default feature name to Shake Asleep', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle({ automation: { range: '5 ft' } }, makePlayerStats(), campaignName, null);

      expect(result.payload.featureName).toBe('Shake Asleep');
    });
  });

  describe('range filtering', () => {
    it('should filter targets by range when positions are available', async () => {
      const combatWithPlayer = {
        creatures: [
          { name: 'Ally', type: 'player', conditions: [] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'Ally', gridX: 15, gridY: 20 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(combatWithPlayer);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 5, gridY: 10 },
        mapData: { players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'Ally', gridX: 15, gridY: 20 }] },
      });
      getDistanceFeet.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No eligible targets');
    });
  });

  describe('player type targets', () => {
    it('should check runtime conditions for player type creatures', async () => {
      const combatWithPlayer = {
        creatures: [
          { name: 'Ally', type: 'player', conditions: [] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(combatWithPlayer);
      rangeToFeet.mockReturnValue(5);
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeConditions' && name === 'Ally') return ['unconscious'];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toContain('Ally');
    });
  });
});

describe('sleepShakeHandler.handleConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no targetName', async () => {
    const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, null, null);
    expect(result).toBeNull();
  });

  it('should remove incapacitated and unconscious for player type', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally', type: 'player', conditions: [] }],
    });
    getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious']);

    const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, null, 'Ally');

    expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'activeConditions', [], campaignName);
    expect(result.type).toBe('popup');
  });

  it('should remove incapacitated and unconscious from creature conditions', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster', conditions: [{ key: 'incapacitated' }, { key: 'unconscious' }, { key: 'frightened' }] }],
    });

    const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, null, 'Goblin');

    expect(result.type).toBe('popup');
    expect(postLogEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ type: 'condition', action: 'removed', characterName: 'Goblin' }),
    );
  });

  it('should log ability_use entry', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster', conditions: [{ key: 'incapacitated' }] }],
    });

    await handleConfirm(makeAction(), makePlayerStats(), campaignName, null, 'Goblin');

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Shake Asleep',
        targetName: 'Goblin',
      }),
    );
  });

  it('should return popup with success message', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster', conditions: [{ key: 'incapacitated' }] }],
    });

    const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, null, 'Goblin');

    expect(result.payload.description).toContain('no longer affected by Sleep');
  });
});
