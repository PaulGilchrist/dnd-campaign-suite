// @maintained-by-ai
/**
 * mazeHandler SP-080 fix lane — SECOND of the maze TRIO (spells/):
 *
 *   ✔ THIS FILE — SP-080 fix contract: escape success must end the spell by
 *      breaking the caster's Maze concentration (manifest SP-080: "If it
 *      succeeds, it escapes, and the spell ends"). Pins the CACHE-HIT path
 *      of releaseCasterMazeConcentration (mazeHandler.js): breakConcentration
 *      + storage.set('combatSummary') + maze_concentration_released log, the
 *      spell-name gate (non-Maze concentration untouched), and concentration
 *      retention on failed escape. Bug class locked: caster concentration
 *      outliving the spell after the target escapes.
 *   #  mazeHandler.edgeCases.test.js — FIRST (closed, maintained): error/
 *      shape guards, addEntry rejections, vision-gate allow branches, the
 *      trio's deterministic state-clearing pin + uncached-getCombatSummary
 *      null-guard twin of this lane's cache-hit path. Its old
 *      `Math.random = () => Math.random` restore poisoned dice repo-wide;
 *      this lane never had that poison and adopts its riggedRandom helper.
 *   #  mazeHandler.test.js — MAIN: core handle() validation + activation
 *      telemetry, handleEscape refusals, structure-only escape success
 *      (live Math.random — flagged to #1934), escape failure,
 *      removeMazeEffect/isCreatureTrappedInMaze/isMazeBlocked truth tables.
 *
 * Production liveness (verified 2026-10-16): automation/index.js:542
 * registers maze_escape→handleEscape; releaseCasterMazeConcentration runs
 * only inside handleEscape's success branch — exactly this lane's target.
 * Escape is a d20+INT+prof vs mazeEffect.dc||20 at the Study-action turn
 * seam; no saves, no game timers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleEscape } from './mazeHandler.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';
import * as logService from '../../../ui/logService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(() => 20),
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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn((cs, name) => {
    const creature = cs.creatures.find(c => c.name === name);
    const spell = creature.concentration?.spell || null;
    creature.concentration = null;
    return spell;
  }),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

const campaignName = 'test-campaign';

// Trio pattern (shared with edgeCases lane): exact capture/restore of
// Math.random — no NaN-roll poison, no leaked spies.
function riggedRandom(value) {
  const original = Math.random;
  Math.random = () => value;
  return () => { Math.random = original; };
}

function makeCs(concentration) {
  return {
    creatures: [
      { name: 'TestCaster', type: 'player', concentration },
      { name: 'Goblin', type: 'monster', abilities: { INT: { bonus: 12 } }, proficiency: 0 },
    ],
  };
}

function makeEscapeAction() {
  return {
    name: 'maze_escape',
    metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 12 } }, proficiency: 0 }] },
  };
}

function armMaze(targetEffects) {
  runtimeState.getRuntimeValue.mockImplementation((scope, key) => {
    if (key === 'targetEffects') return targetEffects;
    if (key === 'activeConditions') return ['incapacitated'];
    return null;
  });
  runtimeState.setRuntimeValue.mockImplementation((scope, key, value) => {
    if (key === 'targetEffects') targetEffects = value;
  });
}

function releaseLogs() {
  return logService.addEntry.mock.calls.map(c => c[1]).filter(e => e?.automationType === 'maze_concentration_released');
}

describe('SP-080 maze escape lane — caster concentration breaks when the spell ends', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storage.set.mockReturnValue(undefined);
    logService.addEntry.mockReturnValue(Promise.resolve());
  });

  it('escape success clears caster Maze concentration, persists combatSummary, logs release', async () => {
    const cs = makeCs({ spell: 'Maze', dc: 19 });
    combatData.getCombatSummary.mockReturnValue(cs);
    armMaze([{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }]);
    // rig a natural 20 (+INT 12 vs DC 20) so the success branch — and with
    // it the release path — runs deterministically (~65% flake unrigged)
    const restore = riggedRandom(0.95);
    const result = await handleEscape(makeEscapeAction(), {}, campaignName, null);
    restore();

    // path guard: prove the escape-success branch actually executed
    expect(result.payload.description).toContain('escaped the Maze');
    expect(concentrationService.breakConcentration).toHaveBeenCalledWith(cs, 'TestCaster');
    // the broken summary is the exact object persisted (mutated in place)
    expect(cs.creatures[0].concentration).toBeNull();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    const logs = releaseLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      type: 'automation',
      characterName: 'TestCaster',
      abilityName: 'Maze',
    });
    expect(logs[0].description).toBe("TestCaster's concentration on Maze ends — Goblin escaped the Maze.");
  });

  it('keeps a non-Maze caster concentration untouched on escape success', async () => {
    const cs = makeCs({ spell: 'Hex', dc: 13 });
    combatData.getCombatSummary.mockReturnValue(cs);
    armMaze([{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }]);
    // must rig success: unrigged, a low roll skips the release path entirely
    // and the untouched-assertions would pass vacuously
    const restore = riggedRandom(0.95); // natural 20 +INT 12 vs DC 20
    const result = await handleEscape(makeEscapeAction(), {}, campaignName, null);
    restore();

    // path guard: escape succeeded with a hot cache, release path ran
    expect(result.payload.description).toContain('escaped the Maze');
    // spell-name gate: only a Maze concentration releases
    expect(concentrationService.breakConcentration).not.toHaveBeenCalled();
    expect(cs.creatures[0].concentration).toMatchObject({ spell: 'Hex', dc: 13 });
    expect(storage.set).not.toHaveBeenCalled();
    expect(releaseLogs()).toHaveLength(0);
  });

  it('failed escape keeps the caster Maze concentration', async () => {
    const cs = makeCs({ spell: 'Maze', dc: 19 });
    // cache intentionally hot: even with a readable summary, a failed escape
    // must not release anything
    combatData.getCombatSummary.mockReturnValue(cs);
    const action = { name: 'maze_escape', metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 0 } }, proficiency: 0 }] } };
    // no rig needed: max possible total is natural-20 + 0 + 0 = 20 < DC 30
    // — failure is structural, not roll-dependent
    armMaze([{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 30 }]);

    const result = await handleEscape(action, {}, campaignName, null);

    expect(result.payload.description).toContain('remains trapped');
    expect(cs.creatures[0].concentration.spell).toBe('Maze');
    expect(storage.set).not.toHaveBeenCalled();
    expect(releaseLogs()).toHaveLength(0);
  });
});
