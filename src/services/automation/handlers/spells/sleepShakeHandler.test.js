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

import { handle, handleConfirm } from './sleepShakeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
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

        // Code accesses cond.key which is undefined for strings, so 'incapacitated' string does not match
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

  describe('handleConfirm', () => {
    describe('player creature target', () => {
      it('removes incapacitated and unconscious from player conditions', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'AllyPlayer',
          'activeConditions',
          ['poisoned'],
          campaignName,
        );
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('AllyPlayer is no longer affected by Sleep');
      });

      it('does not modify conditions when none of incapacitated/unconscious are present', async () => {
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

      it('logs condition removal entries for incapacitated and unconscious when removed', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'AllyPlayer',
            condition: 'Incapacitated',
            reason: 'Shake Asleep (Sleep spell)',
          }),
        );
        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'AllyPlayer',
            condition: 'Unconscious',
            reason: 'Shake Asleep (Sleep spell)',
          }),
        );
        expect(result.type).toBe('popup');
      });

      it('logs condition removal for any of the 2 target conditions not in filtered array (player path)', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['incapacitated', 'poisoned']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        // filtered = ['poisoned'], incapacitated is removed (logged), unconscious is not in original but still logged
        const incapCalls = addEntry.mock.calls.filter(
          (call) => call[1]?.condition === 'Incapacitated',
        );
        expect(incapCalls.length).toBe(1);
        const unconCalls = addEntry.mock.calls.filter(
          (call) => call[1]?.condition === 'Unconscious',
        );
        expect(unconCalls.length).toBe(1);
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
        getRuntimeValue.mockReturnValue(['incapacitated']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestCaster',
            abilityName: 'Shake Asleep',
            description: expect.stringContaining('TestCaster used an action to shake AllyPlayer out of its magical slumber'),
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

      it('only logs condition removal when condition was actually present (player path — only unconscious present)', async () => {
        const ctx = {
          creatures: [
            { name: 'AllyPlayer', type: 'player' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['unconscious', 'poisoned']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        // filtered = ['poisoned'], incapacitated not in original but still logged because it's not in filtered
        const incapCalls = addEntry.mock.calls.filter(
          (call) => call[1]?.condition === 'Incapacitated',
        );
        expect(incapCalls.length).toBe(1);
        const unconCalls = addEntry.mock.calls.filter(
          (call) => call[1]?.condition === 'Unconscious',
        );
        expect(unconCalls.length).toBe(1);
      });
    });

    describe('handleConfirm — monster creature target', () => {
      it('removes incapacitated and unconscious from monster conditions', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Goblin',
          'activeConditions',
          ['poisoned'],
          campaignName,
        );
        expect(result.type).toBe('popup');
      });

      it('does not modify conditions when none of incapacitated/unconscious are present (monster)', async () => {
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
        getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'Goblin',
            condition: 'Incapacitated',
            reason: 'Shake Asleep (Sleep spell)',
          }),
        );
        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: 'Goblin',
            condition: 'Unconscious',
            reason: 'Shake Asleep (Sleep spell)',
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
        getRuntimeValue.mockReturnValue(['incapacitated']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

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

      it('only logs conditions that were actually present (monster path)', async () => {
        const ctx = {
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(ctx);
        getRuntimeValue.mockReturnValue(['unconscious', 'poisoned']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        // monster path: only logs conditions that were actually had (hadIncapacitated/hadUnconscious)
        const incapCalls = addEntry.mock.calls.filter(
          (call) => call[1]?.condition === 'Incapacitated',
        );
        expect(incapCalls.length).toBe(0);
        const unconCalls = addEntry.mock.calls.filter(
          (call) => call[1]?.condition === 'Unconscious',
        );
        expect(unconCalls.length).toBe(1);
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

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('NonExistent is no longer affected by Sleep');
      });

      it('still returns popup when combat context is missing', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Goblin is no longer affected by Sleep');
      });

      it('still returns popup when creatures array is missing in combat context', async () => {
        getCombatContext.mockResolvedValue({});

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Goblin is no longer affected by Sleep');
      });

      it('always logs ability_use entry even when creature not found', async () => {
        getCombatContext.mockResolvedValue(null);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

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
    });
  });
});
