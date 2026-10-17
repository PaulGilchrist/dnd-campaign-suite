// @maintained-by-ai
/**
 * mazeHandler edge-case lane — FIRST of the maze TRIO (spells/):
 *
 *   #  mazeHandler.sp080-escape-concentration.test.js — SP-080 fix contract:
 *      escape success must break the caster's Maze concentration. Mocks
 *      breakConcentration/storage/combatSummary; pins the cache-hit path of
 *      releaseCasterMazeConcentration.
 *   #  mazeHandler.test.js — MAIN: core handle() validation + activation
 *      telemetry, handleEscape refusals, structure-only escape success,
 *      escape failure, removeMazeEffect + isCreatureTrappedInMaze +
 *      isMazeBlocked truth tables.
 *   ✔ THIS FILE — edge-case guards: addEntry rejection resilience (the
 *      .catch guards on every logService call), the vision-gate ALLOW
 *      branches (truesight/blindsight) and object-shaped invisible
 *      conditions, null/empty/missing-shape inputs (null casterCreature,
 *      empty/null metaCtx.creatures, missing abilities/proficiency/dc),
 *      and the trio's only DETERMINISTIC escape-success state-clearing pin
 *      (main's success twin rolls live Math.random and asserts nothing —
 *      flagged to #1934).
 *
 * Cross-file notes (verified at split time):
 *   - getCombatSummary is intentionally NOT mocked here: real implementation
 *     is a pure cache read returning null uncached, pinning the null-guard
 *     in releaseCasterMazeConcentration — complements #1933's cache-hit
 *     lane. storeSpellLastAttack/addExpiration/addConcentration run real
 *     against the mocked runtime store (same posture as main).
 *   - Maze is a no-save automatic trap; the only check is the DC 20 INT
 *     (Investigation) Study action at a turn seam. Escape rolls are rigged
 *     via riggedRandom() (exact capture/restore) — no game timers.
 *   - isCreatureTrappedInMaze has NO production callers (automation/index.js
 *     registers only maze→handle and maze_escape→handleEscape; isMazeBlocked
 *     is consumed by attackBlockers/blockChecks/attackRollHousekeeping;
 *     removeMazeEffect by createRollConditionSaveHandler). Confirmed dead
 *     twin of the banishment/forcecage/imprisonment trapped-predicates —
 *     removal+flag belongs to #1934, which owns its unit tests. Not
 *     covered in this lane.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, handleEscape } from './mazeHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
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

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 15,
    proficiency: 6,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
    spellAbilities: { saveDc: 17 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Maze',
    automation: { type: 'maze', saveDc: 'ability', ...automation },
  };
}

// Exact capture/restore: the old `Math.random = () => Math.random` "restore"
// left Math.random returning a function (NaN rolls) for the rest of the
// worker run — guards "passed" by accident, and leaked into other files.
function riggedRandom(value) {
  const original = Math.random;
  Math.random = () => value;
  return () => { Math.random = original; };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', conditions: [], abilities: { INT: { bonus: 0 }, WIS: { bonus: 0 } }, proficiency: 0 },
    { name: 'Orc', type: 'monster', conditions: [], abilities: { INT: { bonus: 1 }, WIS: { bonus: 0 } }, proficiency: 0 },
    { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, proficiency: 6 },
  ],
  players: [{ name: 'TestCaster' }],
  placedItems: [],
};

describe('mazeHandler.handle - addEntry error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles addEntry rejection gracefully during activation', async () => {
    let currentTargetEffects = [];
    let currentConditions = {};
    let currentConditionMeta = {};

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(17);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      if (key === 'activeConditionMeta') return currentConditionMeta[creatureName] || {};
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
      if (key === 'activeConditionMeta') currentConditionMeta[creatureName] = value;
    });
    logService.addEntry.mockRejectedValue(new Error('Log service error'));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('banished to a labyrinthine demiplane');
    expect(currentTargetEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20, concentration: true }),
      ]),
    );
    expect(currentConditions['Goblin']).toContain('incapacitated');
  });
});

describe('mazeHandler.handleEscape - addEntry error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles addEntry rejection on successful escape (save_result log)', async () => {
    let currentTargetEffects = [
      { effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 },
    ];
    let currentConditions = { Goblin: ['incapacitated'] };
    let currentMazeData = { Goblin: { casterName: 'TestCaster', dc: 20, timestamp: Date.now() } };

    logService.addEntry.mockRejectedValue(new Error('Log service error'));

    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      if (key === 'mazeData') return currentMazeData[creatureName] || null;
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
      if (key === 'mazeData') currentMazeData[creatureName] = value;
    });

    const restore = riggedRandom(0.95); // natural 20, +INT 5 +prof 6 → deterministic success
    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 5 } }, proficiency: 6 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );
    restore();

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('succeeded on INT (Investigation) check');
    expect(currentTargetEffects).toHaveLength(0);
    expect(currentConditions['Goblin']).not.toContain('incapacitated');
  });

  it('handles addEntry rejection on failed escape', async () => {
    logService.addEntry.mockRejectedValue(new Error('Log service error'));

    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }];
      return null;
    });

    const restore = riggedRandom(0); // roll 1, +0 +0 → deterministic failure
    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 0 } }, proficiency: 0 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );
    restore();

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('failed INT (Investigation) check');
    expect(result.payload.description).toContain('remains trapped in the Maze');
  });
});

describe('mazeHandler.handle - truesight/blindsight', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  for (const sense of ['Truesight', 'Blindsight']) {
    it(`allows maze when target is invisible but caster has ${sense.toLowerCase()}`, async () => {
      let currentTargetEffects = [];
      let currentConditions = {};
      let currentConditionMeta = {};

      const combatContext = {
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: ['invisible'], abilities: { INT: { bonus: 0 } }, proficiency: 0 },
          { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, senses: [{ name: sense }], proficiency: 6 },
        ],
        players: [{ name: 'TestCaster' }],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatContext);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      savePrompt.buildSaveDc.mockReturnValue(17);
      runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
        if (key === 'targetEffects') return currentTargetEffects;
        if (key === 'activeConditions') return currentConditions[creatureName] || [];
        if (key === 'activeConditionMeta') return currentConditionMeta[creatureName] || {};
        return null;
      });
      runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
        if (key === 'targetEffects') currentTargetEffects = value;
        if (key === 'activeConditions') currentConditions[creatureName] = value;
        if (key === 'activeConditionMeta') currentConditionMeta[creatureName] = value;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('banished to a labyrinthine demiplane');
      expect(currentConditions['Goblin']).toContain('incapacitated');
    });
  }

  // Object-shaped condition entries: isTargetInvisibleButUnseen parses
  // `typeof c === 'object' ? String(c.key || c)` — main covers string form.
  it('refuses maze when target invisible condition is an object with key property', async () => {
    const combatContext = {
      creatures: [
        { name: 'Goblin', type: 'monster', conditions: [{ key: 'invisible', duration: '1 turn' }], abilities: { INT: { bonus: 0 } }, proficiency: 0 },
        { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, senses: [], proficiency: 6 },
      ],
      players: [{ name: 'TestCaster' }],
    };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(17);
    runtimeState.getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('can\'t see the target');
  });

  // casterCreature absent from combat → `if (casterCreature)` guard must skip
  // addConcentration without throwing; banishment itself still applies.
  it('returns popup when casterCreature is null (no concentration logged)', async () => {
    let currentTargetEffects = [];
    let currentConditions = {};

    const combatContext = {
      creatures: [
        { name: 'Goblin', type: 'monster', conditions: [], abilities: { INT: { bonus: 0 } }, proficiency: 0 },
      ],
      players: [{ name: 'TestCaster' }],
    };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(17);
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('banished to a labyrinthine demiplane');
    expect(currentTargetEffects).toHaveLength(1);
  });
});

describe('mazeHandler.handleEscape - successful escape state clearing (deterministic)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Trio-strongest success pin: main's twin (#1934) rolls live Math.random
  // and asserts popup structure only. Here the d20 is rigged so the full
  // state cleanup contract is pinned, including the uncached-getCombatSummary
  // guard in releaseCasterMazeConcentration (real module returns null).
  it('removes maze effect, mazeData, and incapacitated condition on successful escape', async () => {
    let currentTargetEffects = [
      { effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 },
    ];
    let currentConditions = { Goblin: ['incapacitated'] };
    let currentMazeData = { Goblin: { casterName: 'TestCaster', dc: 20, timestamp: Date.now() } };

    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      if (key === 'mazeData') return currentMazeData[creatureName] || null;
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
      if (key === 'mazeData') currentMazeData[creatureName] = value;
    });

    const restore = riggedRandom(0.95); // natural 20 +INT 5 +prof 6 → deterministic success
    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 5 } }, proficiency: 6 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );
    restore();

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('succeeded on INT (Investigation) check');
    expect(result.payload.description).toContain('escaped the Maze');
    expect(currentTargetEffects).toHaveLength(0);
    expect(currentConditions['Goblin']).not.toContain('incapacitated');
    expect(currentMazeData['Goblin']).toBeNull();
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ type: 'condition', action: 'removed', condition: 'Incapacitated' }),
    );
  });
});

describe('mazeHandler.handleEscape - missing-shape guards and DC defaults', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // metaCtx.creatures empty/null → targetCreature undefined → INT bonus and
  // proficiency default to 0, effect without dc defaults to 20.
  for (const { label, creatures } of [
    { label: 'empty creatures array', creatures: [] },
    { label: 'null creatures', creatures: null },
  ]) {
    it(`handles ${label} in metaCtx`, async () => {
      runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
        if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster' }];
        return null;
      });

      const restore = riggedRandom(0); // roll 1 + 0 + 0 → deterministic failure
      const result = await handleEscape(
        { metaCtx: { mazeTargetName: 'Goblin', creatures } },
        makePlayerStats(),
        campaignName,
        null,
      );
      restore();

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('failed INT (Investigation) check (1 vs DC 20)');
    });
  }

  it('uses default INT bonus 0 when creature abilities missing', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster' }];
      return null;
    });

    const restore = riggedRandom(0.5); // roll 11, +0 (abilities missing) +0
    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', proficiency: 0 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );
    restore();

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('11 vs DC 20');
  });

  it('uses default proficiency 0 when creature proficiency missing', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }];
      return null;
    });

    const restore = riggedRandom(0.5); // roll 11 +INT 3 +0 (proficiency missing)
    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 3 } } }] } },
      makePlayerStats(),
      campaignName,
      null,
    );
    restore();

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('14 vs DC 20');
  });

  it('uses mazeEffect.dc when provided instead of default 20', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 25 }];
      return null;
    });

    const restore = riggedRandom(0.95); // natural 20 + 0 + 0 = 20 → fails vs custom DC 25
    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 0 } }, proficiency: 0 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );
    restore();

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('(20 vs DC 25)');
  });
});
