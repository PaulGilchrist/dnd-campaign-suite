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

    const result = await handleEscape(makeEscapeAction(), {}, campaignName, null);

    expect(result.payload.description).toContain('escaped the Maze');
    expect(concentrationService.breakConcentration).toHaveBeenCalledWith(cs, 'TestCaster');
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(releaseLogs()).toHaveLength(1);
    expect(releaseLogs()[0]).toMatchObject({
      type: 'automation',
      characterName: 'TestCaster',
      abilityName: 'Maze',
    });
  });

  it('keeps a non-Maze caster concentration untouched on escape success', async () => {
    const cs = makeCs({ spell: 'Hex', dc: 13 });
    combatData.getCombatSummary.mockReturnValue(cs);
    armMaze([{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }]);

    await handleEscape(makeEscapeAction(), {}, campaignName, null);

    expect(concentrationService.breakConcentration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(releaseLogs()).toHaveLength(0);
  });

  it('failed escape keeps the caster Maze concentration', async () => {
    const cs = makeCs({ spell: 'Maze', dc: 19 });
    combatData.getCombatSummary.mockReturnValue(cs);
    const action = { name: 'maze_escape', metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 0 } }, proficiency: 0 }] } };
    armMaze([{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 30 }]);

    const result = await handleEscape(action, {}, campaignName, null);

    expect(result.payload.description).toContain('remains trapped');
    expect(cs.creatures[0].concentration.spell).toBe('Maze');
    expect(storage.set).not.toHaveBeenCalled();
    expect(releaseLogs()).toHaveLength(0);
  });
});
