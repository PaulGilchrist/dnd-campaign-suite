// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './countercharmHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'tavern-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Countercharm',
    automation: {
      range: '30 ft',
      uses: 1,
      ...automation,
    },
  };
}

function makeAttackResult(overrides = {}) {
  return {
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
    ...overrides,
  };
}

function makeAttackEvent(overrides = {}) {
  return {
    d20: 8,
    bonus: 2,
    targetAc: 13,
    hit: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('countercharmHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    findLastAttack.mockResolvedValue(makeAttackResult());
    rangeToFeet.mockReturnValue(30);
    getCombatContext.mockResolvedValue(null);
    resolveMapPositions.mockResolvedValue(null);
    getDistanceFeet.mockReturnValue(0);
  });

  describe('charge handling', () => {
    it('should return popup when uses are exhausted', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Countercharm');
      expect(result.payload.description).toContain('no uses remaining');
      expect(result.payload.description).toContain('Recharges on a Long Rest');
      expect(result.payload.automation).toEqual({ range: '30 ft', uses: 1 });
    });

    it('should skip use check when usesMax is 0 (infinite uses)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 0 });
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ d20: 8, targetAc: 13, hit: false }),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Countercharm');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, campaignName);
    });
  });

  describe('target resolution', () => {
    it('should return popup when no recent save is found for player or allies', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult());
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save');
      expect(result.payload.description).toContain('30 ft');
    });

    it('should find player\'s own failed save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ d20: 8, targetAc: 13, hit: false }),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Target: TestHero');
      expect(result.payload.description).toContain('Original save');
    });
  });

  describe('ally target resolution', () => {
    it('should search allies when player has no recent save and range is valid', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return makeAttackResult();
        }
        return makeAttackResult({
          attackEvent: makeAttackEvent(),
          attackerName: 'Ally1',
          targetName: 'Ally1',
        });
      });
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero' }, { name: 'Ally1' }],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Target: Ally1');
    });

    it('should skip ally search when range is falsy or combat context is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: null });
      findLastAttack.mockResolvedValue(makeAttackResult());
      rangeToFeet.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save');

      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue(undefined);
      findLastAttack.mockResolvedValue(makeAttackResult());
      getCombatContext.mockResolvedValue(null);

      const result2 = await handle(action, ps, campaignName, null);

      expect(result2.type).toBe('popup');
      expect(result2.payload.description).toContain('No recent save');
    });
  });

  describe('range filtering for allies', () => {
    it('should include ally within range', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30 ft' });
      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return makeAttackResult();
        }
        return makeAttackResult({
          attackEvent: makeAttackEvent(),
          attackerName: 'Ally1',
          targetName: 'Ally1',
        });
      });
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 4, gridY: 1 },
      });
      getDistanceFeet.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero' }, { name: 'Ally1' }],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: Ally1');
    });

    it('should skip ally outside range and find next eligible ally', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30 ft' });
      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return makeAttackResult();
        }
        if (callCount === 2) {
          return makeAttackResult({
            attackEvent: makeAttackEvent(),
            attackerName: 'Ally1',
            targetName: 'Ally1',
          });
        }
        return makeAttackResult({
          attackEvent: makeAttackEvent({ d20: 10, targetAc: 15 }),
          attackerName: 'Ally2',
          targetName: 'Ally2',
        });
      });
      let resolveCallCount = 0;
      resolveMapPositions.mockImplementation(async () => {
        resolveCallCount++;
        if (resolveCallCount === 1) {
          return {
            attackerPos: { gridX: 1, gridY: 1 },
            targetPos: { gridX: 9, gridY: 1 },
          };
        }
        return {
          attackerPos: { gridX: 1, gridY: 1 },
          targetPos: { gridX: 4, gridY: 1 },
        };
      });
      getDistanceFeet.mockImplementation((pos1, pos2) => {
        const dx = Math.abs(pos2.gridX - pos1.gridX) * 5;
        const dy = Math.abs(pos2.gridY - pos1.gridY) * 5;
        return Math.sqrt(dx * dx + dy * dy);
      });
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero' }, { name: 'Ally1' }, { name: 'Ally2' }],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: Ally2');
    });

    it('should skip ally if map positions are missing or distance is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30 ft' });
      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return makeAttackResult();
        }
        if (callCount === 2) {
          return makeAttackResult({
            attackEvent: makeAttackEvent(),
            attackerName: 'Ally1',
            targetName: 'Ally1',
          });
        }
        return makeAttackResult({
          attackEvent: makeAttackEvent(),
          attackerName: 'Ally2',
          targetName: 'Ally2',
        });
      });
      resolveMapPositions.mockResolvedValue(null);
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero' }, { name: 'Ally1' }, { name: 'Ally2' }],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: Ally1');

      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue(undefined);
      findLastAttack.mockResolvedValue(makeAttackResult());
      getCombatContext.mockResolvedValue(null);

      const result2 = await handle(action, ps, campaignName, null);

      expect(result2.type).toBe('popup');
      expect(result2.payload.description).toContain('No recent save');
    });
  });

  describe('attack roll reroll display', () => {
    it('should display original miss and reroll result with advantage', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ d20: 8, targetAc: 13, hit: false }),
        targetName: 'TestHero',
      }));
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Target: TestHero');
      expect(result.payload.description).toContain('Original save: d20(8)');
      expect(result.payload.description).toContain('Reroll with Advantage');
    });
  });

  describe('uses decrement', () => {
    it('should decrement uses from stored value, falling back to usesMax when no stored value', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 3 });
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ hit: false }),
        targetName: 'TestHero',
      }));
      rangeToFeet.mockReturnValue(30);
      getRuntimeValue.mockReturnValue(3);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 2, campaignName);
    });

    it('should decrement from stored value when lower than usesMax', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 5 });
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ hit: false }),
        targetName: 'TestHero',
      }));
      getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 1, campaignName);
    });

    it('should use usesMax as fallback when no stored value exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 4 });
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ hit: false }),
        targetName: 'TestHero',
      }));
      getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 3, campaignName);
    });
  });

  describe('custom feature name', () => {
    it('should use custom name in popup, description, and runtime key', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Bardic Countercharm',
        automation: { range: '30 ft', uses: 1 },
      };
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ hit: false }),
        targetName: 'TestHero',
      }));
      getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Bardic Countercharm');
      expect(result.payload.description).toContain('<b>Bardic Countercharm</b>');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'bardiccountercharmUses', 0, campaignName);
    });

    it('should use custom name in no-uses message', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'MyCountercharm',
        automation: { range: '30 ft', uses: 1 },
      };
      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('MyCountercharm has no uses remaining');
    });
  });

  describe('logging', () => {
    it('should log ability use with correct data for self target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ hit: false }),
        targetName: 'TestHero',
      }));

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Countercharm',
        description: 'TestHero used Countercharm on TestHero.',
        targetName: 'TestHero',
        timestamp: expect.any(Number),
      });
    });

    it('should log ability use with ally target name', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return makeAttackResult();
        }
        return makeAttackResult({
          attackEvent: makeAttackEvent(),
          attackerName: 'Ally1',
          targetName: 'Ally1',
        });
      });
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero' }, { name: 'Ally1' }],
      });

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Countercharm',
        description: 'TestHero used Countercharm on Ally1.',
        targetName: 'Ally1',
        timestamp: expect.any(Number),
      });
    });
  });
});
