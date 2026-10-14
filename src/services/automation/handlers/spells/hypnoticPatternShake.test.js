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

import { handle, handleConfirm } from './hypnoticPatternShake.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', ...overrides };
}

function makeAction(automation = {}) {
  return {
    name: 'Shake Out Stupor',
    automation: { type: 'hypnotic_pattern_shake', range: '5 ft', ...automation },
  };
}

function baseCtx(extraCreatures = []) {
  return {
    creatures: [
      { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      { name: 'TestCaster', gridX: 5, gridY: 10 },
      ...extraCreatures,
    ],
    players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
    placedItems: [],
  };
}

function playerCtx(allyName = 'AllyPlayer') {
  return {
    creatures: [
      { name: allyName, type: 'player' },
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: allyName, gridX: 6, gridY: 10 }],
    placedItems: [],
  };
}

function monsterCtx(mName = 'Goblin') {
  return {
    creatures: [{ name: mName, type: 'monster' }, { name: 'TestCaster', gridX: 5, gridY: 10 }],
    players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
    placedItems: [],
  };
}

function mockNoMap() {
  getCombatContext.mockResolvedValue(baseCtx());
  resolveMapPositions.mockResolvedValue(null);
}

function expectPopup(result, descContains) {
  expect(result.type).toBe('popup');
  if (descContains) expect(result.payload.description).toContain(descContains);
}

function expectModal(result, targets, featureName) {
  expect(result.type).toBe('modal');
  expect(result.modalName).toBe('hypnoticPatternShake');
  if (targets !== undefined) expect(result.payload.targets).toEqual(targets);
  if (featureName !== undefined) expect(result.payload.featureName).toBe(featureName);
}

