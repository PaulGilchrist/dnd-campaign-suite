// @cleaned-by-ai
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
    it('returns info popup when resolveTarget returns null or missing target', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires a target');

      targetResolver.resolveTarget.mockResolvedValue({});
      const result2 = await handle(action, playerStats, campaignName, mapName);

      expect(result2.type).toBe('popup');
      expect(result2.payload.description).toContain('requires a target');
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

    it('skips range check when mapName is null, positions are missing, or incomplete', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      rangeValidation.getDistanceFeet.mockReturnValue(1000);

      let result = await handle(action, playerStats, campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('granted to Ally');
      expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();

      targetResolver.resolveMapPositions.mockResolvedValue(null);
      result = await handle(action, playerStats, campaignName, mapName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('granted to Ally');

      targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 } });
      result = await handle(action, playerStats, campaignName, mapName);
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
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'bardicInspirationGrantedBy',
        'Bard',
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

    it('falls back to die size 6 when class data is missing or no matching level', async () => {
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

    it('uses custom action name in all popup payloads', async () => {
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
