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
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
  expirations.addExpiration.mockClear().mockReset();
  logService.addEntry.mockClear().mockResolvedValue({});
}

// ── Dispatch routing tests ─────────────────────────────────────

describe('handle — dispatch routing', () => {
  beforeEach(() => resetMocks());

  it('routes to Unbreakable Majesty when effect is miss_on_failed_save', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
  });

  it('routes to Unbreakable Majesty deactivation when miss_on_failed_save and already active', async () => {
    const action = makeAction({ effect: 'miss_on_failed_save' });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('ended');
  });
});

// ── Deactivation path (wasActive) ──────────────────────────────

describe('handleUnbreakableMajesty — deactivation', () => {
  beforeEach(() => resetMocks());

  it('ends the ability when already active', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('ended');
  });

  it('sets unbreakableMajestyActive to null on deactivation', async () => {
    const ps = makePlayerStats({ name: 'Tyrion' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Tyrion', 'unbreakableMajestyActive', null, campaignName
    );
  });

  it('does NOT set duration or DC runtime values on deactivation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    await handle(action, ps, campaignName, 'DungeonMap');

    const saveDcCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'unbreakableMajestySaveDc'
    );
    expect(saveDcCall).toBeUndefined();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
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

  it('log entry description contains "ended" on deactivation', async () => {
    const ps = makePlayerStats({ name: 'Jaina' });
    const action = makeAction({ effect: 'miss_on_failed_save' });
    action.name = 'Unbreakable Majesty';

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        description: 'Jaina ended Unbreakable Majesty.',
      })
    );
  });

  it('popup payload name matches action.name', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });
    action.name = 'Divine Shield';

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.payload.name).toBe('Divine Shield');
    expect(result.payload.description).toBe('Divine Shield ended.');
  });

  it('popup payload contains automation object', async () => {
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, campaignName, 'DungeonMap');

    expect(result.payload.automation).toBe(action.automation);
  });

  it('propagates addEntry errors on deactivation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);
    logService.addEntry.mockRejectedValue(new Error('network fail'));

    await expect(handle(action, ps, campaignName, 'DungeonMap')).rejects.toThrow('network fail');
  });
});

// ── Activation path (not yet active) ───────────────────────────

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

  it('uses DC containing CHA bonus from abilities', async () => {
    const ps = makePlayerStats({
      abilities: [{ name: 'Charisma', bonus: 5 }],
      proficiency: 3,
    });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 16, campaignName
    );
  });

  it('defaults Cha bonus to 0 when ability not found', async () => {
    const ps = makePlayerStats({ abilities: [{ name: 'Strength', bonus: 3 }] });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 10, campaignName
    );
  });

  it('defaults proficiency to 0 when missing', async () => {
    const ps = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 3 }], proficiency: undefined });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin', 'unbreakableMajestySaveDc', 11, campaignName
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

  it('activation log description includes DC', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        description: expect.stringContaining('DC 13'),
        })
    );
  });

  it('activation popup description mentions duration', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.payload.description).toContain('For 1_minute');
  });

  it('uses default duration text "1 minute" when auto.duration missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.payload.description).toContain('For 1 minute');
  });

  it('activation popup mentions Incapacitated as early end condition', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.payload.description).toContain('Incapacitated');
  });

  it('activation does not set unbreakableMajestyActive to null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    const activeCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'unbreakableMajestyActive'
    );
    expect(activeCall).toBeDefined();
    expect(activeCall[2]).toBe(true);
  });

  it('propagates addEntry errors on activation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);
    logService.addEntry.mockRejectedValue(new Error('fail'));

    await expect(handle(action, ps, campaignName, 'DungeonMap')).rejects.toThrow('fail');
  });

  it('first call activates (wasActive=false)', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', true, campaignName
    );
  });

  it('second call deactivates (wasActive=true)', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.payload.description).toBe('Test Reaction ended.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', null, campaignName
    );
  });
});

// ── DC calculation edge cases ──────────────────────────────────

describe('Unbreakable Majesty DC calculation', () => {
  beforeEach(() => resetMocks());

  it('DC = 8 + Cha bonus (0) + prof (0) when all missing', async () => {
    const ps = makePlayerStats({ abilities: [] });
    delete ps.proficiency;
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 8, campaignName
    );
  });

  it('Cha bonus from ability with no name field uses 0', async () => {
    const ps = makePlayerStats({ abilities: [{ bonus: 5 }] });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

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

  it('parses "1_minute" as 10 rounds (exact match)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

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

  it('handles missing abilities array on playerStats', async () => {
    const ps = makePlayerStats({});
    delete ps.abilities;
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await expect(handle(action, ps, campaignName, 'DungeonMap')).resolves.toBeDefined();
  });

  it('handles missing proficiency on playerStats', async () => {
    const ps = makePlayerStats({});
    delete ps.proficiency;
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await expect(handle(action, ps, campaignName, 'DungeonMap')).resolves.toBeDefined();
  });

  it('handles missing name on playerStats for getRuntimeValue calls', async () => {
    const ps = makePlayerStats({});
    delete ps.name;
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await expect(handle(action, ps, campaignName, 'DungeonMap')).resolves.toBeDefined();
  });

  it('handles undefined getRuntimeValue return when not active', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

    await expect(handle(action, ps, campaignName, 'DungeonMap')).resolves.toBeDefined();
  });

  it('handles getRuntimeValue returning non-boolean value for wasActive', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue('truthy');

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', true, campaignName
    );
  });
});
