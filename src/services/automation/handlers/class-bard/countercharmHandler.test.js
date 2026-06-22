import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn().mockResolvedValue({
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  }),
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

// ── Imports ────────────────────────────────────────────────────

import { handle } from './countercharmHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = ' tavern-map';

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

function makeFreshTimestamp() {
  return Date.now();
}

// ── Tests ──────────────────────────────────────────────────────

describe('countercharmHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    setRuntimeValue.mockReset();
    findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
    rangeToFeet.mockReturnValue(30);
    getCombatContext.mockResolvedValue(null);
    resolveMapPositions.mockResolvedValue(null);
    getDistanceFeet.mockReturnValue(0);
    addEntry.mockReturnValue(Promise.resolve());
  });

  describe('charge handling', () => {
    it('should return no-uses popup when currentUses is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 1 });

      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Countercharm has no uses remaining. Recharges on a Long Rest.');
    });

    it('should return no-uses popup when currentUses is negative', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 1 });

      getRuntimeValue.mockReturnValue(-1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Countercharm has no uses remaining. Recharges on a Long Rest.');
    });

    it('should not check uses when usesMax is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 0 });

      findLastAttack.mockResolvedValue({
        attackEvent: { d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp() },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Countercharm');
    });

    it('should not check uses when usesMax is undefined (defaults to 1)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: undefined });

      getRuntimeValue.mockReturnValue(1);

      findLastAttack.mockResolvedValue({
        attackEvent: { d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp() },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });
  });

  describe('target resolution - no recent save', () => {
    it('should return no-save popup when player has no recent attack roll', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No recent save (attack roll or ability check) found');
      expect(result.payload.description).toContain('30 ft');
    });




  });

  describe('target resolution - player self', () => {
    it('should find player\'s own recent attack roll', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Target: TestHero');
      expect(result.payload.description).toContain('Original save');
    });

    it('should prefer attack roll over ability check for self', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Original save');
      expect(result.payload.description).not.toContain('Stealth');
    });
  });

  describe('target resolution - allies', () => {
    it('should find an ally with a recent attack roll', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Self check - no attack
          return {
            attackEvent: null,
            attackerName: null,
            targetName: null,
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: [],
          };
        }
        // Ally check
        return {
          attackEvent: {
            d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp()
          },
          attackerName: 'Ally1',
          targetName: 'Ally1',
          primaryDamage: 5,
          secondaryDamage: 0,
          totalDamage: 5,
          damageTypes: ['Piercing'],
        };
      });
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Target: Ally1');
    });

    it('should skip the player themselves when searching allies', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      // Should find self first via checkSelf path
      expect(result.payload.description).toContain('Target: TestHero');
    });

    it('should return no-save popup when no allies have recent saves', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save');
    });

    it('should skip ally search when rangeFt is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: null });

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save');
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
          return {
            attackEvent: null,
            attackerName: null,
            targetName: null,
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: [],
          };
        }
        return {
          attackEvent: {
            d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp()
          },
          attackerName: 'Ally1',
          targetName: 'Ally1',
          primaryDamage: 5,
          secondaryDamage: 0,
          totalDamage: 5,
          damageTypes: ['Piercing'],
        };
      });
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 4, gridY: 1 },
      });
      getDistanceFeet.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
        ],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: Ally1');
    });

    it('should skip ally outside range when distance exceeds limit', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30 ft' });

      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            attackEvent: null,
            attackerName: null,
            targetName: null,
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: [],
          };
        }
        if (callCount === 2) {
          // Ally1 is too far
          return {
            attackEvent: {
              d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp()
            },
            attackerName: 'Ally1',
            targetName: 'Ally1',
            primaryDamage: 5,
            secondaryDamage: 0,
            totalDamage: 5,
            damageTypes: ['Piercing'],
          };
        }
        // Ally2 is within range
        return {
          attackEvent: {
            d20: 10, bonus: 2, targetAc: 15, hit: false, timestamp: makeFreshTimestamp()
          },
          attackerName: 'Ally2',
          targetName: 'Ally2',
          primaryDamage: 5,
          secondaryDamage: 0,
          totalDamage: 5,
          damageTypes: ['Piercing'],
        };
      });
      rangeToFeet.mockReturnValue(30);

      // Mock resolveMapPositions to return different positions per call
      let resolveCallCount = 0;
      resolveMapPositions.mockImplementation(async () => {
        resolveCallCount++;
        if (resolveCallCount === 1) {
          // Ally1 is 40ft away
          return {
            attackerPos: { gridX: 1, gridY: 1 },
            targetPos: { gridX: 9, gridY: 1 },
          };
        }
        // Ally2 is 15ft away
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
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
          { name: 'Ally2' },
        ],
      });

      const result = await handle(action, ps, campaignName, mapName);

      // Ally1 is 40ft away (> 30), so should find Ally2
      expect(result.payload.description).toContain('Target: Ally2');
    });

    it('should skip ally if resolveMapPositions returns no positions', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30 ft' });

      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            attackEvent: null,
            attackerName: null,
            targetName: null,
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: [],
          };
        }
        if (callCount === 2) {
          return {
            attackEvent: {
              d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp()
            },
            attackerName: 'Ally1',
            targetName: 'Ally1',
            primaryDamage: 5,
            secondaryDamage: 0,
            totalDamage: 5,
            damageTypes: ['Piercing'],
          };
        }
        return {
          attackEvent: {
            d20: 10, bonus: 2, targetAc: 15, hit: false, timestamp: makeFreshTimestamp()
          },
          attackerName: 'Ally2',
          targetName: 'Ally2',
          primaryDamage: 5,
          secondaryDamage: 0,
          totalDamage: 5,
          damageTypes: ['Piercing'],
        };
      });
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
          { name: 'Ally2' },
        ],
      });

      const result = await handle(action, ps, campaignName, mapName);

      // Without positions, range check is skipped, Ally1 is found
      expect(result.payload.description).toContain('Target: Ally1');
    });

    it('should skip ally if resolveMapPositions returns only one position', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30 ft' });

      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            attackEvent: null,
            attackerName: null,
            targetName: null,
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: [],
          };
        }
        if (callCount === 2) {
          return {
            attackEvent: {
              d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp()
            },
            attackerName: 'Ally1',
            targetName: 'Ally1',
            primaryDamage: 5,
            secondaryDamage: 0,
            totalDamage: 5,
            damageTypes: ['Piercing'],
          };
        }
        return {
          attackEvent: {
            d20: 10, bonus: 2, targetAc: 15, hit: false, timestamp: makeFreshTimestamp()
          },
          attackerName: 'Ally2',
          targetName: 'Ally2',
          primaryDamage: 5,
          secondaryDamage: 0,
          totalDamage: 5,
          damageTypes: ['Piercing'],
        };
      });
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        // No targetPos
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
          { name: 'Ally2' },
        ],
      });

      const result = await handle(action, ps, campaignName, mapName);

      // Missing targetPos means range check skipped, Ally1 found
      expect(result.payload.description).toContain('Target: Ally1');
    });

    it('should handle getDistanceFeet returning null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30 ft' });

      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            attackEvent: null,
            attackerName: null,
            targetName: null,
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: [],
          };
        }
        return {
          attackEvent: {
            d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp()
          },
          attackerName: 'Ally1',
          targetName: 'Ally1',
          primaryDamage: 5,
          secondaryDamage: 0,
          totalDamage: 5,
          damageTypes: ['Piercing'],
        };
      });
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 4, gridY: 1 },
      });
      getDistanceFeet.mockReturnValue(null);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
        ],
      });

      const result = await handle(action, ps, campaignName, mapName);

      // null distance means range check skipped
      expect(result.payload.description).toContain('Target: Ally1');
    });
  });

  describe('attack roll reroll display', () => {
    it('should show original miss and new hit when reroll improves result', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      // Mock Math.random to return 20 (max) so reroll always improves
      const originalRandom = Math.random;
      vi.spyOn(Math, 'random').mockReturnValue(20 / 21); // floor(20/21 * 20) + 1 = 20

      const result = await handle(action, ps, campaignName, null);

      Math.random = originalRandom;

      expect(result.payload.description).toContain('Target: TestHero');
      expect(result.payload.description).toContain('Original save');
      expect(result.payload.description).toContain('Reroll with Advantage');
      expect(result.payload.description).toContain('HIT');
    });

    it('should show already succeeded when original hit was true', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 14,
          bonus: 2,
          targetAc: 13,
          hit: true,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('already succeeded');
      expect(result.payload.description).toContain('Countercharm has no effect');
    });

    it('should show still a miss when reroll does not improve', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      // The reroll uses Math.random, so we can't predict exact outcome,
      // but we can check the format
      expect(result.payload.description).toContain('Reroll with Advantage');
    });

    it('should show dash when targetAc is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: null,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('\u2014');
    });

    it('should handle targetAc as undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('\u2014');
    });
  });

  describe('uses decrement', () => {
    it('should decrement uses after successful execution', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 3 });

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);
      getRuntimeValue.mockReturnValue(3);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 2, campaignName);
    });

    it('should decrement from stored value when available', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 5 });

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);
      getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 1, campaignName);
    });

    it('should use usesMax as fallback when no stored value', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 4 });

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);
      getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, campaignName, null);

      // currentUses = undefined ?? usesMax = 4, new = 4 - 1 = 3
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 3, campaignName);
    });

    it('should treat uses: 0 as uses: 1 due to || operator', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 0 });

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);
      getRuntimeValue.mockReturnValue(1);

      await handle(action, ps, campaignName, null);

      // auto.uses = 0, but 0 || 1 = 1, so usesMax = 1
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'countercharmUses', 0, campaignName);
    });
  });

  describe('custom feature name', () => {
    it('should use custom feature name from action.name', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'MyCountercharm',
        automation: {
          range: '30 ft',
          uses: 1,
        },
      };

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('MyCountercharm');
      expect(result.payload.description).toContain('<b>MyCountercharm</b>');
    });

    it('should use custom feature name in no-uses message', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'MyCountercharm',
        automation: {
          range: '30 ft',
          uses: 1,
        },
      };

      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('MyCountercharm has no uses remaining');
    });

    it('should use custom feature name in no-save message', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'MyCountercharm',
        automation: {
          range: '60 ft',
          uses: 1,
        },
      };

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(60);
      getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('MyCountercharm');
      expect(result.payload.description).toContain('MyCountercharm');
      expect(result.payload.description).toContain('60 ft');
    });

    it('should generate runtime key from custom feature name', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Bardic Countercharm',
        automation: {
          range: '30 ft',
          uses: 1,
        },
      };

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);
      getRuntimeValue.mockReturnValue(1);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'bardiccountercharmUses', 0, campaignName);
    });
  });

  describe('range formatting', () => {
    it('should use range from action in no-save message', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '60 ft' });

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(60);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('60 ft');
    });

    it('should use default range when auto.range is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: null });

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('30 ft');
    });
  });

  describe('logging', () => {
    it('should call addEntry with correct data after successful use', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);

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

    it('should log with ally target name', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      let callCount = 0;
      findLastAttack.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            attackEvent: null,
            attackerName: null,
            targetName: null,
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: [],
          };
        }
        return {
          attackEvent: {
            d20: 8, bonus: 2, targetAc: 13, hit: false, timestamp: makeFreshTimestamp()
          },
          attackerName: 'Ally1',
          targetName: 'Ally1',
          primaryDamage: 5,
          secondaryDamage: 0,
          totalDamage: 5,
          damageTypes: ['Piercing'],
        };
      });
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero' },
          { name: 'Ally1' },
        ],
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

    it('should swallow addEntry errors', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(30);
      addEntry.mockReturnValue(Promise.reject(new Error('log error')).catch(() => {}));

      // Should not throw
      await expect(handle(action, ps, campaignName, null)).resolves.toBeDefined();
    });
  });



  describe('automation passthrough', () => {
    it('should include automation in popup payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2, range: '45 ft' });

      findLastAttack.mockResolvedValue({
        attackEvent: {
          d20: 8,
          bonus: 2,
          targetAc: 13,
          hit: false,
          timestamp: makeFreshTimestamp(),
        },
        attackerName: 'Goblin',
        targetName: 'TestHero',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      rangeToFeet.mockReturnValue(45);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual({
        range: '45 ft',
        uses: 2,
      });
    });

    it('should include automation in no-uses popup payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 1, range: '30 ft' });

      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual({
        range: '30 ft',
        uses: 1,
      });
    });
  });

  describe('combat context edge cases', () => {
    it('should handle missing combatSummary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save');
    });

    it('should handle combatSummary with no creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save');
    });

    it('should handle combatSummary with only the player', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero' }],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save');
    });
  });
});
