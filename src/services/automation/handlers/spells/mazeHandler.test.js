/**
 * mazeHandler MAIN lane — THIRD of the maze TRIO (spells/), closes the family:
 *
 *   #  mazeHandler.edgeCases.test.js — FIRST (maintained): error/shape guards,
 *      addEntry rejections on all cast/escape log lanes, vision-gate ALLOW
 *      branches (truesight/blindsight), object-shaped invisible conditions,
 *      the trio's deterministic state-clearing contains-pins + the uncached
 *      getCombatSummary null-guard twin.
 *   #  mazeHandler.sp080-escape-concentration.test.js — SECOND (maintained):
 *      SP-080 release-concentration cache-hit canon + full-string release log
 *      — its release-path pins are NOT re-absorbed here.
 *   ✔ THIS FILE — core handle() refusals (no context/no creatures/no target/
 *      target absent/invisible-denied) + full activation telemetry (exact
 *      popup string, strict targetEffects table, mazeData/condition-meta
 *      writes, live storeSpellLastAttack stamp, addExpiration shape,
 *      concentration DC math, full-string cast logs), handleEscape refusals
 *      with no-side-effect guards, deterministic escape SUCCESS and FAILURE
 *      (own-composition full-string + exact-dice log pins), removeMazeEffect
 *      + isMazeBlocked truth tables.
 *
 * Shed candidate absorbed (flagged from edgeCases header): the old success
 * twin rolled live Math.random and asserted nothing. It is now rigged to a
 * deterministic natural 20 (riggedRandom, exact capture/restore — adopted
 * from the edgeCases lane) and pins main's own escape telemetry composition:
 * the full popup string and the exact-dice ability_use / save_result logs.
 * State-clearing remains pinned trio-wide: fine-grained clearing belongs to
 * edgeCases, caster-concentration release to sp080 — neither is duplicated
 * beyond the one-line confirmation each path needs here.
 *
 * Production liveness (re-verified 2026-10-16 by grep incl. dynamic dispatch
 * and automation/index.js registration):
 *   - handle → index.js maze; handleEscape → index.js maze_escape;
 *     removeMazeEffect → index.js remove_maze + createRollConditionSaveHandler.
 *   - isMazeBlocked: LIVE gate — attackBlockers.js L9, blockChecks.js L127,
 *     attackRollHousekeeping.js L11 (mirrors isBanishmentBlocked/isImprisonment
 *     Blocked gate siblings) — full contract kept.
 *   - isCreatureTrappedInMaze: DEAD export — zero non-test callers repo-wide
 *     and unused inside its own module (handle inlines its filter, handleEscape
 *     does its own find()). Fourth of the trapped-twin dead set
 *     (banishment/forcecage/imprisonment/maze): describe REMOVED per the
 *     #1916/#1927 precedent; export deletion flagged for owner sign-off.
 *
 * Turn-based: escape is a d20+INT+prof vs mazeEffect.dc||20 at the Study-action
 * turn seam — no saves, no game timers. storeSpellLastAttack runs live against
 * the mocked runtime store (main posture); releaseCasterMazeConcentration's
 * release branch runs live with real getCombatSummary returning null uncached
 * (cache-hit canon lives in the sp080 lane).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, handleEscape, removeMazeEffect, isMazeBlocked } from './mazeHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';

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

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// breakConcentration is mocked inert here — the SP-080 release-path pins
// (cache-hit break + persist + release log) belong to the sp080 lane.
vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

const campaignName = 'test-campaign';

// Exact capture/restore (adopted from the edgeCases lane): guards against the
// trio's historical `Math.random = () => Math.random` restore poison.
function riggedRandom(value) {
  const original = Math.random;
  Math.random = () => value;
  return () => { Math.random = original; };
}

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

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', conditions: [], abilities: { INT: { bonus: 0 }, WIS: { bonus: 0 } }, proficiency: 0 },
    { name: 'Orc', type: 'monster', conditions: [], abilities: { INT: { bonus: 1 }, WIS: { bonus: 0 } }, proficiency: 0 },
    { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, proficiency: 6 },
  ],
  players: [{ name: 'TestCaster' }],
  placedItems: [],
};

function mockGetRuntimeValue(targetEffects) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
    if (key === 'targetEffects') return targetEffects;
    if (key === 'activeConditions') return [];
    if (key === 'activeConditionMeta') return {};
    return null;
  });
}

describe('mazeHandler.handle - refusals', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns popup when no combat context exists', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('No creatures in combat. Maze has no effect.');
  });

  it('returns popup when combat context has no creatures', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
    expect(result.payload.description).toBe('No creatures in combat. Maze has no effect.');
  });

  it('returns popup when no target selected', async () => {
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    targetResolver.resolveTarget.mockResolvedValue(null);
    mockGetRuntimeValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toBe('No target selected. Maze has no effect.');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('returns popup when target not found in combat', async () => {
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ghost' } });
    mockGetRuntimeValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toBe('Target "Ghost" not found in combat. Maze has no effect.');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when target is invisible and caster lacks truesight/blindsight', async () => {
    const combatContext = {
      creatures: [
        { name: 'Goblin', type: 'monster', conditions: ['invisible'], abilities: { INT: { bonus: 0 } }, proficiency: 0 },
        { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, senses: [], proficiency: 6 },
      ],
    };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    mockGetRuntimeValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toBe("Goblin is invisible. You can't see the target. Maze has no effect.");
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('mazeHandler.handle - activation telemetry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function setupActivationStore(initialTargetEffects = []) {
    const store = {
      targetEffects: initialTargetEffects,
      conditions: {},
      conditionMeta: {},
      mazeData: {},
    };
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return store.targetEffects;
      if (key === 'activeConditions') return store.conditions[creatureName] || [];
      if (key === 'activeConditionMeta') return store.conditionMeta[creatureName] || {};
      if (key === 'mazeData') return store.mazeData[creatureName] || null;
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') store.targetEffects = value;
      if (key === 'mazeData') store.mazeData[creatureName] = value;
      if (key === 'activeConditions') store.conditions[creatureName] = value;
      if (key === 'activeConditionMeta') store.conditionMeta[creatureName] = value;
    });
    return store;
  }

  it('banishes the target: exact popup, strict effect table, condition/meta/mazeData writes, concentration and expiration registration, full-string cast logs', async () => {
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(17);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    const store = setupActivationStore();

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Maze');
    expect(result.payload.description).toBe(
      'Goblin is banished to a labyrinthine demiplane. Goblin is Incapacitated and can take a Study action (DC 20 INT Investigation) to escape.',
    );

    // Fixed escape DC 20 on the effect (not the ability-derived save DC 17).
    expect(store.targetEffects).toEqual([
      {
        effect: 'maze',
        target: 'Goblin',
        source: 'TestCaster',
        dc: 20,
        duration: 'Concentration, up to 10 minutes',
        concentration: true,
      },
    ]);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'mazeData',
      expect.objectContaining({ casterName: 'TestCaster', dc: 20 }),
      campaignName,
    );
    expect(store.conditions['Goblin']).toEqual(['incapacitated']);
    expect(store.conditionMeta['Goblin'].incapacitated).toEqual({ dc: 20, ability: 'wis' });

    // Live storeSpellLastAttack stamp (rollback tracking, main posture).
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'lastAttack',
      expect.objectContaining({
        attackerName: 'TestCaster',
        attackName: 'Maze',
        rollType: 'spell-save',
        saveType: 'WIS',
        saveDc: 17,
        attackScope: 'single',
      }),
      campaignName,
    );

    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'TestCaster',
      targetName: 'Goblin',
      effects: [
        { type: 'condition', condition: 'incapacitated' },
        { type: 'remove_target_effect', effectKey: 'maze', target: 'Goblin', source: 'TestCaster' },
      ],
      campaignName,
    });

    // concentrationDc = 8 + proficiency(6) + CON bonus(0 — abilities is an
    // array on playerStats here, so the CON lookup misses) = 14.
    expect(concentrationService.addConcentration).toHaveBeenCalledWith(baseCombatContext, 'TestCaster', 'Maze', 14);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Maze',
      description: 'TestCaster casts Maze on Goblin! Goblin is banished to a labyrinthine demiplane.',
    }));
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'applied',
      characterName: 'Goblin',
      condition: 'Incapacitated',
      reason: 'Maze',
      note: 'Goblin is Incapacitated by Maze (banished to a labyrinthine demiplane). Target can take a Study action (DC 20 INT Investigation) to escape.',
    }));
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'save_result',
      characterName: 'TestCaster',
      rollType: 'save-maze',
      targetName: 'Goblin',
      saveDc: 17,
      saveType: 'WIS',
      success: false,
      description: 'Goblin is banished to a labyrinthine demiplane by Maze.',
    }));
  });

  it('replaces an existing maze effect from the same caster and preserves unrelated effects', async () => {
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(17);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    const store = setupActivationStore([
      { effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20, concentration: true },
      { effect: 'faerie_fire', target: 'Orc', source: 'TestCaster' },
    ]);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(store.targetEffects.filter(te => te.effect === 'maze')).toHaveLength(1);
    expect(store.targetEffects).toEqual([
      { effect: 'faerie_fire', target: 'Orc', source: 'TestCaster' },
      expect.objectContaining({ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }),
    ]);
  });

  it('keeps other casters\' maze effects on the same target intact', async () => {
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(17);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    const store = setupActivationStore([
      { effect: 'maze', target: 'Goblin', source: 'Wizard', dc: 20 },
    ]);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(store.targetEffects.filter(te => te.effect === 'maze')).toHaveLength(2);
    expect(store.targetEffects.map(te => te.source)).toEqual(['Wizard', 'TestCaster']);
  });
});

describe('mazeHandler.handleEscape - refusals', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns popup when no mazeTargetName in metaCtx', async () => {
    const result = await handleEscape({ metaCtx: {} }, makePlayerStats(), campaignName, null);
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Maze Escape');
    expect(result.payload.description).toBe('No target specified for Maze escape check.');
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('returns popup when no maze effect on target', async () => {
    mockGetRuntimeValue([]);

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 0 } }, proficiency: 0 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    expect(result.payload.description).toBe('Goblin is not trapped by Maze.');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});

describe('mazeHandler.handleEscape - escape success (deterministic)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Shed candidate absorbed: the old twin rolled live dice and asserted
  // nothing. Rigged natural 20 + INT 5 + prof 6 = 31 vs DC 20 — this lane
  // pins the full-popup + exact-dice telemetry composition; fine-grained
  // clearing stays with edgeCases, caster-concentration release with sp080
  // (breakConcentration mocked inert; live getCombatSummary returns null
  // uncached, so the release branch is exercised through its null guard).
  it('escapes on rigged INT check 20+5+6=31 vs DC 20: exact popup, exact-dice logs, state cleared', async () => {
    const store = {
      targetEffects: [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }],
      conditions: { Goblin: ['incapacitated', 'poisoned'] },
      mazeData: { Goblin: { casterName: 'TestCaster', dc: 20 } },
    };
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return store.targetEffects;
      if (key === 'activeConditions') return store.conditions[creatureName] || [];
      if (key === 'mazeData') return store.mazeData[creatureName] || null;
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') store.targetEffects = value;
      if (key === 'activeConditions') store.conditions[creatureName] = value;
      if (key === 'mazeData') store.mazeData[creatureName] = value;
    });

    const restore = riggedRandom(0.95); // natural 20
    let result;
    try {
      result = await handleEscape(
        { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 5 } }, proficiency: 6 }] } },
        makePlayerStats(),
        campaignName,
        null,
      );
    } finally {
      restore();
    }

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe(
      'Goblin succeeded on INT (Investigation) check (31 vs DC 20) and escaped the Maze. Goblin reappears in the space it left, or the nearest unoccupied space if that space is occupied.',
    );

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'Goblin',
      abilityName: 'Maze Escape Attempt (Study Action)',
      description: 'Goblin attempts to escape Maze using Study action. INT (Investigation) check: 20 + 11 = 31 vs DC 20.',
    }));
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'save_result',
      rollType: 'save-maze-escape',
      targetName: 'Goblin',
      saveDc: 20,
      saveType: 'INT',
      success: true,
      description: 'Goblin succeeded on INT (Investigation) check (31 vs DC 20) and escaped the Maze.',
    }));
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'removed',
      characterName: 'Goblin',
      condition: 'Incapacitated',
      reason: 'Maze escape',
    }));

    // Clearing one-line confirmation (deep clearing contract: edgeCases).
    expect(store.targetEffects).toHaveLength(0);
    expect(store.mazeData['Goblin']).toBeNull();
    expect(store.conditions['Goblin']).toEqual(['poisoned']);
    expect(concentrationService.breakConcentration).not.toHaveBeenCalled(); // sp080 lane owns the cache-hit canon
  });
});

describe('mazeHandler.handleEscape - escape failure', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rigged roll 1 fails vs DC 20: exact failure popup and log, no state writes', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_creatureName, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }];
      return null;
    });

    const restore = riggedRandom(0); // roll 1 + INT 0 + prof 0 → deterministic failure
    let result;
    try {
      result = await handleEscape(
        { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 0 } }, proficiency: 0 }] } },
        makePlayerStats(),
        campaignName,
        null,
      );
    } finally {
      restore();
    }

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe(
      'Goblin failed INT (Investigation) check (1 vs DC 20) and remains trapped in the Maze.',
    );

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'Goblin',
      abilityName: 'Maze Escape Attempt (Study Action)',
      description: 'Goblin attempts to escape Maze using Study action. INT (Investigation) check: 1 + 0 = 1 vs DC 20.',
    }));
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'save_result',
      rollType: 'save-maze-escape',
      targetName: 'Goblin',
      saveDc: 20,
      saveType: 'INT',
      success: false,
      description: 'Goblin failed INT (Investigation) check (1 vs DC 20) and remains trapped in the Maze.',
    }));

    // Failure is a pure-read path: nothing is cleared or rewritten.
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(concentrationService.breakConcentration).not.toHaveBeenCalled();
  });
});

describe('mazeHandler.removeMazeEffect (live — createRollConditionSaveHandler + index.js remove_maze)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns null and never writes when no maze effect exists (exact-key store read)', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    const result = removeMazeEffect('Goblin', 'TestCaster', campaignName);

    expect(result).toBeNull();
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('removes the maze effect and returns it', () => {
    const effects = [
      { effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 },
      { effect: 'faerie_fire', target: 'Orc', source: 'TestCaster' },
    ];
    let storedEffects = [...effects];
    runtimeState.getRuntimeValue.mockReturnValue(storedEffects);
    runtimeState.setRuntimeValue.mockImplementation((scope, key, value) => {
      if (key === 'targetEffects') storedEffects = value;
    });

    const result = removeMazeEffect('Goblin', 'TestCaster', campaignName);

    expect(result).toEqual(expect.objectContaining({ effect: 'maze', target: 'Goblin', source: 'TestCaster' }));
    expect(storedEffects).toHaveLength(1);
    expect(storedEffects[0].effect).toBe('faerie_fire');
  });

  it('does not remove maze effect from different target', () => {
    const effects = [
      { effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 },
      { effect: 'maze', target: 'Orc', source: 'TestCaster', dc: 20 },
    ];
    let storedEffects = [...effects];
    runtimeState.getRuntimeValue.mockReturnValue(storedEffects);
    runtimeState.setRuntimeValue.mockImplementation((scope, key, value) => {
      if (key === 'targetEffects') storedEffects = value;
    });

    removeMazeEffect('Goblin', 'TestCaster', campaignName);

    expect(storedEffects).toHaveLength(1);
    expect(storedEffects[0].target).toBe('Orc');
  });

  it('does not remove maze effect from different source', () => {
    const effects = [
      { effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 },
      { effect: 'maze', target: 'Goblin', source: 'OtherCaster', dc: 20 },
    ];
    let storedEffects = [...effects];
    runtimeState.getRuntimeValue.mockReturnValue(storedEffects);
    runtimeState.setRuntimeValue.mockImplementation((scope, key, value) => {
      if (key === 'targetEffects') storedEffects = value;
    });

    removeMazeEffect('Goblin', 'TestCaster', campaignName);

    expect(storedEffects).toHaveLength(1);
    expect(storedEffects[0].source).toBe('OtherCaster');
  });
});

// isCreatureTrappedInMaze: DEAD export — zero non-test callers repo-wide
// (grep 2026-10-16 incl. dynamic dispatch and automation/index.js registration,
// which wires only maze→handle, maze_escape→handleEscape, remove_maze→
// removeMazeEffect). Unused inside its own module too: handle() inlines its
// own filter and handleEscape() does its own find(). Fourth confirmed-dead
// twin of the trapped predicates (banishment #1875-adjacent / forcecage #1916
// / imprisonment #1927): tests removed per precedent, export deletion flagged
// for owner sign-off.

describe('mazeHandler.isMazeBlocked (live gate — attackBlockers L9, blockChecks L127, attackRollHousekeeping L11)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    [null, 'Goblin', 'null attacker'],
    [undefined, 'Goblin', 'undefined attacker'],
    ['', 'Goblin', 'empty attacker'],
    ['TestCaster', null, 'null target'],
    ['TestCaster', undefined, 'undefined target'],
    ['TestCaster', '', 'empty target'],
  ])('returns false for %s vs %s (%s) without reading the store', (attacker, target, _label) => {
    expect(isMazeBlocked(attacker, target, campaignName)).toBe(false);
    expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
  });

  it('reads campaign:targetEffects by exact key and returns false when the store is empty', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);
    expect(isMazeBlocked('TestCaster', 'Goblin', campaignName)).toBe(false);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledTimes(1);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
  });

  it('returns false when neither attacker nor target is trapped', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { effect: 'maze', target: 'Orc', source: 'TestCaster', dc: 20 },
    ]);
    expect(isMazeBlocked('TestCaster', 'Goblin', campaignName)).toBe(false);
  });

  it('returns true when attacker is trapped but target is not', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { effect: 'maze', target: 'TestCaster', source: 'Wizard', dc: 20 },
    ]);
    expect(isMazeBlocked('TestCaster', 'Goblin', campaignName)).toBe(true);
  });

  it('returns true when target is trapped but attacker is not', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { effect: 'maze', target: 'Goblin', source: 'Wizard', dc: 20 },
    ]);
    expect(isMazeBlocked('TestCaster', 'Goblin', campaignName)).toBe(true);
  });

  it('returns false when both are trapped by the same source', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { effect: 'maze', target: 'TestCaster', source: 'Wizard', dc: 20 },
      { effect: 'maze', target: 'Goblin', source: 'Wizard', dc: 20 },
    ]);
    expect(isMazeBlocked('TestCaster', 'Goblin', campaignName)).toBe(false);
  });

  it('returns true when both are trapped by different sources', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { effect: 'maze', target: 'TestCaster', source: 'Wizard', dc: 20 },
      { effect: 'maze', target: 'Goblin', source: 'Sorcerer', dc: 20 },
    ]);
    expect(isMazeBlocked('TestCaster', 'Goblin', campaignName)).toBe(true);
  });

  it('returns false when both share at least one common maze source', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { effect: 'maze', target: 'TestCaster', source: 'Wizard', dc: 20 },
      { effect: 'maze', target: 'TestCaster', source: 'Sorcerer', dc: 20 },
      { effect: 'maze', target: 'Goblin', source: 'Wizard', dc: 20 },
    ]);
    expect(isMazeBlocked('TestCaster', 'Goblin', campaignName)).toBe(false);
  });

  it('returns true when both trapped but no common source', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { effect: 'maze', target: 'TestCaster', source: 'Wizard', dc: 20 },
      { effect: 'maze', target: 'TestCaster', source: 'Druid', dc: 20 },
      { effect: 'maze', target: 'Goblin', source: 'Sorcerer', dc: 20 },
      { effect: 'maze', target: 'Goblin', source: 'Cleric', dc: 20 },
    ]);
    expect(isMazeBlocked('TestCaster', 'Goblin', campaignName)).toBe(true);
  });
});