describe('hypnoticPatternShake', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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
        mockNoMap();
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectModal(result, ['Goblin', 'Orc']);
      });

      it('returns popup with no eligible targets when only caster exists', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        });
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectPopup(result, 'No eligible targets');
      });

      it('prefers hypno-targets (charmed/incapacitated) over eligible targets', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [
            { name: 'Goblin', type: 'monster', conditions: [{ key: 'charmed' }] },
            { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        });
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectModal(result, ['Goblin']);
      });

      it('falls back to eligible targets when no hypno-targets exist', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [
            { name: 'Goblin', type: 'monster', conditions: [] },
            { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        });
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expectModal(result, ['Goblin', 'Orc']);
      });
    });

    describe('target selection — with map', () => {
      it('filters targets by range when map positions are available', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'Orc', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        });
        isWithinRange.mockImplementation(async (_, tgt) => tgt === 'Goblin' ? true : false);
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
        expectModal(result, ['Goblin']);
      });

      it('looks up target positions from players and placedItems on map', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'Orc', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        });
        isWithinRange.mockResolvedValue(true);
        resolveMapPositions.mockResolvedValue({
          attackerPos: { gridX: 5, gridY: 10 },
          mapData: {
            players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
            placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
          },
        });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expectModal(result, ['Goblin', 'Orc']);
      });

      it('skips distance check when target has no position data', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [
            { name: 'Goblin', type: 'monster' },
            { name: 'Orc', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        });
        isWithinRange.mockResolvedValue(true);
        resolveMapPositions.mockResolvedValue({
          attackerPos: { gridX: 5, gridY: 10 },
          mapData: {
            players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
            placedItems: [],
          },
        });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expectModal(result, ['Goblin', 'Orc']);
      });
    });

    describe('modal payload', () => {
      it('returns correct modal payload structure', async () => {
        mockNoMap();
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.attackerName).toBe('TestCaster');
        expect(result.payload.campaignName).toBe(campaignName);
        expect(result.payload.rangeFeet).toBe(5);
        expect(result.payload.featureName).toBe('Shake Out Stupor');
      });

      it('uses action name when provided', async () => {
        mockNoMap();
        const action = makeAction();
        action.name = 'Custom Shake';
        const result = await handle(action, makePlayerStats(), campaignName, null);
        expect(result.payload.featureName).toBe('Custom Shake');
      });

      it('parses range from automation string', async () => {
        mockNoMap();
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.rangeFeet).toBe(5);
      });
    });

    describe('hypno-target detection for player creatures', () => {
      const playerBase = () => ({
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'Orc', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      });

      it('identifies player creatures with charmed/incapacitated conditions via runtime store', async () => {
        getCombatContext.mockResolvedValue(playerBase());
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['charmed', 'frightened']);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['AllyPlayer']);
      });

      it('identifies player creatures with incapacitated condition via runtime store', async () => {
        getCombatContext.mockResolvedValue(playerBase());
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['incapacitated', 'poisoned']);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['AllyPlayer']);
      });

      it('does not select player creatures without charmed/incapacitated', async () => {
        getCombatContext.mockResolvedValue(playerBase());
        resolveMapPositions.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['AllyPlayer', 'Orc']);
      });
    });

    describe('hypno-target detection for monster creatures', () => {
      const monsterBase = (conditions) => ({
        creatures: [
          { name: 'Goblin', type: 'monster', conditions },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      it('identifies monsters with charmed condition from conditions array', async () => {
        getCombatContext.mockResolvedValue(monsterBase([{ key: 'charmed' }]));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('identifies monsters with incapacitated condition from conditions array', async () => {
        getCombatContext.mockResolvedValue(monsterBase([{ key: 'incapacitated' }]));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['Goblin']);
      });

      it('handles case-insensitive condition matching', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [
            { name: 'Goblin', type: 'monster', conditions: [{ key: 'CHARMED' }] },
            { name: 'Orc', type: 'monster', conditions: [{ key: 'Incapacitated' }] },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        });
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });

      it('handles string conditions array for monsters — string conditions do not match because code expects cond.key', async () => {
        getCombatContext.mockResolvedValue(monsterBase(['charmed']));
        resolveMapPositions.mockResolvedValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      });
    });
  });

  describe('handleConfirm', () => {
    const confirmPlayer = (conditions, target = 'AllyPlayer') =>
      handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, target);

    const confirmMonster = (conditions, target = 'Goblin') =>
      handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, target);

    describe('player creature target', () => {
      it('removes charmed, incapacitated, and speed_zero from player conditions', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero', 'poisoned']);
        const result = await confirmPlayer(['charmed', 'incapacitated', 'speed_zero', 'poisoned']);
        expect(setRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', ['poisoned'], campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('AllyPlayer is no longer affected by Hypnotic Pattern');
      });

      it('does not modify conditions when none of charmed/incapacitated/speed_zero are present', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);
        const result = await confirmPlayer(['frightened', 'poisoned']);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });

      it('logs condition removal entries for charmed and incapacitated when removed', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);
        const result = await confirmPlayer(['charmed', 'incapacitated', 'speed_zero']);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          type: 'condition', action: 'removed', characterName: 'AllyPlayer',
          condition: 'Charmed', reason: 'Shake Out Stupor (Hypnotic Pattern)',
        }));
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          type: 'condition', action: 'removed', characterName: 'AllyPlayer',
          condition: 'Incapacitated', reason: 'Shake Out Stupor (Hypnotic Pattern)',
        }));
        expect(result.type).toBe('popup');
      });

      it('logs condition removal for any of the 3 target conditions not in filtered array (player path)', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'poisoned']);
        const result = await confirmPlayer(['charmed', 'poisoned']);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          type: 'condition', action: 'removed', characterName: 'AllyPlayer', condition: 'Charmed',
        }));
        const incapCalls = addEntry.mock.calls.filter((call) => call[1]?.condition === 'Incapacitated');
        expect(incapCalls.length).toBe(1);
        expect(result.type).toBe('popup');
      });

      it('logs ability_use entry for player target', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed']);
        await confirmPlayer(['charmed']);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          type: 'ability_use', characterName: 'TestCaster', abilityName: 'Shake Out Stupor',
          description: expect.stringContaining('TestCaster used an action to shake AllyPlayer out of its hypnotic stupor'),
          targetName: 'AllyPlayer',
        }));
      });

      it('handles empty conditions array for player', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue([]);
        const result = await confirmPlayer([]);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });

      it('handles null conditions for player', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(null);
        const result = await confirmPlayer(null);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });

      it('handles addEntry rejection in player creature path', async () => {
        getCombatContext.mockResolvedValue(playerCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);
        addEntry.mockRejectedValue(new Error('log failure'));
        const result = await confirmPlayer(['charmed', 'incapacitated', 'speed_zero']);
        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', [], campaignName);
      });
    });

    describe('monster creature target', () => {
      it('removes charmed, incapacitated, and speed_zero from monster conditions', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero', 'poisoned']);
        const result = await confirmMonster(['charmed', 'incapacitated', 'speed_zero', 'poisoned']);
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['poisoned'], campaignName);
        expect(result.type).toBe('popup');
      });

      it('does not modify conditions when none of charmed/incapacitated/speed_zero are present', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);
        const result = await confirmMonster(['frightened', 'poisoned']);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });

      it('logs condition removal entries for monsters', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);
        const result = await confirmMonster(['charmed', 'incapacitated', 'speed_zero']);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          type: 'condition', action: 'removed', characterName: 'Goblin',
          condition: 'Charmed', reason: 'Shake Out Stupor (Hypnotic Pattern)',
        }));
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          type: 'condition', action: 'removed', characterName: 'Goblin',
          condition: 'Incapacitated', reason: 'Shake Out Stupor (Hypnotic Pattern)',
        }));
        expect(result.type).toBe('popup');
      });

      it('logs ability_use entry for monster target', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['charmed']);
        await confirmMonster(['charmed']);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          type: 'ability_use', characterName: 'TestCaster', abilityName: 'Shake Out Stupor', targetName: 'Goblin',
        }));
      });

      it('handles empty conditions array for monster', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue([]);
        const result = await confirmMonster([]);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      });

      it('handles addEntry rejection in monster creature path', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);
        addEntry.mockRejectedValue(new Error('log failure'));
        const result = await confirmMonster(['charmed', 'incapacitated', 'speed_zero']);
        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], campaignName);
      });
    });

    describe('edge cases', () => {
      it('returns null when no targetName provided', async () => {
        expect(await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, null)).toBeNull();
      });

      it('returns null when targetName is empty string', async () => {
        expect(await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, '')).toBeNull();
      });

      it('still returns popup when creature not found in combat context', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{ name: 'Goblin', type: 'monster' }, { name: 'TestCaster', gridX: 5, gridY: 10 }],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        });
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'NonExistent');
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('NonExistent is no longer affected');
      });

      it('still returns popup when combat context is missing', async () => {
        getCombatContext.mockResolvedValue(null);
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Goblin is no longer affected');
      });

      it('still returns popup when creatures array is missing in combat context', async () => {
        getCombatContext.mockResolvedValue({});
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Goblin is no longer affected');
      });

      it('handles addEntry rejection for ability_use logging', async () => {
        getCombatContext.mockResolvedValue(monsterCtx());
        getRuntimeValue.mockReturnValue(['frightened']);
        addEntry.mockRejectedValue(new Error('log failure'));
        const result = await confirmMonster(['frightened']);
        expect(result.type).toBe('popup');
      });
    });
  });
});
