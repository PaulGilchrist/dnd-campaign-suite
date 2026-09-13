// MA-0019 regression: Aboleth Consume Memories target-eligibility gate.
// The save row carries target_prerequisite {conditions:["charmed","grappled"],
// by_attacker:true}. An armed target that is Charmed/Grappled BY THIS MONSTER
// (activeConditionMeta[cond].source provenance) resolves exactly as before
// (DC 16 INT, save DC/half-damage math untouched); any other target is
// refused with a popup + consume_memories_refused log, zero roll, no prompt.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { parseTargetPrerequisite, targetPrerequisiteSatisfied, buildTargetPrerequisiteRefusalLog } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const CONSUME_MEMORIES = {
  name: 'Consume Memories',
  description: 'Intelligence Saving Throw: DC 16, one creature within 30 feet that is Charmed or Grappled by the aboleth.',
  save_dc: 16,
  save_type: 'Intelligence',
  damage_dice_primary: '3d6',
  damage_type_primary: 'Psychic',
  save_effect: 'Failure: 10 (3d6) Psychic damage. Success: Half damage',
  target_prerequisite: { conditions: ['charmed', 'grappled'], by_attacker: true },
};

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow, _setPopupHtml };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Aboleth 1', type: 'npc', monsterType: 'aberration', targetName: 'TestPC', currentHp: 185, maxHp: 185, ac: 17, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function renderAboleth() {
  const m = makeMonster({ name: 'Aboleth', actions: [CONSUME_MEMORIES] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
}

function consumeLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Consume Memories')) || null;
}

describe('MA-0019 monsters.json data: Consume Memories carries target_prerequisite', () => {
  const row = monstersData.find(m => m.name === 'Aboleth').actions.find(a => a.name === 'Consume Memories');
  it('authors target_prerequisite charmed/grappled by_attacker with exact save core', () => {
    expect(row.target_prerequisite).toEqual({ conditions: ['charmed', 'grappled'], by_attacker: true });
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBe('Intelligence');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Psychic');
  });
});

describe('MA-0019 prerequisite helpers', () => {
  it('parseTargetPrerequisite null without the field', () => {
    expect(parseTargetPrerequisite({ name: 'Tentacle' })).toBeNull();
    expect(parseTargetPrerequisite(CONSUME_MEMORIES).conditions).toEqual(['charmed', 'grappled']);
    expect(parseTargetPrerequisite(CONSUME_MEMORIES).byAttacker).toBe(true);
  });

  it('satisfied only when a prerequisite condition is attributed to this monster', () => {
    const prereq = parseTargetPrerequisite(CONSUME_MEMORIES);
    expect(targetPrerequisiteSatisfied({ prerequisite: prereq, conditions: [], conditionMeta: {}, monsterName: 'Aboleth 1' }).satisfied).toBe(false);
    expect(targetPrerequisiteSatisfied({ prerequisite: prereq, conditions: ['charmed'], conditionMeta: { charmed: { dc: 16 } }, monsterName: 'Aboleth 1' }).satisfied).toBe(false);
    expect(targetPrerequisiteSatisfied({ prerequisite: prereq, conditions: ['charmed'], conditionMeta: { charmed: { source: 'Dryad 2' } }, monsterName: 'Aboleth 1' }).satisfied).toBe(false);
    expect(targetPrerequisiteSatisfied({ prerequisite: prereq, conditions: ['grappled'], conditionMeta: { grappled: { dc: 14, ability: 'str', source: 'Aboleth 1' } }, monsterName: 'Aboleth 1' }).satisfied).toBe(true);
  });

  it('refusal log slug is consume_memories_refused', () => {
    const entry = buildTargetPrerequisiteRefusalLog({ monsterName: 'Aboleth 1', actionName: 'Consume Memories', targetName: 'TestPC', prerequisite: parseTargetPrerequisite(CONSUME_MEMORIES) });
    expect(entry.automationType).toBe('consume_memories_refused');
    expect(entry.targetName).toBe('TestPC');
  });
});

describe('MA-0019 MonsterCardModal Consume Memories gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('prerequisite met (grappled by aboleth): resolves the save unchanged, no refusal', async () => {
    runtime.store['TestPC.activeConditions'] = ['grappled'];
    runtime.store['TestPC.activeConditionMeta'] = { grappled: { dc: 14, ability: 'str', source: 'Aboleth 1' } };
    renderAboleth();
    fireEvent.click(consumeLink());

    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(16);
    expect(ctx.saveType).toBe('Intelligence');
    expect(ctx.dcSuccess).toBe('half');
    expect(ctx.autoDamageFormula).toBe('3d6');
    expect(ctx.consumeMemoriesClause).toBe(true);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('prerequisite met via charmed-by-aboleth provenance: resolves', async () => {
    runtime.store['TestPC.activeConditions'] = ['charmed'];
    runtime.store['TestPC.activeConditionMeta'] = { charmed: { source: 'Aboleth 1' } };
    renderAboleth();
    fireEvent.click(consumeLink());
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  it('unmet (no conditions): popup + consume_memories_refused log, zero roll, no prompt', async () => {
    renderAboleth();
    fireEvent.click(consumeLink());

    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'consume_memories_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.characterName).toBe('Aboleth 1');
  });

  it('unmet (charmed by another creature): refused — source must match', async () => {
    runtime.store['TestPC.activeConditions'] = ['charmed', 'grappled'];
    runtime.store['TestPC.activeConditionMeta'] = { charmed: { source: 'Dryad 2' }, grappled: { source: 'Thug 1' } };
    renderAboleth();
    fireEvent.click(consumeLink());
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'consume_memories_refused')).toBe(true);
  });

  it('ungated save rows are untouched: no prerequisite → resolves directly', async () => {
    const ungated = { name: 'Mind Rot', save_dc: 15, save_type: 'Intelligence', damage_dice_primary: '6d8', damage_type_primary: 'Psychic', save_effect: 'Failure: 27 (6d8) Psychic damage. Success: Half damage' };
    const m = makeMonster({ name: 'Aboleth', actions: [ungated] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
    fireEvent.click(Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Mind Rot')));
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(rollSavingThrow.mock.calls[0][2].consumeMemoriesClause).toBe(false);
  });
});
