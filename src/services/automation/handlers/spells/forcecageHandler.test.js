// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, handleEscape, isForcecageBlocked, isCreatureTrappedInForcecage, removeForcecageEffect } from './forcecageHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 13,
    proficiency: 5,
    abilities: [{ name: 'Charisma', bonus: 4 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Forcecage',
    automation: { type: 'forcecage', saveDc: 'ability', saveAbility: 'CHA', concentration: true, ruleset: '2024', ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

function mockGetRuntimeValue(targetEffects) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
    if (key === 'targetEffects') return targetEffects;
    return null;
  });
}

function setupCombat(metaCtx) {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  savePrompt.buildSaveDc.mockReturnValue(17);
  combatData.getCombatSummary.mockReturnValue({ creatures: baseCombatContext.creatures });
  mockGetRuntimeValue([]);
  const action = makeAction();
  action.metaCtx = metaCtx;
  return action;
}

describe('forcecageHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when no combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target selection validation', () => {
    it('logs an error and returns popup when metaCtx.creatures is missing (no fallback)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const action = setupCombat(undefined);

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[forcecage] No creatures selected'),
      );
      expect(result.payload.description).toContain('No creatures selected');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('logs an error and returns popup when metaCtx.creatures is an empty array', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const action = setupCombat({ creatures: [] });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures selected');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns popup when selected creatures are not present in combat', async () => {
      const action = setupCombat({ creatures: ['Ghost'] });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No creatures selected');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('activation', () => {
    it('applies forcecage target effects to selected creatures and registers concentration', async () => {
      let currentTargetEffects = [];
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(17);
      combatData.getCombatSummary.mockReturnValue({ creatures: baseCombatContext.creatures });
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return currentTargetEffects;
        return null;
      });
      runtimeState.setRuntimeValue.mockImplementation((scope, key, value, _campaign) => {
        if (key === 'targetEffects') currentTargetEffects = value;
      });
      const action = makeAction();
      action.metaCtx = { creatures: ['Goblin', 'Orc'] };
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('Orc');

      expect(currentTargetEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ target: 'Goblin', effect: 'forcecage', source: 'TestCaster', dc: 17, saveAbility: 'CHA', duration: 'concentration', concentration: true }),
          expect.objectContaining({ target: 'Orc', effect: 'forcecage', source: 'TestCaster', dc: 17 }),
        ]),
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.anything(),
        'TestCaster',
        'Forcecage',
        expect.any(Number),
      );
      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: [{ type: 'remove_target_effect', effectKey: 'forcecage', target: 'Goblin', source: 'TestCaster' }], campaignName });
    });

    it('allows trapping the caster when selected', async () => {
      const action = setupCombat({ creatures: ['TestCaster'] });
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ target: 'TestCaster', effect: 'forcecage', source: 'TestCaster' }),
        ]),
        campaignName,
      );
    });

    it('logs a condition applied entry for each trapped creature', async () => {
      const action = setupCombat({ creatures: ['Goblin'] });
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Forcecaged',
        }),
      );
    });

    it('does not register concentration when no combat summary exists', async () => {
      const action = setupCombat({ creatures: ['Goblin'] });
      combatData.getCombatSummary.mockReturnValue(null);

      await handle(action, makePlayerStats(), campaignName, null);

      expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    });
  });
});

