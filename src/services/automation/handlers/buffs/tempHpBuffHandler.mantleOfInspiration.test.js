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
import * as expirations from '../../../rules/effects/expirations.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as logService from '../../../ui/logService.js';
import { campaignName, makePlayerStats, makeAction, resetMocks } from './tempHpBuffTestHelpers.js';

// ────────────────────────────────────────────────────────────────
// handle() — Mantle of Inspiration fast-path detection
// ────────────────────────────────────────────────────────────────

describe('handle — Mantle of Inspiration detection', () => {
  beforeEach(() => resetMocks());

  it('delegates to Mantle of Inspiration when bonusMovement + bardic_inspiration_die present', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: '2 * bardic_inspiration_die',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    automationService.evaluateAutoExpression.mockReturnValue(12);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue({ players: [{ name: ps.name, gridX: 0, gridY: 0 }] });
    rangeValidation.getDistanceFeet.mockReturnValue(null);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('roll');
  });

  it('does NOT delegate when bonusMovement is set but expression lacks bardic_inspiration_die', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: '5 + level',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Gained 8 temporary hit points');
    expect(result.type).not.toBe('roll');
  });

  it('does NOT delegate when expression contains bardic_inspiration_die but no bonusMovement', async () => {
    const action = makeAction({
      bonusMovement: false,
      tempHpExpression: 'bardic_inspiration_die * 2',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.type).not.toBe('roll');
  });
});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — uses exhausted (early return)
// ────────────────────────────────────────────────────────────────

describe('handleMantleOfInspiration — no uses remaining', () => {
  beforeEach(() => resetMocks());

  it('returns popup when bardic inspiration uses are exhausted', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      level: 5,
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_inspiration_uses: 2 },
          { level: 2, bardic_inspiration_uses: 2 },
          { level: 3, bardic_inspiration_uses: 2 },
          { level: 4, bardic_inspiration_uses: 2 },
          { level: 5, bardic_inspiration_uses: 2 },
        ],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Second Wind has no uses remaining. Recharges on a Long Rest.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('delegates to Cha modifier when class_levels has no bardic_inspiration_uses', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      level: 1,
      class: { name: 'Bard', class_levels: [{ level: 1 }] },
      abilities: [{ name: 'Charisma', score: 14 }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('has no uses remaining');
  });
});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — successful execution (no map)
// ────────────────────────────────────────────────────────────────

describe('handleMantleOfInspiration — successful (no map)', () => {
  beforeEach(() => resetMocks());

  it('returns roll result when no mapName provided', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die * 2',
      range: '60 ft',
    });
    const ps = makePlayerStats({
      level: 3,
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_inspiration_uses: 2 },
          { level: 2, bardic_inspiration_uses: 2 },
          { level: 3, bardic_die: 6, bardic_inspiration_uses: 2 },
        ],
      },
      abilities: [{ name: 'Charisma', score: 14 }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('roll');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.tempHp).toBeDefined();
    expect(result.payload.targets).toEqual([]);
    expect(result.payload.description).toContain('no targets in range');
    expect(result.payload.description).toContain('Rolled');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });

  it('increments bardicInspirationUses when usesMax > 0', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName, null);

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'bardicInspirationUses',
    );
    expect(setCall).toBeDefined();
    expect(setCall[2]).toBe(1);
  });

  it('does NOT increment bardicInspirationUses when usesMax === 0', async () => {
    const ps = makePlayerStats({
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 0 }],
      },
    });

    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });

    await handle(action, ps, campaignName, null);

    const usageCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'bardicInspirationUses',
    );
    expect(usageCall).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — with map and targets in range
// ────────────────────────────────────────────────────────────────

