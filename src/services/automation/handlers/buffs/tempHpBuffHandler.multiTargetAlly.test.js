// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

import { handle } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import { campaignName, makePlayerStats, resetMocks } from './tempHpBuffTestHelpers.js';

// ────────────────────────────────────────────────────────────────
// handleMultiTargetAllyTempHp — no map available
// ────────────────────────────────────────────────────────────────

describe('handleMultiTargetAllyTempHp — no map', () => {
  beforeEach(() => resetMocks());

  it('grants temp HP to self only when includesSelf is true and no map', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 6,
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('8 temporary hit points');
    expect(result.payload.description).toContain('1 creature');
    expect(result.payload.description).toContain('Leader');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Leader', 'tempHp', 8, campaignName,
    );
  });

  it('returns error when includesSelf is false and no map is available', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 6,
        includesSelf: false,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not resolve allies without a map');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// handleMultiTargetAllyTempHp — map present, range handling
// ────────────────────────────────────────────────────────────────

describe('handleMultiTargetAllyTempHp — map and range', () => {
  beforeEach(() => resetMocks());

  function createMapData(players) {
    return { players };
  }

  it('selects allies within range and applies temp HP to each', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 6,
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const mapData = createMapData([
      { name: 'Leader', gridX: 0, gridY: 0 },
      { name: 'Ally1', gridX: 2, gridY: 0 },
      { name: 'Ally2', gridX: 4, gridY: 0 },
      { name: 'FarAlly', gridX: 50, gridY: 50 },
    ]);

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(384);

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('3 creatures');
    expect(result.payload.description).toContain('Leader, Ally1, Ally2');

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempHpCalls.length).toBe(3);

    const targetNames = tempHpCalls.map((c) => c[0]);
    expect(targetNames).toContain('Leader');
    expect(targetNames).toContain('Ally1');
    expect(targetNames).toContain('Ally2');
  });

  it('respects the max targets limit', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 2,
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const mapData = createMapData([
      { name: 'Leader', gridX: 0, gridY: 0 },
      { name: 'Ally1', gridX: 2, gridY: 0 },
      { name: 'Ally2', gridX: 4, gridY: 0 },
    ]);

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20);

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.payload.description).toContain('2 creatures');

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempHpCalls.length).toBe(2);
  });

  it('uses max of existing temp HP when setting a lower value', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 6,
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    useRuntimeState.getRuntimeValue.mockImplementation((_name, key, _campaign) => {
      if (key === 'tempHp' && _name === 'Ally1') return 15;
      return 0;
    });

    const mapData = createMapData([
      { name: 'Leader', gridX: 0, gridY: 0 },
      { name: 'Ally1', gridX: 2, gridY: 0 },
    ]);

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet.mockReturnValue(10);

    await handle(action, ps, campaignName, 'test-map');

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempHpCalls.length).toBe(2);

    const ally1Call = tempHpCalls.find((c) => c[0] === 'Ally1');
    expect(ally1Call[2]).toBe(15);

    const leaderCall = tempHpCalls.find((c) => c[0] === 'Leader');
    expect(leaderCall[2]).toBe(8);
  });

  it('skips map lookup when rangeToFeet returns null (self range)', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: 'self',
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);
    rangeValidation.rangeToFeet.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(mapsService.loadMapData).not.toHaveBeenCalled();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('1 creature');
    expect(result.payload.description).toContain('Leader');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Leader', 'tempHp', 8, campaignName,
    );
  });

  it('does not include self in target list when includesSelf is false and map is present', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 6,
        includesSelf: false,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const mapData = createMapData([
      { name: 'Leader', gridX: 0, gridY: 0 },
      { name: 'Ally1', gridX: 2, gridY: 0 },
    ]);

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet.mockReturnValueOnce(10);

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.payload.description).toContain('1 creature');
    expect(result.payload.description).toContain('Ally1');

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    const targetNames = tempHpCalls.map((c) => c[0]);
    expect(targetNames).not.toContain('Leader');
    expect(targetNames).toContain('Ally1');
  });

  it('produces no targets when attacker is not found on map', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 6,
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'UnknownPlayer' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const mapData = createMapData([
      { name: 'Ally1', gridX: 2, gridY: 0 },
    ]);

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockResolvedValue(mapData);

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('0 creatures');
    expect(result.payload.description).toContain('no targets available');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('skips ally when getDistanceFeet returns null', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 6,
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const mapData = createMapData([
      { name: 'Leader', gridX: 0, gridY: 0 },
      { name: 'Ally1', gridX: 2, gridY: 0 },
      { name: 'Ally2', gridX: 4, gridY: 0 },
    ]);

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(null);

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.payload.description).toContain('2 creatures');
    expect(result.payload.description).toContain('Leader');
    expect(result.payload.description).toContain('Ally1');
    expect(result.payload.description).not.toContain('Ally2');
  });

  it('propagates loadMapData rejection as an error', async () => {
    const action = {
      name: 'Inspiring Leader',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 3',
        range: '30 ft',
        targets: 6,
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockRejectedValue(new Error('map not found'));

    await expect(handle(action, ps, campaignName, 'test-map')).rejects.toThrow('map not found');
  });
});
