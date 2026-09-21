// MA-0687 regression: Elephant Stomp prone-target prerequisite on the ATTACK
// chip. The row now authors target_prerequisite {conditions:["prone"]} (MA-0019
// byte-shape minus by_attacker — RAW prone eligibility is source-agnostic) and
// handleAttack reuses evaluateTargetPrerequisiteGate (previously SAVE-chip-only)
// as the first gate: a non-prone armed target refuses with the MA-0019 refusal
// popup + stomp_refused log, zero rollAttack zero damage; a prone target resolves
// normally (+8, autoDamageFormula "3d10 + 6"). Ungated siblings (Gore) stay
// byte-inert.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { parseTargetPrerequisite, evaluateTargetPrerequisiteGate } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const ELEPHANT_ACTIONS = monstersData.find(m => m.name === 'Elephant').actions;
const STOMP = ELEPHANT_ACTIONS.find(a => a.name === 'Stomp');
const GORE = ELEPHANT_ACTIONS.find(a => a.name === 'Gore');

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 16, rolls: [4, 6, 0], modifier: 6 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 26, rolls: [4, 6, 0], modifier: 6 })),
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
  { name: 'Elephant 1', type: 'npc', monsterType: 'beast', targetName: 'Bandit 1', currentHp: 76, maxHp: 76, ac: 12, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderElephant() {
  const m = makeMonster({ name: 'Elephant', actions: [GORE, STOMP] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Elephant 1', creatures: CREATURES })} />);
}

function attackChip(actionName) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el =>
    el.closest('.mc-action')?.querySelector('strong')?.textContent.trim().startsWith(actionName)) || null;
}

describe('MA-0687 monsters.json data: Elephant Stomp carries prone target_prerequisite', () => {
  it('Stomp authors target_prerequisite {conditions:["prone"]} with exact attack core', () => {
    expect(STOMP.target_prerequisite).toEqual({ conditions: ['prone'] });
    expect(STOMP.target_prerequisite.by_attacker).toBeUndefined();
    expect(STOMP.attack_bonus).toBe(8);
    expect(STOMP.damage_dice_primary).toBe('3d10 + 6');
    expect(STOMP.damage_type_primary).toBe('bludgeoning');
  });

  it('Gore sibling stays byte-inert (no target_prerequisite)', () => {
    expect(GORE.target_prerequisite).toBeUndefined();
    expect(parseTargetPrerequisite(GORE)).toBeNull();
  });
});

describe('MA-0687 evaluateTargetPrerequisiteGate on the attack row (by_attacker absent)', () => {
  it('source-agnostic: prone from ANY source satisfies; popup omits provenance', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: STOMP,
      target: { name: 'Bandit 1' },
      monsterName: 'Elephant 1',
      campaignName: 'test-campaign',
      getRuntimeValue: () => ['prone'],
    });
    expect(gate.satisfied).toBe(true);
    expect(gate.prerequisite.byAttacker).toBe(false);
  });

  it('non-prone target refuses with stomp_refused refusal shape', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: STOMP,
      target: { name: 'Bandit 1' },
      monsterName: 'Elephant 1',
      campaignName: 'test-campaign',
      getRuntimeValue: (k, p) => (p === 'activeConditions' ? [] : null),
    });
    expect(gate.satisfied).toBe(false);
    expect(String(gate.popupHtml)).toContain('Prerequisite Not Met');
    expect(String(gate.popupHtml)).toContain('must be Prone.');
    expect(gate.refusalLog.automationType).toBe('stomp_refused');
    expect(gate.refusalLog.characterName).toBe('Elephant 1');
    expect(gate.refusalLog.targetName).toBe('Bandit 1');
  });
});

describe('MA-0687 MonsterCardModal Stomp ATTACK-chip gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('non-prone target: popup + stomp_refused log, zero rollAttack, zero damage', async () => {
    renderElephant();
    fireEvent.click(attackChip('Stomp'));

    expect(rollAttack).not.toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'stomp_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.type).toBe('automation');
    expect(refusal.characterName).toBe('Elephant 1');
    expect(refusal.targetName).toBe('Bandit 1');
  });

  it('prone target (any source): attacks normally, +8 vs 3d10 + 6 adjudication', async () => {
    runtime.store['Bandit 1.activeConditions'] = ['prone'];
    runtime.store['Bandit 1.activeConditionMeta'] = { prone: { source: 'Bandit Captain 1' } };
    renderElephant();
    fireEvent.click(attackChip('Stomp'));

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Stomp');
    expect(bonus).toBe(8);
    expect(options.autoDamageFormula).toBe('3d10 + 6');
    expect(options.damageType).toBe('bludgeoning');
    expect(options.targetName).toBe('Bandit 1');
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('ungated Gore on the same non-prone target still rolls (byte-inert)', () => {
    renderElephant();
    fireEvent.click(attackChip('Gore'));
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][0]).toBe('Gore');
    expect(addEntry).not.toHaveBeenCalled();
  });
});
