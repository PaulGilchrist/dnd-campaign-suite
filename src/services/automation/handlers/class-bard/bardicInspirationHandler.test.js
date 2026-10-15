// @maintained-by-ai
// Deterministic: every external dependency (runtime store, combat context, dice
// expression, expirations, log, executeHandler dispatch) is mocked, so this
// suite pins the bardicInspirationHandler contract — use-gate refusals, pool
// read/decrement semantics, target grant keys, agile_strike passive dispatch —
// without touching moving app parts.
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

function applyGrant(playerStats, overrides = {}) {
  return applyBardicInspiration({
    action: makeAction(),
    playerStats,
    campaignName,
    targetName: 'Fighter',
    dieSize: 8,
    hasCombatOptions: false,
    ...overrides,
  });
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
          automationType: 'bardic_inspiration_refused',
          description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
          automation: action.automation,
        },
      });
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('logs an automation/bardic_inspiration_refused entry at 0 uses', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      await handle(action, playerStats, campaignName);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: playerName,
        automationType: 'bardic_inspiration_refused',
      }));
    });

    it('refuses when pool is an unparseable non-numeric value (NaN cannot bypass the gate)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('not-a-number');

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.automationType).toBe('bardic_inspiration_refused');
    });

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
      { name: 'no creatures array', value: {} },
      { name: 'empty creatures array', value: { creatures: [] } },
    ])('returns info popup when combatSummary is $name', async ({ value }) => {
      getCombatContext.mockResolvedValue(value);

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires a target');
    });
  });

  describe('target filtering', () => {
    it('returns info popup when only the caster is in combat', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
      ]));

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No valid targets');
    });

    it('allows self as target and flags hasCombatOptions when the passive is present', async () => {
      playerStats.automation.passives = [{ effect: 'bardic_inspiration_combat_options' }];

      getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
      ]));

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('modal');
      expect(result.payload.hasCombatOptions).toBe(true);
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
      ]);
    });

    it('returns a modal with creatureTargets filtered to exclude self and full payload', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
        { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
        { name: 'Wizard', currentHp: 15, maxHp: 20, size: 'Small', type: 'humanoid' },
      ]));

      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('bardicInspirationTarget');
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(playerStats);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
        { name: 'Wizard', currentHp: 15, maxHp: 20, size: 'Small', type: 'humanoid' },
      ]);
      expect(result.payload.dieSize).toBe(8);
      expect(result.payload.hasCombatOptions).toBe(false);
    });

    it.each([
      { name: 'no matching passive', passives: [{ effect: 'some_other_passive' }] },
      { name: 'undefined passives', passives: undefined },
    ])('sets hasCombatOptions false when %s', async ({ passives }) => {
      playerStats.automation.passives = passives;

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.hasCombatOptions).toBe(false);
    });
  });

  describe('die size resolution', () => {
    it.each([
      { name: 'class data is missing', mutate: (stats) => { stats.class = {}; } },
      { name: 'class_levels is empty', mutate: (stats) => { stats.class.class_levels = []; } },
    ])('falls back to die size 6 when $name', async ({ mutate }) => {
      mutate(playerStats);

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.dieSize).toBe(6);
    });

    it('uses class_specific bardic_inspiration_die when class_levels bardic_die is missing', async () => {
      playerStats.class.class_levels = [{ level: 3, class_specific: { bardic_inspiration_die: 10 } }];

      const result = await handle(action, playerStats, campaignName);

      expect(result.payload.dieSize).toBe(10);
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

  function apply(overrides = {}) {
    return applyGrant(playerStats, { action, ...overrides });
  }

  describe('uses pool decrement', () => {
    it('decrements numeric pool when uses_expression is present', async () => {
      await apply();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        2,
        campaignName,
      );
    });

    it('reads a stale corrupt object pool as current and rewrites the pool numeric', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (name === playerName && key === 'bardicInspirationUses') return { current: 2, max: 5 };
        return null;
      });

      await apply();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        1,
        campaignName,
      );
    });

    it('uses usesMax as current when runtime value is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await apply();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        3,
        campaignName,
      );
    });

    it('does not decrement uses when uses_expression is absent', async () => {
      delete action.automation.uses_expression;

      await apply();

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        expect.any(Number),
        campaignName,
      );
    });

    it('does not decrement uses when usesMax is 0', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(0);

      await apply();

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        playerName,
        'bardicInspirationUses',
        expect.any(Number),
        campaignName,
      );
    });
  });

  describe('target grant state', () => {
    it('sets die, grantedBy, and granted-token uses on the target', async () => {
      await apply();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationDie',
        '8',
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationGrantedBy',
        playerName,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationUses',
        { current: 1, max: 1 },
        campaignName,
      );
    });

    it('does not clobber the bard pool with the grant object on self-grant and keeps the pool decrement numeric', async () => {
      const calls = [];
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (name === playerName && key === 'bardicInspirationUses') return 3;
        return null;
      });
      useRuntimeState.setRuntimeValue.mockImplementation((name, key, val) => {
        calls.push([name, key, val]);
        return Promise.resolve();
      });

      await apply({ targetName: playerName, dieSize: 12 });

      expect(calls).toContainEqual([playerName, 'bardicInspirationUses', 2]);
      const poolWrites = calls.filter(([, key]) => key === 'bardicInspirationUses');
      expect(poolWrites.length).toBe(1);
      expect(typeof poolWrites[0][2]).toBe('number');
      expect(calls).toContainEqual([playerName, 'bardicInspirationDie', '12']);
      expect(calls).toContainEqual([playerName, 'bardicInspirationGrantedBy', playerName]);
    });
  });

  describe('combat options', () => {
    it('sets combat options when hasCombatOptions and options are specified', async () => {
      action.automation.options = ['custom_option'];

      await apply({ hasCombatOptions: true });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationCombatOptions',
        JSON.stringify(['custom_option']),
        campaignName,
      );
    });

    it('sets default combat options when hasCombatOptions but no options specified', async () => {
      delete action.automation.options;

      await apply({ hasCombatOptions: true });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'bardicInspirationCombatOptions',
        JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']),
        campaignName,
      );
    });

    it('writes grant state once to the bard on self-grant with combat options', async () => {
      const calls = [];
      useRuntimeState.setRuntimeValue.mockImplementation((name, key, val) => {
        calls.push([name, key, val]);
        return Promise.resolve();
      });
      action.automation.options = ['custom'];

      await apply({ targetName: playerName, hasCombatOptions: true });

      expect(calls).toContainEqual([playerName, 'bardicInspirationDie', '8']);
      expect(calls).toContainEqual([playerName, 'bardicInspirationGrantedBy', playerName]);
      expect(calls).toContainEqual([playerName, 'bardicInspirationCombatOptions', JSON.stringify(['custom'])]);
      const dieWrites = calls.filter(([, key]) => key === 'bardicInspirationDie');
      expect(dieWrites.length).toBe(1);
    });
  });

  describe('expiration', () => {
    it('calls addExpiration with correct parameters', async () => {
      await apply();

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: playerName, targetName: 'Fighter', effects: [{ type: 'remove_bardic_inspiration' }], campaignName });
    });
  });

  describe('log entry', () => {
    it('posts a log entry with the die size and target name', async () => {
      await apply();

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Bardic Inspiration',
        description: `${playerName} granted Bardic Inspiration (d8) to Fighter.`,
      });
    });

    it('returns success popup even when addEntry rejects', async () => {
      addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')));

      const result = await apply();

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('d8');
    });
  });

  describe('agile strikes dispatch', () => {
    it('dispatches Agile Strikes and returns its popup when the passive_rule is present', async () => {
      playerStats.automation.passives = [
        { type: 'passive_rule', effect: 'agile_strike' },
      ];
      executeHandlerModule.executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', description: 'Agile strike applied' },
      });

      const result = await apply();

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

    it('returns the normal grant popup when executeHandler returns non-popup', async () => {
      playerStats.automation.passives = [
        { type: 'passive_rule', effect: 'agile_strike' },
      ];
      executeHandlerModule.executeHandler.mockResolvedValue(null);

      const result = await apply();

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('d8');
      expect(result.payload.description).toContain('granted to Fighter');
    });

    it.each([
      { name: 'passives are empty', passives: [] },
      { name: 'agile_strike lacks the passive_rule type', passives: [{ effect: 'agile_strike' }] },
    ])('does not dispatch when %s', async ({ passives }) => {
      playerStats.automation.passives = passives;

      await apply();

      expect(executeHandlerModule.executeHandler).not.toHaveBeenCalled();
    });
  });

  describe('return value', () => {
    it('returns a popup with the correct die size and target in the description', async () => {
      const result = await apply();

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toContain('d8');
      expect(result.payload.description).toContain('granted to Fighter');
      expect(result.payload.description).toContain('one ability check');
      expect(result.payload.automation).toEqual(action.automation);
    });
  });
});
