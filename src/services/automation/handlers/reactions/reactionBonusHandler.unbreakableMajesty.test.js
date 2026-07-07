// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionBonusHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import { campaignName, makePlayerStats, makeAction } from './reactionBonusHandler.helpers.js';

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

function resetMocks() {
  vi.clearAllMocks();
  useRuntimeState.getRuntimeValue.mockReturnValue(false);
  useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
  expirations.addExpiration.mockResolvedValue(undefined);
  logService.addEntry.mockResolvedValue({});
}

// ── Deactivation ───────────────────────────────────────────────

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
});

// ── Activation ─────────────────────────────────────────────────

describe('handleUnbreakableMajesty — activation', () => {
  beforeEach(() => resetMocks());

  it('activates when not yet active and returns popup with description', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('activated');
  });

  it('sets unbreakableMajestyActive to true and records save DC on activation', async () => {
    const ps = makePlayerStats({ name: 'Tyrion' });
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Tyrion', 'unbreakableMajestyActive', true, campaignName
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Tyrion', 'unbreakableMajestySaveDc', 13, campaignName
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

  it('parses duration from action for expiration rounds', async () => {
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
});

// ── DC calculation edge cases ──────────────────────────────────

describe('Unbreakable Majesty DC calculation edge cases', () => {
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

  it.each([
    ['10_round', 10],
    ['1_Round', 1],
    ['1_minute', 10],
  ])('parses "%s" as %i rounds', async (duration, expectedRounds) => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, expectedRounds
    );
  });

  it('defaults to 10 rounds for unrecognized duration format', async () => {
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
