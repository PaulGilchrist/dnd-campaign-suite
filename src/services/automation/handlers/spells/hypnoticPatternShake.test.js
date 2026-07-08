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

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handle, handleConfirm } from './hypnoticPatternShake.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
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
    name: 'Shake Out Stupor',
    automation: {
      type: 'hypnotic_pattern_shake',
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

describe('hypnoticPatternShake', () => {
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

      it('returns popup with no eligible targets when combat context has no creatures', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No eligible targets');
      });
    });

    describe('target selection — no map', () => {
      it('skips caster, returns all other creatures as eligible', async () => {
        getCombatContext.mockResolvedValue(baseCombatContext);
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('hypnoticPatternShake');
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

      it('prefers hypno-targets (charmed/incapacitated) over eligible targets', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster', conditions: [{ key: 'charmed' }] },
            { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('falls back to eligible targets when no hypno-targets exist', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster', conditions: [] },
            { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });
    });

    describe('target selection — with map', () => {
      it('filters targets by range when map positions are available', async () => {
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
        rangeToFeet.mockReturnValue(10);
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

        // Goblin at (6, 10) = 5 ft, within range
        // Orc at (8, 10) = 15 ft, out of range
        getDistanceFeet.mockImplementation((p1, p2) => {
          const dx = p2.gridX - p1.gridX;
          const dy = p2.gridY - p1.gridY;
          return Math.sqrt(dx * dx + dy * dy) * 5;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('looks up target positions from players and placedItems on map', async () => {
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
        rangeToFeet.mockReturnValue(Infinity);
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
        rangeToFeet.mockReturnValue(10);
        // Only attacker has position, Goblin has none
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

    describe('modal payload', () => {
      it('returns correct modal payload structure', async () => {
        getCombatContext.mockResolvedValue(baseCombatContext);
        rangeToFeet.mockReturnValue(5);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('hypnoticPatternShake');
        expect(result.payload.attackerName).toBe('TestCaster');
        expect(result.payload.campaignName).toBe(campaignName);
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
        expect(result.payload.rangeFeet).toBe(5);
        expect(result.payload.featureName).toBe('Shake Out Stupor');
      });

      it('uses action name when provided', async () => {
        getCombatContext.mockResolvedValue(baseCombatContext);
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);

        const action = makeAction();
        action.name = 'Custom Shake';
        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.payload.featureName).toBe('Custom Shake');
      });

      it('handles default range string conversion', async () => {
        getCombatContext.mockResolvedValue(baseCombatContext);
        rangeToFeet.mockReturnValue(5);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(rangeToFeet).toHaveBeenCalledWith('5 ft');
        expect(result.payload.rangeFeet).toBe(5);
      });
    });

    describe('hypno-target detection for player creatures', () => {
      it('identifies player creatures with charmed/incapacitated conditions via runtime store', async () => {
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
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['charmed', 'frightened']);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toEqual(['AllyPlayer']);
      });

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
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['incapacitated', 'poisoned']);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.targets).toEqual(['AllyPlayer']);
      });

      it('does not select player creatures without charmed/incapacitated', async () => {
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
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.targets).toEqual(['AllyPlayer', 'Orc']);
      });
    });

    describe('hypno-target detection for monster creatures', () => {
      it('identifies monsters with charmed condition from conditions array', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster', conditions: [{ key: 'charmed' }] },
            { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.targets).toEqual(['Goblin']);
      });

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
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('handles case-insensitive condition matching', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster', conditions: [{ key: 'CHARMED' }] },
            { name: 'Orc', type: 'monster', conditions: [{ key: 'Incapacitated' }] },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });

      it('handles string conditions array for monsters — string conditions do not match because code expects cond.key', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster', conditions: ['charmed'] },
            { name: 'Orc', type: 'monster', conditions: ['frightened'] },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        rangeToFeet.mockReturnValue(null);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        // Code accesses cond.key which is undefined for strings, so 'charmed' string does not match
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });
    });
  });

  describe('handleConfirm', () => {
    describe('player creature target', () => {
      it('removes charmed, incapacitated, and speed_zero from player conditions', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'AllyPlayer',
          'activeConditions',
          ['poisoned'],
          campaignName,
        );
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('AllyPlayer is no longer affected by Hypnotic Pattern');
      });

      it('does not modify conditions when none of charmed/incapacitated/speed_zero are present', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });

      it('logs condition removal entries for charmed and incapacitated when removed', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'AllyPlayer',
            condition: 'Charmed',
            reason: 'Shake Out Stupor (Hypnotic Pattern)',
          }),
        );
        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'AllyPlayer',
            condition: 'Incapacitated',
            reason: 'Shake Out Stupor (Hypnotic Pattern)',
          }),
        );
        expect(result.type).toBe('popup');
      });

      it('logs condition removal for any of the 3 target conditions not in filtered array (player path)', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['charmed', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        // Player path: loop logs for charmed, incapacitated, speed_zero if NOT in filtered
        // filtered = ['poisoned'], so charmed is removed (logged), incapacitated not in original but still logged, speed_zero not in original but still logged
        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'AllyPlayer',
            condition: 'Charmed',
          }),
        );
        // Incapacitated is logged because it's not in filtered (even though it wasn't in original)
        const incapCalls = addEntry.mock.calls.filter(
          (call) => call[1]?.condition === 'Incapacitated',
        );
        expect(incapCalls.length).toBe(1);
        expect(result.type).toBe('popup');
      });

      it('logs ability_use entry for player target', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['charmed']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestCaster',
            abilityName: 'Shake Out Stupor',
            description: expect.stringContaining('TestCaster used an action to shake AllyPlayer out of its hypnotic stupor'),
            targetName: 'AllyPlayer',
          }),
        );
      });

      it('handles empty conditions array for player', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue([]);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });

      it('handles null conditions for player', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(null);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });
    });

    describe('handleConfirm — monster creature target', () => {
      it('removes charmed, incapacitated, and speed_zero from monster conditions', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Goblin',
          'activeConditions',
          ['poisoned'],
          campaignName,
        );
        expect(result.type).toBe('popup');
      });

      it('does not modify conditions when none of charmed/incapacitated/speed_zero are present', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });

      it('logs condition removal entries for monsters', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'Goblin',
            condition: 'Charmed',
            reason: 'Shake Out Stupor (Hypnotic Pattern)',
          }),
        );
        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'Goblin',
            condition: 'Incapacitated',
            reason: 'Shake Out Stupor (Hypnotic Pattern)',
          }),
        );
        expect(result.type).toBe('popup');
      });

      it('logs ability_use entry for monster target', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['charmed']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestCaster',
            abilityName: 'Shake Out Stupor',
            targetName: 'Goblin',
          }),
        );
      });

      it('handles empty conditions array for monster', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue([]);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });
    });

    describe('handleConfirm — edge cases', () => {
      it('returns null when no targetName provided', async () => {
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, null);

        expect(result).toBeNull();
      });

      it('returns null when targetName is empty string', async () => {
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, '');

        expect(result).toBeNull();
      });

      it('still returns popup when creature not found in combat context', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'NonExistent');

        // handleConfirm always returns popup when targetName is provided, even if creature not found
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('NonExistent is no longer affected');
      });

      it('still returns popup when combat context is missing', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        // handleConfirm always returns popup when targetName is provided
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Goblin is no longer affected');
      });

      it('still returns popup when creatures array is missing in combat context', async () => {
        getCombatContext.mockResolvedValue({});

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Goblin is no longer affected');
      });
    });
  });
});