describe('forcecageHandler.isForcecageBlocked', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns false when neither creature is trapped', () => {
    mockGetRuntimeValue([{ target: 'Goblin', effect: 'forcecage', source: 'Wizard' }]);
    expect(isForcecageBlocked('Orc', 'TestCaster', campaignName)).toBe(false);
  });

  it('returns true when attacker is trapped and target is outside', () => {
    mockGetRuntimeValue([{ target: 'Goblin', effect: 'forcecage', source: 'Wizard' }]);
    expect(isForcecageBlocked('Goblin', 'Orc', campaignName)).toBe(true);
  });

  it('returns true when target is trapped and attacker is outside', () => {
    mockGetRuntimeValue([{ target: 'Goblin', effect: 'forcecage', source: 'Wizard' }]);
    expect(isForcecageBlocked('Orc', 'Goblin', campaignName)).toBe(true);
  });

  it('returns false when both creatures share the same cage', () => {
    mockGetRuntimeValue([
      { target: 'Goblin', effect: 'forcecage', source: 'Wizard' },
      { target: 'Orc', effect: 'forcecage', source: 'Wizard' },
    ]);
    expect(isForcecageBlocked('Goblin', 'Orc', campaignName)).toBe(false);
  });

  it('returns true when creatures are trapped in different cages', () => {
    mockGetRuntimeValue([
      { target: 'Goblin', effect: 'forcecage', source: 'Wizard' },
      { target: 'Orc', effect: 'forcecage', source: 'Sorcerer' },
    ]);
    expect(isForcecageBlocked('Goblin', 'Orc', campaignName)).toBe(true);
  });

  it('returns false when no forcecage effects exist', () => {
    mockGetRuntimeValue([]);
    expect(isForcecageBlocked('Goblin', 'Orc', campaignName)).toBe(false);
  });

  it('returns false when a name is missing', () => {
    mockGetRuntimeValue([{ target: 'Goblin', effect: 'forcecage', source: 'Wizard' }]);
    expect(isForcecageBlocked(null, 'Orc', campaignName)).toBe(false);
    expect(isForcecageBlocked('Goblin', undefined, campaignName)).toBe(false);
  });
});

describe('forcecageHandler.isCreatureTrappedInForcecage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns true when creature has a forcecage effect', () => {
    mockGetRuntimeValue([{ target: 'Goblin', effect: 'forcecage', source: 'Wizard' }]);
    expect(isCreatureTrappedInForcecage('Goblin')).toBe(true);
    expect(isCreatureTrappedInForcecage('Orc')).toBe(false);
  });

  it('returns false when no effects exist', () => {
    mockGetRuntimeValue([]);
    expect(isCreatureTrappedInForcecage('Goblin')).toBe(false);
  });
});

describe('forcecageHandler.removeForcecageEffect', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('removes only the matching forcecage effect', () => {
    mockGetRuntimeValue([
      { target: 'Goblin', effect: 'forcecage', source: 'Wizard' },
      { target: 'Orc', effect: 'forcecage', source: 'Wizard' },
      { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
    ]);

    const removed = removeForcecageEffect('Goblin', 'Wizard', campaignName);

    expect(removed).toEqual(expect.objectContaining({ target: 'Goblin', effect: 'forcecage', source: 'Wizard' }));
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({ target: 'Orc', effect: 'forcecage' }),
        expect.objectContaining({ target: 'Goblin', effect: 'silenced' }),
      ]),
      campaignName,
    );
    expect(runtimeState.setRuntimeValue.mock.calls[0][2].some(te => te.effect === 'forcecage' && te.target === 'Goblin')).toBe(false);
  });

  it('returns null when no matching effect exists', () => {
    mockGetRuntimeValue([{ target: 'Orc', effect: 'forcecage', source: 'Wizard' }]);

    const removed = removeForcecageEffect('Goblin', 'Wizard', campaignName);

    expect(removed).toBeNull();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('forcecageHandler.handleEscape', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns popup when no target specified', async () => {
    const result = await handleEscape({ metaCtx: {} }, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toContain('No target specified');
  });

  it('returns popup when creature is not trapped', async () => {
    mockGetRuntimeValue([{ target: 'Goblin', effect: 'forcecage', source: 'Wizard' }]);
    const result = await handleEscape({ metaCtx: { target: 'Orc' } }, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toContain('is not trapped');
  });

  it('removes the forcecage effect and logs success on a successful save', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    mockGetRuntimeValue([{ target: 'Goblin', effect: 'forcecage', source: 'Wizard', dc: 15 }]);
    const action = { metaCtx: { target: 'Goblin', creatures: [{ name: 'Goblin', abilities: { CHA: { bonus: 5 } }, proficiency: 4 }] } };

    const result = await handleEscape(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('escaped');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [],
      campaignName,
    );
    vi.restoreAllMocks();
  });

  it('keeps the effect and logs failure on a failed save', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    mockGetRuntimeValue([{ target: 'Goblin', effect: 'forcecage', source: 'Wizard', dc: 15 }]);
    const action = { metaCtx: { target: 'Goblin', creatures: [{ name: 'Goblin', abilities: { CHA: { bonus: 0 } }, proficiency: 0 }] } };

    const result = await handleEscape(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('remains trapped');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
