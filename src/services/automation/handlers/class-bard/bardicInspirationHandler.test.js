// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../index.js', () => ({
  executeHandler: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────

import { handle, applyBardicInspiration } from './bardicInspirationHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import * as executeHandlerModule from '../../index.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'Bard';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
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
    it.each([0, -1])('returns info popup when uses are %d (exhausted)', async (uses) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(uses);

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

  describe('no uses_expression on action', () => {
    it('skips uses check when uses_expression is absent', async () => {
      delete action.automation.uses_expression;
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('bardicInspirationTarget');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('no combat context', () => {
    it.each([
      { name: 'null', value: null },
      { name: 'empty object', value: {} },
      { name: 'no creatures array', value: { creatures: undefined } },
      { name: 'empty creatures array', value: { creatures: [] } },
    ])('returns info popup when combatSummary is $name', async ({ value }) => {
      getCombatContext.mockResolvedValue(value);

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

    it('allows self as target when hasCombatOptions passive is present', async () => {
      playerStats.automation.passives = [{ effect: 'bardic_inspiration_combat_options' }];

      getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
      ]));

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
      ]);
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
    });

    it('passes action and playerStats in the modal payload', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
      ]));

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(playerStats);
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('falls back to die size 6 when class data is missing or has no matching level', async () => {
      playerStats.class = {};

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.dieSize).toBe(6);
    });

    it('falls back to die size 6 when class_levels is empty', async () => {
      playerStats.class.class_levels = [];

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.dieSize).toBe(6);
    });

    it('uses class_specific bardic_inspiration_die when class_levels bardic_die is missing', async () => {
      playerStats.class.class_levels = [{ level: 3, class_specific: { bardic_inspiration_die: 10 } }];

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.dieSize).toBe(10);
    });

    it.each([
      { name: 'no matching passive', passives: [{ effect: 'some_other_passive' }] },
      { name: 'empty passives array', passives: [] },
      { name: 'undefined passives', passives: undefined },
    ])('sets hasCombatOptions false when %s', async ({ passives }) => {
      playerStats.automation.passives = passives;

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.hasCombatOptions).toBe(false);
    });

    it('sets hasCombatOptions true when passive is present', async () => {
      playerStats.automation.passives = [{ effect: 'bardic_inspiration_combat_options' }];

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.hasCombatOptions).toBe(true);
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
    addEntry.mockResolvedValue(undefined);
    executeHandlerModule.executeHandler.mockResolvedValue(null);
  });

  describe('uses decrement', () => {
    it('decrements uses when uses_expression is present', async () => {
      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        2,
        campaignName,
      );
    });

    it('does not decrement uses when uses_expression is absent', async () => {
      delete action.automation.uses_expression;

      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        expect.any(Number),
        campaignName,
      );
    });

    it('does not decrement uses when usesMax is 0', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(0);

      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        expect.any(Number),
        campaignName,
      );
    });

    it('uses usesMax as current when runtime value is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        3,
        campaignName,
      );
    });
  });

  describe('target state setting', () => {
    it('sets bardicInspirationDie on the target', async () => {
      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationDie',
        '8',
        campaignName,
      );
    });

    it('sets bardicInspirationGrantedBy on the target', async () => {
      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationGrantedBy',
        playerName,
        campaignName,
      );
    });

    it('sets bardicInspirationUses on the target with current:1 max:1', async () => {
      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationUses',
        { current: 1, max: 1 },
        campaignName,
      );
    });
  });

  describe('combat options', () => {
    it('sets combat options when hasCombatOptions and options are specified', async () => {
      action.automation.options = ['custom_option'];

      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: true,
});

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationCombatOptions',
        JSON.stringify(['custom_option']),
        campaignName,
      );
    });

    it('sets default combat options when hasCombatOptions but no options specified', async () => {
      delete action.automation.options;

      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: true,
});

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationCombatOptions',
        JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']),
        campaignName,
      );
    });

    it('sets self-target state when targetName equals playerStats.name with combat options', async () => {
      action.automation.options = ['custom'];

      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: playerName,
    dieSize: 8,
    hasCombatOptions: true,
});

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationDie',
        '8',
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationGrantedBy',
        playerName,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationCombatOptions',
        JSON.stringify(['custom']),
        campaignName,
      );
    });
  });

  describe('expiration', () => {
    it('calls addExpiration with correct parameters', async () => {
      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: playerName, targetName: 'Fighter', effects: [{ type: 'remove_bardic_inspiration' }], campaignName });
    });
  });

  describe('log entry', () => {
    it('posts a log entry with the die size and target name', async () => {
      await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Bardic Inspiration',
        description: `${playerName} granted Bardic Inspiration (d8) to Fighter.`,
      });
    });
  });

  describe('agile strikes integration', () => {
    it('returns agile strike popup when hasAgileStrikes passive is present and executeHandler returns popup', async () => {
      playerStats.automation.passives = [
        { type: 'passive_rule', effect: 'agile_strike' },
      ];
      executeHandlerModule.executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', description: 'Agile strike applied' },
      });

      const result = await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Agile strike applied');
      expect(executeHandlerModule.executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Agile Strikes',
          automation: { type: 'agile_strike', bardicDie: 8 },
        }),
        playerStats,
        campaignName,
        null,
      );
    });

    it('returns normal popup when hasAgileStrikes but executeHandler returns non-popup', async () => {
      playerStats.automation.passives = [
        { type: 'passive_rule', effect: 'agile_strike' },
      ];
      executeHandlerModule.executeHandler.mockResolvedValue(null);

      const result = await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('d8');
      expect(result.payload.description).toContain('granted to Fighter');
    });

    it('returns normal popup when hasAgileStrikes is false', async () => {
      const result = await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(result.type).toBe('popup');
      expect(executeHandlerModule.executeHandler).not.toHaveBeenCalled();
    });
  });

  describe('return value', () => {
    it('returns a popup with the correct die size and target in the description', async () => {
      const result = await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toContain('d8');
      expect(result.payload.description).toContain('granted to Fighter');
      expect(result.payload.description).toContain('one ability check');
      expect(result.payload.automation).toEqual(action.automation);
    });
  });

  describe('error resilience', () => {
    it('returns success popup even when addEntry rejects', async () => {
      addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')));

      const result = await applyBardicInspiration({
    action,
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
});

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('d8');
    });
  });
});
