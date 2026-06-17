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
// handleMultiTargetAllyTempHp — multi-target ally temp HP (Inspiring Leader)
// ────────────────────────────────────────────────────────────────

describe('handleMultiTargetAllyTempHp — basic evaluation', () => {
  beforeEach(() => resetMocks());

  it('delegates to multi-target when multiTargetAlly is true', async () => {
    const action = {
      name: 'Bolstering Performance',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'level + 5',
        range: '30 ft',
        targets: 6,
        includesSelf: true,
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats({ level: 5 });
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('10 temporary hit points');
    expect(result.payload.description).toContain('Bolstering Performance');
  });

  it('returns error popup when temp HP evaluates to non-number', async () => {
    const action = {
      name: 'Bolstering Performance',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: 'invalid',
        range: '30 ft',
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue('not-a-number');

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns error popup when temp HP evaluates to 0', async () => {
    const action = {
      name: 'Bolstering Performance',
      automation: {
        type: 'temp_hp_buff',
        tempHpExpression: '0',
        range: '30 ft',
        multiTargetAlly: true,
      },
    };
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });
});

describe('handleMultiTargetAllyTempHp — no map', () => {
  beforeEach(() => resetMocks());

  it('grants temp HP to self only when no map provided and includesSelf is true', async () => {
    const action = {
      name: 'Bolstering Performance',
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

  it('returns error when includesSelf is false and no map', async () => {
    const action = {
      name: 'Bolstering Performance',
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
  });
});

describe('handleMultiTargetAllyTempHp — with map and range', () => {
  beforeEach(() => resetMocks());

  it('resolves allies within range on map', async () => {
    const action = {
      name: 'Bolstering Performance',
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

    const mapData = {
      players: [
        { name: 'Leader', gridX: 0, gridY: 0 },
        { name: 'Ally1', gridX: 2, gridY: 0 },
        { name: 'Ally2', gridX: 4, gridY: 0 },
        { name: 'FarAlly', gridX: 50, gridY: 50 },
      ],
    };

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

    const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
    const tempHpTargets = setCalls.filter(c => c[1] === 'tempHp');
    expect(tempHpTargets.length).toBe(3);
  });

  it('respects target limit', async () => {
    const action = {
      name: 'Bolstering Performance',
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

    const mapData = {
      players: [
        { name: 'Leader', gridX: 0, gridY: 0 },
        { name: 'Ally1', gridX: 2, gridY: 0 },
        { name: 'Ally2', gridX: 4, gridY: 0 },
      ],
    };

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20);

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.payload.description).toContain('2 creatures');
    const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
    const tempHpTargets = setCalls.filter(c => c[1] === 'tempHp');
    expect(tempHpTargets.length).toBe(2);
  });

  it('takes max of existing temp HP when setting', async () => {
    const action = {
      name: 'Bolstering Performance',
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

    useRuntimeState.getRuntimeValue.mockImplementation((name, key, _campaign) => {
      if (key === 'tempHp' && name === 'Ally1') return 15;
      return 0;
    });

    const mapData = {
      players: [
        { name: 'Leader', gridX: 0, gridY: 0 },
        { name: 'Ally1', gridX: 2, gridY: 0 },
      ],
    };

    rangeValidation.rangeToFeet.mockReturnValue(30);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet.mockReturnValue(10);

    await handle(action, ps, campaignName, 'test-map');

    const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
    const tempHpCalls = setCalls.filter(c => c[1] === 'tempHp');
    expect(tempHpCalls.length).toBe(2);
    const ally1Call = tempHpCalls.find(c => c[0] === 'Ally1');
    expect(ally1Call[2]).toBe(15);
    const leaderCall = tempHpCalls.find(c => c[0] === 'Leader');
    expect(leaderCall[2]).toBe(8);
  });

  it('does not enter map path when rangeToFeet returns null', async () => {
    const action = {
      name: 'Bolstering Performance',
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
    expect(result.payload.description).toContain('1 creature');
    expect(result.payload.description).toContain('Leader');
  });
});