describe('handleMantleOfInspiration — with map and targets', () => {
  beforeEach(() => resetMocks());

  it('resolves targets within range and sets temp HP for each', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die * 2',
      range: '60 ft',
    });
    const ps = makePlayerStats({
      name: 'Faldorn',
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
      abilities: [{ name: 'Charisma', score: 14 }],
    });

    const mapData = {
      players: [
        { name: 'Faldorn', gridX: 0, gridY: 0 },
        { name: 'Ally1', gridX: 2, gridY: 0 },
        { name: 'Ally2', gridX: 6, gridY: 3 },
        { name: 'FarAway', gridX: 50, gridY: 50 },
      ],
    };

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(37.5)
      .mockReturnValueOnce(384.1);

    const result = await handle(action, ps, campaignName, 'some-map');

    expect(result.type).toBe('roll');
    expect(result.payload.targets.length).toBe(2);
    expect(result.payload.targets).toContain('Ally1');
    expect(result.payload.targets).toContain('Ally2');
    expect(result.payload.targets).not.toContain('FarAway');
  });

  it('respects maxTargets limit from Cha modifier', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Faldorn',
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
      abilities: [{ name: 'Charisma', score: 12 }],
    });

    const mapData = {
      players: [
        { name: 'Faldorn', gridX: 0, gridY: 0 },
        { name: 'AllyNear', gridX: 1, gridY: 0 },
        { name: 'AlsoNear', gridX: 2, gridY: 0 },
      ],
    };

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet.mockReturnValue(5);

    const result = await handle(action, ps, campaignName, 'some-map');

    expect(result.payload.targets.length).toBe(1);
    expect(result.payload.targets).toContain('AllyNear');
    expect(result.payload.targets).not.toContain('AlsoNear');
  });

  it('sets tempHp and inspiringMovementNoOA for each target', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Faldorn',
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
      abilities: [{ name: 'Charisma', score: 14 }],
    });

    const mapData = {
      players: [
        { name: 'Faldorn', gridX: 0, gridY: 0 },
        { name: 'Ally1', gridX: 2, gridY: 0 },
      ],
    };

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet.mockReturnValue(10);

    await handle(action, ps, campaignName, 'some-map');

    const calls = useRuntimeState.setRuntimeValue.mock.calls;
    const tempCall = calls.find(c => c[0] === 'Ally1' && c[1] === 'tempHp');
    expect(tempCall).toBeDefined();

    const movementCall = calls.find(
      c => c[0] === 'Ally1' && c[1] === 'inspiringMovementNoOA',
    );
    expect(movementCall).toBeDefined();
  });

  it('calls addExpiration for each target', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Faldorn',
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
      abilities: [{ name: 'Charisma', score: 14 }],
    });

    const mapData = {
      players: [
        { name: 'Faldorn', gridX: 0, gridY: 0 },
        { name: 'Ally1', gridX: 2, gridY: 0 },
      ],
    };

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet.mockReturnValue(10);

    await handle(action, ps, campaignName, 'some-map');

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Faldorn', 'Ally1', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1,
    );
  });

  it('does not enter map path when rangeToFeet returns null', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
      range: 'self',
    });

    const ps = makePlayerStats({
      name: 'Faldorn',
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    rangeValidation.rangeToFeet.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, 'some-map');

    expect(result.type).toBe('roll');
    expect(mapsService.loadMapData).not.toHaveBeenCalled();
    expect(result.payload.targets).toEqual([]);
  });

  it('does not enter map path when attacker not found in map', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });

    const ps = makePlayerStats({ name: 'Faldorn' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue({ players: [{ name: 'SomeoneElse', gridX: 5, gridY: 5 }] });

    const result = await handle(action, ps, campaignName, 'some-map');

    expect(result.type).toBe('roll');
    expect(result.payload.targets).toEqual([]);
  });

  it('skips self when resolving map targets', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Faldorn',
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
      abilities: [{ name: 'Charisma', score: 14 }],
    });

    const mapData = {
      players: [
        { name: 'Faldorn', gridX: 0, gridY: 0 },
      ],
    };

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue(mapData);

    const result = await handle(action, ps, campaignName, 'some-map');

    expect(result.payload.targets).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — log entry and description
// ────────────────────────────────────────────────────────────────

describe('handleMantleOfInspiration — logging', () => {
  beforeEach(() => resetMocks());

  it('calls addEntry with ability_use type on success', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die * 2',
    });
    const ps = makePlayerStats({ name: 'Faldorn' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Faldorn',
        abilityName: 'Second Wind',
      }),
    );
  });

  it('propagates addEntry errors', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    logService.addEntry.mockRejectedValue(new Error('network'));

    await expect(handle(action, ps, campaignName, null)).rejects.toThrow('network');
  });
});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — roll result payload structure
// ────────────────────────────────────────────────────────────────

describe('handleMantleOfInspiration — roll result payload', () => {
  beforeEach(() => resetMocks());

  it('roll payload contains correct keys', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die * 2',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('roll');
    expect(result.payload.roll).toMatch(/^1d\d+$/);
    expect(typeof result.payload.result).toBe('number');
    expect(result.payload.name).toBe('Second Wind');
    expect(typeof result.payload.tempHp).toBe('number');
    expect(Array.isArray(result.payload.targets)).toBe(true);
  });

  it('description includes reaction note when targets present', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Faldorn',
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
      abilities: [{ name: 'Charisma', score: 14 }],
    });

    const mapData = {
      players: [
        { name: 'Faldorn', gridX: 0, gridY: 0 },
        { name: 'Ally1', gridX: 2, gridY: 0 },
      ],
    };

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue(mapData);
    rangeValidation.getDistanceFeet.mockReturnValue(10);

    const result = await handle(action, ps, campaignName, 'some-map');

    expect(result.payload.description).toContain('Reaction to move up to their Speed without provoking Opportunity Attacks');
  });

  it('description does not include reaction note when no targets', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).not.toContain('Reaction');
  });

  it('tempHp is doubled die roll (2 * diceRoll)', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.tempHp % 2).toBe(0);
  });

  it('bardicDieSize from classLevels overrides default 6', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die * 2',
    });
    const ps = makePlayerStats({
      level: 5,
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_die: 6 },
          { level: 10, bardic_die: 8 },
          { level: 15, bardic_die: 10 },
          { level: 20, bardic_die: 12 },
        ],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.roll).toBe('1d6');
  });

  it('uses default bardic_die of 6 when classLevels has no entry at current level', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      level: 3,
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1 },
          { level: 5 },
        ],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.roll).toBe('1d6');
  });
});
