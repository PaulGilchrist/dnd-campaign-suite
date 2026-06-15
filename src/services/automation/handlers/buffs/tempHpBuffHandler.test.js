import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automationService.js', () => ({
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

// ── Imports (returned as mocked versions) ─────────────────────

import { handle, grantTempHpOnRage, craftBolsteringTreats } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/useRuntimeState.js';
import * as automationService from '../../../combat/automationService.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ───────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Grog',
    level: 3,
    class: {
      name: 'Barbarian',
      class_levels: [
        { level: 1 },
        { level: 2 },
        { level: 3 },
      ],
    },
    abilities: [],
    ...overrides,
  };
}

function makeAction(automation = {}, actionOverrides = {}) {
  return {
    name: 'Second Wind',
    automation: {
      type: 'temp_hp_buff',
      tempHpExpression: '',
      ongoingHealingExpression: '',
      healingRange: '',
      bonusMovement: false,
      ...automation,
    },
    ...actionOverrides,
  };
}

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
  automationService.evaluateAutoExpression.mockClear().mockReset();
  mapsService.loadMapData.mockClear().mockReset();
  expirations.addExpiration.mockClear().mockReset();
  rangeValidation.getDistanceFeet.mockClear().mockReset();
  rangeValidation.rangeToFeet.mockClear().mockReset();
  logService.addEntry.mockClear().mockResolvedValue({});
}

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

    // Mantle-of-Inspiration path needs several mocks; stub them so it does not throw.
    useRuntimeState.getRuntimeValue.mockReturnValue(0); // bardicInspirationUses
    automationService.evaluateAutoExpression.mockReturnValue(12);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    mapsService.loadMapData.mockResolvedValue({ players: [{ name: ps.name, gridX: 0, gridY: 0 }] });
    rangeValidation.getDistanceFeet.mockReturnValue(null);

    const result = await handle(action, ps, campaignName);

      // The internal Mantle branch returns type === 'roll' (not 'popup')
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
    // Should NOT be a roll type (roll is the Mantle path)
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
// handle() — No tempHpExpression path
// ────────────────────────────────────────────────────────────────

