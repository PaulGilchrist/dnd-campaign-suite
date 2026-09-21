// MA-0689 regression: Elk Hooves prone-target prerequisite on the ATTACK chip.
// Twin of MA-0687 (Elephant Stomp): the row now authors target_prerequisite
// {conditions:["prone"]} (MA-0019 byte-shape minus by_attacker — RAW prone
// eligibility is source-agnostic) and handleAttack reuses
// evaluateTargetPrerequisiteGate: a non-prone armed target refuses with the
// MA-0019 refusal popup + hooves_refused log, zero rollAttack zero damage; a
// prone target resolves normally (+5, autoDamageFormula "2d4 + 3"). Ungated
// sibling (Ram) stays byte-inert.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { parseTargetPrerequisite, evaluateTargetPrerequisiteGate } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const ELK_ACTIONS = monstersData.find(m => m.name === 'Elk').actions;
const HOOVES = ELK_ACTIONS.find(a => a.name === 'Hooves');
const RAM = ELK_ACTIONS.find(a => a.name === 'Ram');

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 8, rolls: [2, 3], modifier: 3 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 13, rolls: [2, 3], modifier: 3 })),
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
  const _rollAttack = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollAttack, _setPopupHtml };
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
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 5)),
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

const rollAttack = useLoggedDiceRoll._rollAttack;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Elk 1', type: 'npc', monsterType: 'beast', targetName: 'Bandit 1', currentHp: 13, maxHp: 13, ac: 10, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderElk() {
  const m = makeMonster({ name: 'Elk', actions: [RAM, HOOVES] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Elk 1', creatures: CREATURES })} />);
}

function attackChip(actionName) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el =>
    el.closest('.mc-action')?.querySelector('strong')?.textContent.trim().startsWith(actionName)) || null;
}

describe('MA-0689 monsters.json data: Elk Hooves carries prone target_prerequisite', () => {
  it('Hooves authors target_prerequisite {conditions:["prone"]} with exact attack core', () => {
    expect(HOOVES.target_prerequisite).toEqual({ conditions: ['prone'] });
    expect(HOOVES.target_prerequisite.by_attacker).toBeUndefined();
    expect(HOOVES.attack_bonus).toBe(5);
    expect(HOOVES.damage_dice_primary).toBe('2d4 + 3');
    expect(HOOVES.damage_type_primary).toBe('bludgeoning');
  });

  it('Hooves byte-shape matches the MA-0687 Elephant Stomp twin', () => {
    const stomp = monstersData.find(m => m.name === 'Elephant').actions.find(a => a.name === 'Stomp');
    expect(HOOVES.target_prerequisite).toEqual(stomp.target_prerequisite);
  });

  it('Ram sibling stays byte-inert (no target_prerequisite)', () => {
    expect(RAM.target_prerequisite).toBeUndefined();
    expect(parseTargetPrerequisite(RAM)).toBeNull();
  });
});

describe('MA-0689 evaluateTargetPrerequisiteGate on the Hooves row (by_attacker absent)', () => {
  it('source-agnostic: prone from ANY source satisfies; popup omits provenance', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: HOOVES,
      target: { name: 'Bandit 1' },
      monsterName: 'Elk 1',
      campaignName: 'test-campaign',
      getRuntimeValue: () => ['prone'],
    });
    expect(gate.satisfied).toBe(true);
    expect(gate.prerequisite.byAttacker).toBe(false);
  });

  it('non-prone target refuses with hooves_refused refusal shape', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: HOOVES,
      target: { name: 'Bandit 1' },
      monsterName: 'Elk 1',
      campaignName: 'test-campaign',
      getRuntimeValue: (k, p) => (p === 'activeConditions' ? [] : null),
    });
    expect(gate.satisfied).toBe(false);
    expect(String(gate.popupHtml)).toContain('Prerequisite Not Met');
    expect(String(gate.popupHtml)).toContain('must be Prone.');
    expect(gate.refusalLog.automationType).toBe('hooves_refused');
    expect(gate.refusalLog.characterName).toBe('Elk 1');
    expect(gate.refusalLog.targetName).toBe('Bandit 1');
  });
});

describe('MA-0689 MonsterCardModal Hooves ATTACK-chip gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('non-prone target: popup + hooves_refused log, zero rollAttack, zero damage', async () => {
    renderElk();
    fireEvent.click(attackChip('Hooves'));

    expect(rollAttack).not.toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'hooves_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.type).toBe('automation');
    expect(refusal.characterName).toBe('Elk 1');
    expect(refusal.targetName).toBe('Bandit 1');
  });

  it('prone target (any source): attacks normally, +5 vs 2d4 + 3 adjudication', async () => {
    runtime.store['Bandit 1.activeConditions'] = ['prone'];
    runtime.store['Bandit 1.activeConditionMeta'] = { prone: { source: 'Bandit Captain 1' } };
    renderElk();
    fireEvent.click(attackChip('Hooves'));

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Hooves');
    expect(bonus).toBe(5);
    expect(options.autoDamageFormula).toBe('2d4 + 3');
    expect(options.damageType).toBe('bludgeoning');
    expect(options.targetName).toBe('Bandit 1');
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('ungated Ram on the same non-prone target still rolls (byte-inert)', () => {
    renderElk();
    fireEvent.click(attackChip('Ram'));
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][0]).toBe('Ram');
    expect(addEntry).not.toHaveBeenCalled();
  });
});
