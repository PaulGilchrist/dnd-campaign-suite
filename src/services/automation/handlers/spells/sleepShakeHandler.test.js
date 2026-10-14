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
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';
const mapName = 'test-map';

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

describe('sleepShakeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    describe('combat context validation', () => {
      it('returns popup when no combat context exists', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No combat context found');
      });

      it('returns popup when combat context has no creatures', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No eligible targets');
      });
    });

    describe('target selection — no map', () => {
      it('prefers sleep targets (incapacitated/unconscious) over eligible targets', async () => {
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

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('falls back to eligible targets when no sleep targets exist', async () => {
        getCombatContext.mockResolvedValue(baseCombatContext);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });

      it('returns popup with no eligible targets when only caster exists', async () => {
        const onlyCasterContext = {
          creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(onlyCasterContext);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No eligible targets');
      });

      it('skips caster from eligible targets', async () => {
        getCombatContext.mockResolvedValue(baseCombatContext);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.targets).not.toContain('TestCaster');
      });
    });

    describe('target selection — with map', () => {
      it('filters eligible targets by range when map positions are available', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'Orc', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        isWithinRange.mockImplementation(async (src, tgt, _range) => {
          if (tgt === 'Goblin') return true;
          if (tgt === 'Orc') return false;
          return true;
        });
        resolveMapPositions.mockResolvedValue({
          attackerPos: { gridX: 5, gridY: 10 },
          mapData: {
            players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
            placedItems: [
              { name: 'Goblin', gridX: 6, gridY: 10 },
              { name: 'Orc', gridX: 8, gridY: 10 },
            ],
          },
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('looks up target positions from placedItems on map', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'Orc', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        isWithinRange.mockResolvedValue(true);
        resolveMapPositions.mockResolvedValue({
          attackerPos: { gridX: 5, gridY: 10 },
          mapData: {
            players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
            placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
          },
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });

      it('looks up target positions from players on map', async () => {
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
        isWithinRange.mockResolvedValue(true);
        resolveMapPositions.mockResolvedValue({
          attackerPos: { gridX: 5, gridY: 10 },
          mapData: {
            players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
            placedItems: [],
          },
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['AllyPlayer', 'Orc']);
      });

      it('skips distance check when target has no position data', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'Orc', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        isWithinRange.mockResolvedValue(true);
        resolveMapPositions.mockResolvedValue({
          attackerPos: { gridX: 5, gridY: 10 },
          mapData: {
            players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
            placedItems: [],
          },
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });
    });
  });
});
