// MA-0268 regression: Androsphinx Roar staged click path in MonsterCardModal.
// Click N arms ONLY stage N's canonical save legs (pre-fix every click was
// the conflated union: 8d10 thunder + Deafened/Frightened/Prone on all three
// roars, dc_success half on the damage-free roars, inert usage gate):
//   stage 1 (0 spent): WIS DC 18, zero damage, frightened, MA-0048
//     repeat_save armed, label "Roar 1 of 3";
//   stage 2 (1 spent): WIS, zero damage, deafened AND frightened, repeat_save;
//   stage 3 (2 spent): CON, 8d10 Thunder half-on-success, prone, no repeat;
//   4th click (3 spent): maxUses gate refuses — zero save prompts +
//     roar_refused log + Uses Exhausted popup.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

function roarRow() {
  return monstersData.find(m => m.index === 'androsphinx').actions.find(a => a.name === 'Roar');
}

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 44, rolls: [5, 5, 5, 5, 5, 5, 5, 9], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 88, rolls: [5, 5, 5, 5, 5, 5, 5, 9], modifier: 0 })),
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
  computeConditionEffects: vi.fn(() => ({ cannotAct: false, speedZero: false })),
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
  { name: 'Androsphinx 1', type: 'npc', monsterType: 'monstrosity', targetName: 'TestPC', currentHp: 199, maxHp: 199, ac: 17, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function renderAndrosphinx(uses) {
  if (uses !== undefined) runtime.store['Androsphinx 1.monsterSpellUses'] = uses;
  const m = makeMonster({ name: 'Androsphinx', type: 'monstrosity', actions: [roarRow()] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Androsphinx 1', creatures: CREATURES })} />);
}

function roarLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.closest('div')?.textContent.includes('Roar')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-0268 staged roar click path', () => {
  it('chip renders the 3/Day counter once maxUses arms the gate', () => {
    renderAndrosphinx();
    expect(roarLink().textContent).toMatch(/\(3\/Day · 3 left\)/);
  });

  it('click 1 arms stage 1: WIS, zero damage, frightened, repeat-save armed, honest label', () => {
    renderAndrosphinx();
    fireEvent.click(roarLink());
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(18);
    expect(ctx.saveType).toBe('Wisdom');
    expect(ctx.dcSuccess).toBe('none');
    expect(ctx.autoDamageFormula).toBeNull();
    expect(ctx.saveConditions).toEqual(['frightened']);
    expect(ctx.repeatSave).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    expect(ctx.actionName).toBe('Roar 1 of 3');
    expect(ctx.monsterAbilityUse).toEqual({ useKey: 'Roar', maxUses: 3, actionName: 'Roar 1 of 3' });
  });

  it('click 2 (1 spent) arms stage 2: WIS, zero damage, deafened AND frightened', () => {
    renderAndrosphinx({ Roar: 1 });
    fireEvent.click(roarLink());
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveType).toBe('Wisdom');
    expect(ctx.dcSuccess).toBe('none');
    expect(ctx.autoDamageFormula).toBeNull();
    expect([...ctx.saveConditions].sort()).toEqual(['deafened', 'frightened']);
    expect(ctx.repeatSave.save_type).toBe('Wisdom');
    expect(ctx.actionName).toBe('Roar 2 of 3');
  });

  it('click 3 (2 spent) arms stage 3: CON, 8d10 Thunder half-on-success, prone, no repeat save', () => {
    renderAndrosphinx({ Roar: 2 });
    fireEvent.click(roarLink());
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(rollSavingThrow.mock.calls[0][0]).toBe('CON');
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveType).toBe('Constitution');
    expect(ctx.dcSuccess).toBe('half');
    expect(ctx.autoDamageFormula).toBe('8d10');
    expect(ctx.autoDamageDamageType).toMatch(/Thunder/i);
    expect(ctx.saveConditions).toEqual(['prone']);
    expect(ctx.repeatSave).toBeNull();
    expect(ctx.actionName).toBe('Roar 3 of 3');
    expect(ctx.monsterAbilityUse.actionName).toBe('Roar 3 of 3');
  });

  it('click 4 (3 spent): gate refuses — zero save prompts, Uses Exhausted popup, roar_refused log', async () => {
    renderAndrosphinx({ Roar: 3 });
    const link = roarLink();
    expect(link.textContent).toMatch(/\(3\/Day · 0 left\)/);
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Uses Exhausted');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'roar_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.characterName).toBe('Androsphinx 1');
    expect(refusal.description).toMatch(/already used Roar today \(3\/Day\)/);
  });
});
