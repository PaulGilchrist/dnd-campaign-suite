// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────

import { handle } from './bardicInspirationHandler.js';

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    level: 3,
    class: {
      class_levels: [{ level: 3, bardic_die: 8 }],
    },
    automation: { passives: [] },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Bardic Inspiration',
    automation: { range: '60_ft', uses_expression: '1d4+1', ...overrides.automation },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('bardicInspirationHandler.handle', () => {
  let action;
  let playerStats;

  beforeEach(() => {
    vi.clearAllMocks();

    action = makeAction();
    playerStats = makePlayerStats();

    // Default mocks for the happy path
    automationService.evaluateAutoExpression.mockReturnValue(4);
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
    rangeValidation.rangeToFeet.mockReturnValue(60);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { x: 0, y: 0 },
      targetPos: { x: 10, y: 10 },
    });
    rangeValidation.getDistanceFeet.mockReturnValue(14);
  });

  // ── Uses exhaustion ────────────────────────────────────────────

  describe('uses exhaustion', () => {
    it('returns info popup when uses are exhausted', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(2);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
          automation: action.automation,
        },
      });
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
    });

    it('decrements uses and proceeds when uses are available', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(2);
      useRuntimeState.getRuntimeValue.mockReturnValue(1);

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        0,
        campaignName,
      );
    });

    it('decrements uses by one on success', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(5);

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        4,
        campaignName,
      );
    });

    it('does not decrement uses when uses_expression is absent', async () => {
      action.automation.uses_expression = undefined;

      await handle(action, playerStats, campaignName, mapName);

      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        expect.any(Number),
        campaignName,
      );
    });
  });

  // ── No target ──────────────────────────────────────────────────

  describe('no target', () => {
    it('returns info popup when resolveTarget returns null', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(0);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          description: `${action.name} requires a target. Select a creature in combat and try again.`,
          automation: action.automation,
        },
      });
    });

    it('returns info popup when resolveTarget returns object without target', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue({});

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires a target');
    });

    it('returns info popup when resolveTarget returns undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(undefined);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires a target');
    });
  });

  // ── Range validation ───────────────────────────────────────────

  describe('range validation', () => {
    it('returns info popup when target is out of range', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      rangeValidation.rangeToFeet.mockReturnValue(60);
      rangeValidation.getDistanceFeet.mockReturnValue(100);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('is out of range');
      expect(result.payload.description).toContain('100 ft');
      expect(result.payload.description).toContain('60 ft');
    });

    it('rounds the distance in the out-of-range message', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      rangeValidation.rangeToFeet.mockReturnValue(60);
      rangeValidation.getDistanceFeet.mockReturnValue(99.7);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.payload.description).toContain('100 ft');
    });

    it('skips range check when mapName is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      rangeValidation.getDistanceFeet.mockReturnValue(1000);

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('granted to Ally');
      expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
    });

    it('skips range check when mapName is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, playerStats, campaignName, undefined);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('granted to Ally');
    });

    it('skips range check when resolveMapPositions returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('granted to Ally');
    });

    it('skips range check when positions are incomplete', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 } });

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('granted to Ally');
    });

    it('allows the action when target is within range', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      rangeValidation.rangeToFeet.mockReturnValue(60);
      rangeValidation.getDistanceFeet.mockReturnValue(14);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('granted to Ally');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationDie',
        '8',
        campaignName,
      );
    });
  });

  // ── Die size ───────────────────────────────────────────────────

  describe('die size', () => {
    it('uses the bardic_die from class_levels matching the player level', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationDie',
        '8',
        campaignName,
      );
    });

    it('falls back to die size 6 when class_levels is empty', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.class = { class_levels: [] };

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationDie',
        '6',
        campaignName,
      );
    });

    it('falls back to die size 6 when no matching level is found', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.class = { class_levels: [{ level: 1, bardic_die: 4 }] };

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationDie',
        '6',
        campaignName,
      );
    });

    it('falls back to die size 6 when class is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.class = undefined;

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationDie',
        '6',
        campaignName,
      );
    });

    it('falls back to die size 6 when class_levels is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.class = {};

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationDie',
        '6',
        campaignName,
      );
    });

    it('uses the custom range when specified in action', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      action.automation.range = '120_ft';
      rangeValidation.rangeToFeet.mockReturnValue(120);

      await handle(action, playerStats, campaignName, mapName);

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('120_ft');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationDie',
        '8',
        campaignName,
      );
    });

    it('uses default 60_ft range when action range is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      action.automation.range = undefined;

      await handle(action, playerStats, campaignName, mapName);

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('60_ft');
    });
  });

  // ── Runtime state ──────────────────────────────────────────────

  describe('runtime state', () => {
    it('sets bardicInspirationDie on the target', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationDie',
        '8',
        campaignName,
      );
    });

    it('sets bardicInspirationGrantedBy on the target', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationGrantedBy',
        'Bard',
        campaignName,
      );
    });

    it('converts the die size to a string when setting runtime value', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.class = { class_levels: [{ level: 3, bardic_die: 8 }] };

      await handle(action, playerStats, campaignName, mapName);

      const dieCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'bardicInspirationDie',
      );
      expect(dieCall).toBeDefined();
      expect(dieCall[2]).toBe('8');
    });
  });

  // ── Combat options ─────────────────────────────────────────────

  describe('combat options', () => {
    it('sets combat options when passive is present and options are specified', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.automation.passives = [{ effect: 'bardic_inspiration_combat_options' }];
      action.automation.options = ['custom_option'];

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationCombatOptions',
        JSON.stringify(['custom_option']),
        campaignName,
      );
    });

    it('sets default combat options when passive is present but no options specified', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.automation.passives = [{ effect: 'bardic_inspiration_combat_options' }];
      delete action.automation.options;

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationCombatOptions',
        JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']),
        campaignName,
      );
    });

    it('does not set combat options when passive is absent', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.automation.passives = [];
      action.automation.options = ['some_option'];

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationCombatOptions',
        expect.any(String),
        campaignName,
      );
    });

    it('does not set combat options when passives array is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.automation = {};

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationCombatOptions',
        expect.any(String),
        campaignName,
      );
    });

    it('does not set combat options when passives is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      playerStats.automation = undefined;

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationCombatOptions',
        expect.any(String),
        campaignName,
      );
    });
  });

  // ── Expiration ─────────────────────────────────────────────────

  describe('expiration', () => {
    it('creates an expiration for the granted inspiration', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, playerStats, campaignName, mapName);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Bard',
        'Ally',
        [{ type: 'remove_bardic_inspiration' }],
        campaignName,
        100,
      );
    });
  });

  // ── Return value ───────────────────────────────────────────────

  describe('return value', () => {
    it('returns a popup with the correct die size in the description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toContain('d8');
      expect(result.payload.description).toContain('granted to Ally');
      expect(result.payload.description).toContain('one ability check');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('uses the target name from resolveTarget in the description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Rogue' } });

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.payload.description).toContain('granted to Rogue');
    });

    it('includes the action automation object in the popup payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      const customAutomation = { range: '30_ft', uses_expression: '1d6', extra: true };
      action.automation = customAutomation;

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.payload.automation).toEqual(customAutomation);
    });

    it('uses the action name in all popup payloads', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(
        { ...action, name: 'My Custom Inspiration' },
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.name).toBe('My Custom Inspiration');
      expect(result.payload.description).toContain('My Custom Inspiration');
    });
  });

  // ── Custom action name ─────────────────────────────────────────

  describe('custom action name', () => {
    it('uses custom name in the exhausted popup', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(2);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      const customName = 'Musical Encouragement';

      const result = await handle(
        { ...action, name: customName },
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.name).toBe(customName);
      expect(result.payload.description).toContain('has no uses remaining');
    });

    it('uses custom name in the no-target popup', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);
      const customName = 'Musical Encouragement';

      const result = await handle(
        { ...action, name: customName },
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.name).toBe(customName);
      expect(result.payload.description).toContain('requires a target');
    });
  });
});
