// MA-0020 regression: Aboleth "Dominate Mind (2/Day)" click-path enforcement.
// The ability save row gates on the MA-0005 monsterSpellUses runtime map:
// fresh row shows a (2/Day · N left) counter and arms the save with a
// monsterAbilityUse spend marker + until-clause durationNote; exhausted
// (2/2 used) refuses with a popup + dominate_mind_refused log, zero prompts.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const DOMINATE_MIND = {
  name: 'Dominate Mind (2/Day)',
  description: 'Wisdom Saving Throw: DC 16, one creature the aboleth can see within 30 feet.',
  save_dc: 16,
  save_type: 'Wisdom',
  save_effect: 'Failure: The target has the Charmed condition until the aboleth dies or is on a different plane of existence from the target',
  usage: '2/Day',
  uses: 2,
  maxUses: 2,
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

function renderAboleth(uses) {
  if (uses !== undefined) runtime.store['Aboleth 1.monsterSpellUses'] = uses;
  const m = makeMonster({ name: 'Aboleth', actions: [DOMINATE_MIND] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
}

function dominateLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.closest('div')?.textContent.includes('Dominate Mind')) || null;
}

describe('MA-0020 monsters.json data: Dominate Mind carries 2/Day uses', () => {
  it('aboleth row authors usage/uses/maxUses 2 with DC 16 Wisdom', () => {
    const aboleth = monstersData.find(m => m.index === 'aboleth');
    const row = aboleth.actions.find(a => a.name === 'Dominate Mind (2/Day)');
    expect(row.usage).toBe('2/Day');
    expect(row.uses).toBe(2);
    expect(row.maxUses).toBe(2);
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBe('Wisdom');
  });
});

describe('MA-0020 MonsterCardModal Dominate Mind uses gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('fresh row renders the (2/Day · 2 left) counter and arms the save with spend marker + durationNote', () => {
    renderAboleth();
    const link = dominateLink();
    expect(link).toBeTruthy();
    expect(link.textContent).toMatch(/\(2\/Day · 2 left\)/);

    fireEvent.click(link);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(16);
    expect(ctx.saveType).toBe('Wisdom');
    expect(ctx.saveConditions).toEqual(['charmed']);
    expect(ctx.monsterAbilityUse).toEqual({ useKey: 'Dominate Mind', maxUses: 2, actionName: 'Dominate Mind (2/Day)' });
    expect(ctx.conditionDurationNote).toMatch(/^until the aboleth dies .* \(GM-enforced\)$/);
  });

  it('one use spent: counter shows 1 left, second click still arms the save', () => {
    renderAboleth({ 'Dominate Mind': 1 });
    expect(dominateLink().textContent).toMatch(/\(2\/Day · 1 left\)/);
    fireEvent.click(dominateLink());
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  it('exhausted (2/2): popup + dominate_mind_refused log, zero save prompts, counter 0 left + spent class', async () => {
    renderAboleth({ 'Dominate Mind': 2 });
    const link = dominateLink();
    expect(link.textContent).toMatch(/\(2\/Day · 0 left\)/);
    expect(link.className).toContain('mc-dice-link-spell-spent');

    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Uses Exhausted');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'dominate_mind_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.characterName).toBe('Aboleth 1');
    expect(refusal.description).toMatch(/already used Dominate Mind today \(2\/Day\)/);
  });

  it('unlimited save rows untouched: no uses authored → no counter, no marker', () => {
    const ungated = { name: 'Mind Rot', save_dc: 15, save_type: 'Intelligence', save_effect: 'Failure: Stunned' };
    const m = makeMonster({ name: 'Aboleth', actions: [ungated] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
    const link = Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.closest('div')?.textContent.includes('Mind Rot'));
    expect(link.textContent).not.toMatch(/\/Day/);
    fireEvent.click(link);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(rollSavingThrow.mock.calls[0][2].monsterAbilityUse).toBeUndefined();
  });
});