describe('handle — no tempHpExpression', () => {
  beforeEach(() => resetMocks());

  it('returns popup when tempHpExpression is empty string', async () => {
    const action = makeAction({}); // default has tempHpExpression: ''
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Second Wind: No temp HP expression defined.');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
  });

  it('returns popup when automation.tempHpExpression is undefined', async () => {
    const action = makeAction({ tempHpExpression: undefined });
    const ps = makePlayerStats();

    // Need to delete the key so `|| ''` kicks in
    delete action.automation.tempHpExpression;

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No temp HP expression defined');
  });

  it('does not call evaluateAutoExpression when tempHpExpression is empty', async () => {
    const action = makeAction({});
    const ps = makePlayerStats();

    await handle(action, ps, campaignName);

    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// handle() — Invalid / zero / negative evaluation
// ────────────────────────────────────────────────────────────────

describe('handle — invalid evaluation result', () => {
  beforeEach(() => resetMocks());

  it('returns popup when evaluateAutoExpression returns a string', async () => {
    const action = makeAction({ tempHpExpression: 'INVALID_EXPR' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue('INVALID_EXPR'); // un-evaluable → returned as-is

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when evaluateAutoExpression returns 0', async () => {
    const action = makeAction({ tempHpExpression: '0' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when evaluateAutoExpression returns a negative number', async () => {
    const action = makeAction({ tempHpExpression: '-3' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(-3);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when evaluateAutoExpression returns null', async () => {
    const action = makeAction({ tempHpExpression: 'maybe_something' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(null);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });
});

// ────────────────────────────────────────────────────────────────
// handle() — Successful temp HP setting (non-Mantle path)
// ────────────────────────────────────────────────────────────────

describe('handle — successful temp HP', () => {
  beforeEach(() => resetMocks());

  it('sets tempHp runtime value and returns popup with success description', async () => {
    const action = makeAction({ tempHpExpression: 'level + 5' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Gained 8 temporary hit points from Second Wind.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 8, campaignName,
    );
  });

  it('includes ongoing healing text when ongoingHealingExpression is set', async () => {
    const action = makeAction({
      tempHpExpression: 'level + 5',
      ongoingHealingExpression: '1d4',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe(
      'Gained 8 temporary hit points from Second Wind. At the start of each turn while raging, can grant temp HP to a creature within 10 ft.',
    );
  });

  it('uses custom healingRange in description', async () => {
    const action = makeAction({
      tempHpExpression: 'level + 5',
      ongoingHealingExpression: '1d4',
      healingRange: '30 ft',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('within 30 ft');
  });

  it('payload contains correct structure', async () => {
    const action = makeAction({ tempHpExpression: 'level + 5' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('calls setRuntimeValue with player name from playerStats', async () => {
    const action = makeAction({ tempHpExpression: '10' });
    const ps = makePlayerStats({ name: 'Faldorn' });
    automationService.evaluateAutoExpression.mockReturnValue(10);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Faldorn', 'tempHp', 10, campaignName,
    );
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
    expect(setCall[2]).toBe(1); // 2 - 1 = 1
  });

  it('does NOT increment bardicInspirationUses when usesMax === 0', async () => {
    const ps = makePlayerStats({
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 0 }],
      },
    });

      // With usesMax=0, the `if (usesMax > 0)` block is skipped; no getRuntimeValue call for usage.
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });

    await handle(action, ps, campaignName, null);

    // No setRuntimeValue call because `if (usesMax > 0)` is never entered.
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
      tempHpExpression: 'bardic_inspiration_die'
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
    // Map exists but no player named Faldorn
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

  it('catches and swallows addEntry errors', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    logService.addEntry.mockRejectedValue(new Error('network'));

    // Should not throw — .catch(() => {}) in source
    await expect(handle(action, ps, campaignName, null)).resolves.toBeDefined();
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

      // The source does `const tempHp = 2 * dieRoll`, so tempHp should be an even number
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

      // roll should be 1d6 because player is level 5, and the classLevels array has
      // a level 1 entry with bardic_die=6; getBardicDieSize looks for cl.level === playerStats.level (5).
      // No match for level 5 in [1,10,15,20], so it falls back to default 6.
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
          { level: 5 }, // no level-3 entry with bardic_die
        ],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

      // No class_levels entry for level 3 → default 6
    expect(result.payload.roll).toBe('1d6');
  });
});

// ────────────────────────────────────────────────────────────────
// grantTempHpOnRage — exported function
// ────────────────────────────────────────────────────────────────

describe('grantTempHpOnRage', () => {
  beforeEach(() => resetMocks());

  it('returns false when triggerOnRage is not set', () => {
    const action = makeAction({ triggerOnRage: false });
    const ps = makePlayerStats();

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when tempHpExpression is empty', () => {
    const action = makeAction({ triggerOnRage: true, tempHpExpression: '' });
    const ps = makePlayerStats();

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when tempHpExpression is undefined but triggerOnRage is set', () => {
    const action = makeAction({});
    action.automation.triggerOnRage = true;
    delete action.automation.tempHpExpression;

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(false);
  });

  it('returns false when evaluateAutoExpression returns non-number', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_damage_d6',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue('2d6'); // unresolved dice string

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when evaluateAutoExpression returns 0', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'level + 5',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when evaluateAutoExpression returns a negative number', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: '-1',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(-5);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns true and sets tempHp when amount > existing', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(3); // existing tempHp = 3
    automationService.evaluateAutoExpression.mockReturnValue(10); // new amount = 10

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 10, campaignName, // Math.max(3, 10) = 10
    );
  });

  it('keeps existing tempHp when amount <= existing', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(15); // existing = 15 > new
    automationService.evaluateAutoExpression.mockReturnValue(10); // new amount = 10

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 15, campaignName, // Math.max(15, 10) = 15
    );
  });

  it('treats null existing tempHp as 0', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(null); // || 0 → 0
    automationService.evaluateAutoExpression.mockReturnValue(5);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
   });

  it('does not call setRuntimeValue when getRuntimeValue returns 0 and amount is same', () => {
    // Edge: existing=0 (from || 0) and amount > 0 means Math.max(0, amount)=amount > 0 should still set
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(0); // existing = 0
    automationService.evaluateAutoExpression.mockReturnValue(5); // amount=5

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 5, campaignName,
    );
  });
});

// ────────────────────────────────────────────────────────────────
// handleBolsteringTreats — detects craftCount path
// ────────────────────────────────────────────────────────────────

describe('handle — Bolstering Treats detection', () => {
  beforeEach(() => resetMocks());

  it('delegates to Bolstering Treats when craftCount is present', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
        action: 'bonus_action',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 2;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Ate a bolstering treat');
  });

  it('does NOT delegate when craftCount is absent', async () => {
    const action = makeAction({ tempHpExpression: '5' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(5);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Gained 5 temporary hit points');
  });
});

// ────────────────────────────────────────────────────────────────
// handleBolsteringTreats — no treats remaining
// ────────────────────────────────────────────────────────────────

describe('handleBolsteringTreats — no treats remaining', () => {
  beforeEach(() => resetMocks());

  it('returns popup when treat count is 0', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 0;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No treats remaining');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when treat count is negative', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return -1;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No treats remaining');
  });
});

// ────────────────────────────────────────────────────────────────
// handleBolsteringTreats — successful treat consumption
// ────────────────────────────────────────────────────────────────

describe('handleBolsteringTreats — successful consumption', () => {
  beforeEach(() => resetMocks());

  it('decrements treat count and sets temp HP', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 2;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('2 temporary hit points');
    expect(result.payload.description).toContain('1 treat');
    const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
    const treatCall = setCalls.find(c => c[1] === 'chefBolsteringTreats');
    expect(treatCall).toBeDefined();
    expect(treatCall[2]).toBe(1);
    const tempHpCall = setCalls.find(c => c[1] === 'tempHp');
    expect(tempHpCall).toBeDefined();
    expect(tempHpCall[2]).toBe(2);
  });

  it('uses proficiency_bonus for temp HP when tempHpExpression is "proficiency_bonus"', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 3 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 3;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('3 temporary hit points');
  });

  it('uses evaluated expression when tempHpExpression is not "proficiency_bonus"', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'level + 5',
      },
    };
    const ps = makePlayerStats({ level: 5, proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('10 temporary hit points');
  });

  it('pluralizes "treats" correctly', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 3 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 3;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('2 treats remaining');
  });

  it('returns popup when temp HP evaluates to non-number', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'invalid_expr',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 2;
      return null;
    });
    automationService.evaluateAutoExpression.mockReturnValue('not-a-number');

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when temp HP evaluates to 0', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: '0',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 2;
      return null;
    });
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });
});

// ────────────────────────────────────────────────────────────────
// craftBolsteringTreats — exported function
// ────────────────────────────────────────────────────────────────

describe('craftBolsteringTreats', () => {
  beforeEach(() => resetMocks());

  it('sets chefBolsteringTreats to proficiency_bonus', () => {
    const ps = makePlayerStats({ proficiency: 2, name: 'Chef' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Chef', 'chefBolsteringTreats', 2, campaignName,
    );
  });

  it('uses proficiency from playerStats', () => {
    const ps = makePlayerStats({ proficiency: 6, name: 'TestChar' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestChar', 'chefBolsteringTreats', 6, campaignName,
    );
  });
});

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
    // Ally1 should get Math.max(15, 8) = 15, Leader should get 8
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
