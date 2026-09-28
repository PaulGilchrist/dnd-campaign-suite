// MA-1502 regression: Sphinx of Valor Roar launcher click path. The row is
// now MA-0268 byte-shape staged (staged_roar:true, numeric uses/maxUses:3,
// DC 20, 500-foot Emanation) with a ROW-AUTHORED roar_stages[] payload —
// click N arms ONLY stage N's Valor legs through SaveAttackAoeModal (pre-fix
// the row was prose-only, uses:"3/Day" NaN → zero affordance, zero delta):
//   stage 1 (0 spent): WIS DC 20, zero damage, frightened, label "First Roar (1 of 3)";
//   stage 2 (1 spent): WIS, zero damage, paralyzed, label "Second Roar (2 of 3)";
//   stage 3 (2 spent): CON, 8d10 Thunder half-on-success, prone, "Third Roar (3 of 3)";
//   4th click (3 spent): gate refuses — picker never opens, Uses Exhausted
//     popup + roar_refused log. Counter spends at picker-open (MA-0633 lane).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay cone-picker-stub"><div className="sp-body">{props.title}</div></div>;
  },
}));

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

const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Sphinx of Valor 1', type: 'npc', monsterType: 'celestial', targetName: 'Bandit 1', currentHp: 235, maxHp: 235, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, conditions: [] },
];

function roarRow() {
  return monstersData.find(m => m.index === 'sphinx-of-valor').actions.find(a => a.name === 'Roar');
}

function renderValor(uses) {
  if (uses !== undefined) runtime.store['Sphinx of Valor 1.monsterSpellUses'] = uses;
  const m = makeMonster({ name: 'Sphinx of Valor', type: 'celestial', actions: [roarRow()] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Sphinx of Valor 1', creatures: CREATURES })} />);
}

function roarLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('.mc-action')?.querySelector('strong')?.textContent.trim().startsWith('Roar.')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-1502 Valor staged roar launcher click path', () => {
  it('chip renders the numeric 3/Day counter (NaN-string row rendered nothing pre-fix)', () => {
    renderValor();
    expect(roarLink()).toBeTruthy();
    expect(roarLink().textContent).toMatch(/\(3\/Day · 3 left\)/);
  });

  it('click 1 arms FIRST stage only: WIS DC 20, zero damage, frightened, honest label', async () => {
    renderValor();
    fireEvent.click(roarLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.saveType).toBe('Wisdom');
    expect(aoeProps.current.action.save_dc).toBe(20);
    expect(aoeProps.current.dcSuccess).toBe('none');
    expect(aoeProps.current.damage).toBeNull();
    expect(aoeProps.current.saveConditions).toEqual(['frightened']);
    expect(aoeProps.current.action.name).toBe('First Roar (1 of 3)');
    expect(aoeProps.current.titleOverride).toContain('500-ft Radius');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe('First Roar (1 of 3)');
    expect(spend.description).toMatch(/1 use spent, 2 left today/);
  });

  it('click 2 (1 spent) arms SECOND stage only: WIS, zero damage, paralyzed (NOT frightened)', async () => {
    renderValor({ Roar: 1 });
    fireEvent.click(roarLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.saveType).toBe('Wisdom');
    expect(aoeProps.current.damage).toBeNull();
    expect(aoeProps.current.saveConditions).toEqual(['paralyzed']);
    expect(aoeProps.current.action.name).toBe('Second Roar (2 of 3)');
  });

  it('click 3 (2 spent) arms THIRD stage only: CON, 8d10 Thunder half-on-success, prone', async () => {
    renderValor({ Roar: 2 });
    fireEvent.click(roarLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.saveType).toBe('Constitution');
    expect(aoeProps.current.dcSuccess).toBe('half');
    expect(aoeProps.current.damage).toBe('8d10');
    expect(aoeProps.current.saveConditions).toEqual(['prone']);
    expect(aoeProps.current.action.name).toBe('Third Roar (3 of 3)');
  });

  it('click 4 (3 spent): gate refuses — picker never opens, Uses Exhausted popup + roar_refused log', async () => {
    renderValor({ Roar: 3 });
    const link = roarLink();
    expect(link.textContent).toMatch(/\(3\/Day · 0 left\)/);
    fireEvent.click(link);
    expect(aoeProps.current).toBeNull();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Uses Exhausted');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'roar_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.characterName).toBe('Sphinx of Valor 1');
    expect(refusal.description).toMatch(/already used Roar today \(3\/Day\)/);
  });
});
