// MA-0115: clicking the gated Noxious Miasma legendary row on the Adult
// Green Dragon card routes the sphere row to the radius picker with the
// authored "−2 penalty to AC" clause armed (acPenaltyClause rides the picker
// seam, MA-0087 shape); a second click in the same turn refuses via the
// MA-0113 legendary latch with zero picker opens.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 7, rolls: [2, 5], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 14, rolls: [2, 5], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
const logEntries = vi.hoisted(() => ({ current: [] }));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn((_c, e) => { logEntries.current.push(e); return Promise.resolve(); }),
}));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(), rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));
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

const pickerProps = vi.hoisted(() => ({ current: [] }));
vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    pickerProps.current.push(props);
    return null;
  },
}));

const CREATURES = [
  { name: 'Adult Green Dragon 1', type: 'npc', targetName: null, currentHp: 224, maxHp: 224, ac: 19, conditions: [] },
  { name: 'AberrantSorcerer', type: 'player', currentHp: 92, maxHp: 92, conditions: [] },
];

const green = () => monstersData.find(m => m.name === 'Adult Green Dragon');

function renderGreen(uses) {
  if (uses !== undefined) runtime.store['Adult Green Dragon 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({ name: 'Adult Green Dragon', actions: green().actions, legendary_actions: green().legendary_actions });
  ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Green Dragon 1', creatures: CREATURES })} />);
}

function miasmaRow() {
  return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Noxious Miasma'));
}

describe('MA-0115 MonsterCardModal Noxious Miasma picker seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    pickerProps.current = [];
    logEntries.current = [];
  });

  it('sphere row opens the radius picker with the −2 AC clause armed, DC 17 CON', async () => {
    renderGreen({ max: 3, used: 0 });
    fireEvent.click(miasmaRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(pickerProps.current.length).toBe(1));
    const props = pickerProps.current[0];
    expect(props.acPenaltyClause).toEqual({ effect: 'ac_penalty', value: 2 });
    expect(props.saveDc).toBe(17);
    expect(props.saveType).toBe('Constitution');
    expect(props.range).toBe(20);
    expect(props.damage).toBe('2d6');
    expect(props.excludeNames).toEqual(['Adult Green Dragon 1']);
  });

  it('second click same turn refused via the legendary latch: no second picker, refusal logged', async () => {
    renderGreen({ max: 3, used: 0 });
    fireEvent.click(miasmaRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(pickerProps.current.length).toBe(1));
    fireEvent.click(miasmaRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(logEntries.current.some(e => /refused/i.test(e.description || ''))).toBe(true));
    await new Promise(r => setTimeout(r, 50));
    expect(pickerProps.current).toHaveLength(1);
  });
});
