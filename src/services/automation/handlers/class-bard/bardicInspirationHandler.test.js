import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────

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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────

import { handle, applyBardicInspiration } from './bardicInspirationHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

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

function makeCombatSummary(creatures = []) {
  return { creatures };
}

// ── handle() Tests ─────────────────────────────────────────────────

describe('bardicInspirationHandler.handle', () => {
  let action;
  let playerStats;

  beforeEach(() => {
    vi.clearAllMocks();

    action = makeAction();
    playerStats = makePlayerStats();

    automationService.evaluateAutoExpression.mockReturnValue(4);
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
    ]));
  });

  describe('uses exhaustion', () => {
    it('returns info popup when uses are exhausted', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, playerStats, campaignName);

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
    });
  });

  describe('no combat context', () => {
    it('returns info popup when getCombatContext returns null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires a target');
    });

    it('returns info popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([]));

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires a target');
    });
  });

  describe('no valid targets', () => {
    it('returns info popup when only the caster is in combat', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
      ]));

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No valid targets');
    });
  });

  describe('successful modal return', () => {
    it('returns a modal with creatureTargets filtered to exclude self', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
        { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
        { name: 'Wizard', currentHp: 15, maxHp: 20, size: 'Small', type: 'humanoid' },
      ]));

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('bardicInspirationTarget');
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
        { name: 'Wizard', currentHp: 15, maxHp: 20, size: 'Small', type: 'humanoid' },
      ]);
      expect(result.payload.dieSize).toBe(8);
      expect(result.payload.hasCombatOptions).toBe(false);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.action).toEqual(action);
      expect(result.payload.playerStats).toEqual(playerStats);
    });

    it('includes the action and playerStats in the modal payload', async () => {
      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(playerStats);
    });
  });

  describe('die size in modal payload', () => {
    it('uses the bardic_die from class_levels matching the player level', async () => {
      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.dieSize).toBe(8);
    });

    it('falls back to die size 6 when class data has no matching level', async () => {
      playerStats.class = { class_levels: [{ level: 1, bardic_die: 4 }] };

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.dieSize).toBe(6);
    });

    it('falls back to die size 6 when class_levels is missing', async () => {
      playerStats.class = {};

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.dieSize).toBe(6);
    });
  });

  describe('combat options in modal payload', () => {
    it('sets hasCombatOptions true when passive is present', async () => {
      playerStats.automation.passives = [{ effect: 'bardic_inspiration_combat_options' }];

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.hasCombatOptions).toBe(true);
    });

    it('sets hasCombatOptions false when passive is absent', async () => {
      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.hasCombatOptions).toBe(false);
    });
  });

  describe('uses available but not decremented by handle()', () => {
    it('does NOT decrement uses (that happens in applyBardicInspiration)', async () => {
      await handle(action, playerStats, campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});

// ── applyBardicInspiration() Tests ─────────────────────────────────

describe('bardicInspirationHandler.applyBardicInspiration', () => {
  let action;
  let playerStats;

  beforeEach(() => {
    vi.clearAllMocks();

    action = makeAction();
    playerStats = makePlayerStats();

    automationService.evaluateAutoExpression.mockReturnValue(4);
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    postLogEntry.mockResolvedValue(undefined);
  });

  describe('uses decrement', () => {
    it('decrements uses when uses_expression is present', async () => {
      await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, false);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        2,
        campaignName,
      );
    });

    it('does not decrement uses when uses_expression is absent', async () => {
      action.automation.uses_expression = undefined;

      await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, false);

      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        expect.any(Number),
        campaignName,
      );
    });
  });

  describe('runtime values', () => {
    it('sets bardicInspirationDie on the target', async () => {
      await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, false);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationDie',
        '8',
        campaignName,
      );
    });

    it('sets bardicInspirationGrantedBy on the target', async () => {
      await applyBardicInspiration(action, playerStats, campaignName, 'Rogue', 6, false);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Rogue',
        'bardicInspirationGrantedBy',
        'Bard',
        campaignName,
      );
    });
  });

  describe('combat options', () => {
    it('sets combat options when hasCombatOptions and options are specified', async () => {
      action.automation.options = ['custom_option'];

      await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, true);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationCombatOptions',
        JSON.stringify(['custom_option']),
        campaignName,
      );
    });

    it('sets default combat options when hasCombatOptions but no options specified', async () => {
      delete action.automation.options;

      await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, true);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationCombatOptions',
        JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']),
        campaignName,
      );
    });

    it('does not set combat options when hasCombatOptions is false', async () => {
      action.automation.options = ['some_option'];

      await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, false);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationCombatOptions',
        expect.any(String),
        campaignName,
      );
    });
  });

  describe('expiration', () => {
    it('creates an expiration for the granted inspiration', async () => {
      await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, false);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Bard',
        'Fighter',
        [{ type: 'remove_bardic_inspiration' }],
        campaignName,
        100,
      );
    });
  });

  describe('log entry', () => {
    it('posts a log entry with the die size and target name', async () => {
      await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, false);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Bardic Inspiration',
        description: 'Bard granted Bardic Inspiration (d8) to Fighter.',
      });
    });
  });

  describe('return value', () => {
    it('returns a popup with the correct die size in the description', async () => {
      const result = await applyBardicInspiration(action, playerStats, campaignName, 'Fighter', 8, false);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toContain('d8');
      expect(result.payload.description).toContain('granted to Fighter');
      expect(result.payload.description).toContain('one ability check');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('uses the provided die size in the popup description', async () => {
      const result = await applyBardicInspiration(action, playerStats, campaignName, 'Rogue', 6, false);

      expect(result.payload.description).toContain('d6');
      expect(result.payload.description).toContain('granted to Rogue');
    });
  });
});
