// @maintained-by-ai
// reactionBonusHandler.js UNBREAKABLE MAJESTY lane — canonical home of the
// handle() `miss_on_failed_save` dispatch and handleUnbreakableMajesty: strict
// `=== true` toggle gating, activation popup full-string composition, CHA save-DC
// math (8 + CHA + prof with ||0 defaults), addExpiration composition via
// parseDurationRounds(...) || 10 (durationParser.js has no own suite — this
// table is the contract as composed here), and campaign-log entries.
// Sibling lanes: Bend Fate / applyD20Modifier / AC bonus / Leap Aside / Veer are
// canonical in reactionBonusHandler.test.js (main lane); Inspiring Movement lives in
// reactionBonusHandler.inspiringMovement.test.js. The attack-side hit-rider consumption
// of unbreakableMajestyActive is owned by useLoggedDiceRollAttack.target-effects-majesty*
// and services/combat/auras/unbreakableMajesty.test.js. Fully mocked, deterministic, no timers.
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

function majestyExpiration(rounds) {
  return {
    attackerName: 'Paladin',
    targetName: 'Paladin',
    effects: [{ type: 'unbreakable_majesty' }],
    campaignName,
    rounds,
  };
}

// ── Deactivation ───────────────────────────────────────────────

describe('handleUnbreakableMajesty — deactivation', () => {
  beforeEach(() => resetMocks());

  it('nulls the flag, logs, and returns the ended popup when already active', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });
    action.name = 'Unbreakable Majesty';

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Unbreakable Majesty',
        description: 'Unbreakable Majesty ended.',
        automation: action.automation,
      },
    });
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', null, campaignName
    );
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Paladin',
        abilityName: 'Unbreakable Majesty',
        description: 'Paladin ended Unbreakable Majesty.',
      })
    );
    // Deactivation must not re-arm expiration or rewrite the DC.
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', expect.anything(), campaignName
    );
  });
});

// ── Activation ─────────────────────────────────────────────────

describe('handleUnbreakableMajesty — activation', () => {
  beforeEach(() => resetMocks());

  it.each([undefined, false, null, 1, 'true'])(
    'activates when stored flag is %o (strict !== true gate)',
    async (storedFlag) => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

      useRuntimeState.getRuntimeValue.mockReturnValue(storedFlag);

      const result = await handle(action, ps, campaignName, 'DungeonMap');

      expect(result.payload.description).toContain('activated');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin', 'unbreakableMajestyActive', true, campaignName
      );
    }
  );

  it('returns the full activation popup composition', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, 'DungeonMap');

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Test Reaction',
        description: 'Test Reaction activated. For 1_minute, the first attack per turn that hits you forces the attacker to make a CHA save (DC 13) or the attack misses. Ends if you are Incapacitated.',
        automation: action.automation,
      },
    });
  });

  it('writes the active flag and save DC keyed to playerStats.name', async () => {
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

  it('adds activation log entry with DC in the description', async () => {
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
        description: 'Jaina activated Test Reaction. Attacks against them may miss on a failed CHA save (DC 13).',
      })
    );
  });
});

// ── Save DC composition (8 + CHA + proficiency, ||0 defaults) ──

describe('handleUnbreakableMajesty — save DC composition', () => {
  beforeEach(() => resetMocks());

  it.each([
    ['default CHA 3 + prof 2', 13, makePlayerStats()],
    ['ability entry with no name never matches Charisma', 10, makePlayerStats({ abilities: [{ bonus: 5 }] })],
    ['empty abilities array', 10, makePlayerStats({ abilities: [] })],
    ['missing abilities array', 10, (() => { const ps = makePlayerStats(); delete ps.abilities; return ps; })()],
    ['missing proficiency defaults to 0', 11, (() => { const ps = makePlayerStats(); delete ps.proficiency; return ps; })()],
    ['CHA and proficiency both missing', 8, (() => { const ps = makePlayerStats({ abilities: [] }); delete ps.proficiency; return ps; })()],
  ])('%s → DC %i', async (_label, expectedDc, ps) => {
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', expectedDc, campaignName
    );
  });
});

// ── Expiration rounds: parseDurationRounds(auto.duration) || 10 ──

describe('handleUnbreakableMajesty — expiration rounds', () => {
  beforeEach(() => resetMocks());

  it.each([
    ['5_round', 5],
    ['10_round', 10],
    ['1_Round', 1],
    ['1_minute', 10],   // encounter-scoped marker 0 is falsy → ||10
    ['5_minutes', 10], // encounter-scoped marker 0 is falsy → ||10
    ['', 10],          // undefined → ||10
  ])('duration "%s" registers expiration with %i rounds', async (duration, expectedRounds) => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, 'DungeonMap');

    expect(expirations.addExpiration).toHaveBeenCalledWith(majestyExpiration(expectedRounds));
  });
});
