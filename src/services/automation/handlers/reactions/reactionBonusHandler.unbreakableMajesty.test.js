// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionBonusHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';

// ── Mocks (hoisted) ────────────────────────────────────────────

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Paladin',
    proficiency: 2,
    level: 3,
    speed: 30,
    abilities: [
      { name: 'Strength', bonus: 3 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 2 },
      { name: 'Intelligence', bonus: 0 },
      { name: 'Wisdom', bonus: 1 },
      { name: 'Charisma', bonus: 3 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Test Reaction',
    automation: {
      effect: '',
      duration: '',
      uses_expression: null,
      usesMax: null,
      uses: 0,
      resourceKey: null,
      allyRange: '30 ft',
      noOAs: false,
      ...automation,
    },
  };
}

function resetMocks() {
  vi.clearAllMocks();
  useRuntimeState.getRuntimeValue.mockReturnValue(false);
  useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
  expirations.addExpiration.mockResolvedValue(undefined);
  logService.addEntry.mockResolvedValue({});
}

// ── Deactivation path ──────────────────────────────────────────

describe('handleUnbreakableMajesty — deactivation', () => {
  beforeEach(() => resetMocks());

  it('returns popup indicating ability ended when already active', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Test Reaction ended.');
  });

  it('adds a log entry on deactivation', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });
    action.name = 'Unbreakable Majesty';

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Paladin',
        abilityName: 'Unbreakable Majesty',
      })
    );
  });

  it('swallows addEntry errors on deactivation without throwing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);
    logService.addEntry.mockRejectedValue(new Error('network fail'));

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result).toBeDefined();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Test Reaction ended.');
  });
});

// ── Activation path ────────────────────────────────────────────

describe('handleUnbreakableMajesty — activation', () => {
  beforeEach(() => resetMocks());

  it('activates when not yet active', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
  });

  it('sets unbreakableMajestyActive to true on activation', async () => {
    const ps = makePlayerStats({ name: 'Tyrion' });
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Tyrion', 'unbreakableMajestyActive', true, campaignName
    );
  });

  it('calculates save DC from CHA bonus + proficiency', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 13, campaignName
    );
  });

  it('defaults Cha bonus and proficiency to 0 when missing', async () => {
    const ps = makePlayerStats({ abilities: [] });
    delete ps.proficiency;
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 8, campaignName
    );
  });

  it('includes DC in activation popup description', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.payload.description).toContain('DC 13');
  });

  it('adds expiration with unbreakable_majesty type', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });

  it('parses duration from auto.duration for expiration rounds', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '5_round' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 5
    );
  });

  it('defaults duration rounds to 10 when parseDurationRounds returns undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });

  it('adds activation log entry with correct info', async () => {
    const ps = makePlayerStats({ name: 'Jaina' });
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Jaina',
        abilityName: 'Test Reaction',
      })
    );
  });

  it('activation popup description mentions Incapacitated as early end condition', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.payload.description).toContain('Incapacitated');
  });

  it('toggle: first call activates, second call deactivates', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    // First call — activates
    useRuntimeState.getRuntimeValue.mockReturnValue(false);
    const activateResult = await handle(action, ps, campaignName, 'DungeonMap');

    expect(activateResult.payload.description).toContain('activated');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', true, campaignName
    );

    // Second call — deactivates
    useRuntimeState.getRuntimeValue.mockReturnValue(true);
    const deactivateResult = await handle(action, ps, campaignName, 'DungeonMap');

    expect(deactivateResult.payload.description).toBe('Test Reaction ended.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', null, campaignName
    );
  });

  it('swallows addEntry errors on activation without throwing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);
    logService.addEntry.mockRejectedValue(new Error('fail'));

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result).toBeDefined();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
  });
});

// ── DC calculation edge cases ──────────────────────────────────

describe('Unbreakable Majesty DC calculation', () => {
  beforeEach(() => resetMocks());

  it('Cha bonus from ability with no name field uses 0', async () => {
    const ps = makePlayerStats({ abilities: [{ bonus: 5 }] });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 10, campaignName
    );
  });

  it('handles missing abilities array on playerStats', async () => {
    const ps = makePlayerStats({});
    delete ps.abilities;
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result).toBeDefined();
    expect(result.type).toBe('popup');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 10, campaignName
    );
  });
});

// ── parseDurationRounds edge cases ─────────────────────────────

describe('parseDurationRounds via handleUnbreakableMajesty', () => {
  beforeEach(() => resetMocks());

  it('parses "10_round" as 10 rounds', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '10_round' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });

  it('parses "1_round" as 1 round (case-insensitive)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_Round' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 1
    );
  });

  it('does NOT parse "5_minutes" — defaults to 10 rounds', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '5_minutes' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });
});

// ── Null safety ────────────────────────────────────────────────

describe('Unbreakable Majesty null safety', () => {
  beforeEach(() => resetMocks());

  it('handles missing proficiency on playerStats', async () => {
    const ps = makePlayerStats({});
    delete ps.proficiency;
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result).toBeDefined();
    expect(result.type).toBe('popup');
  });

  it('handles undefined getRuntimeValue return when not active', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result).toBeDefined();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
  });
});
