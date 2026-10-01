// MA-1807: Young White Dragon lair_actions[0] was a BARE STRING (inert static
// span, zero affordance — MonsterCardBody.jsx:358 string short-circuit first
// disjunct, isLairRowClickable never reached). DATA fix promotes it to the
// adult-white MA-0149 freezing-fog byte-twin named SAVE row → lair block
// renders <strong>Freezing Fog.</strong> + ONE .mc-dice-link-lair chip
// "DC 10 Constitution"; click arms the 20-ft Radius picker at DC 10
// Constitution with 3d6 Cold half-on-success (dcSuccess "half"), saveConditions
// []. MA-1808 promotes sibling [1] to the same byte-shape with DISTINCT name
// "Glacial Fog" — now TWO named DC 10 Constitution chips. Only [2] nameless
// jagged ice shards dict stays an inert static row (MA-1809) — exactly TWO
// chips, ONE static row.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const pickerProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    pickerProps.current = props;
    return <div className="sp-overlay young-white-fog-picker-stub"><div className="sp-body">{props.title}</div></div>;
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [2, 3, 5], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [2, 3, 5], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => ({ name: 'Bandit 1', type: 'npc' })),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Bandit 1', creatures: [] })),
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

const CREATURES = [
  { name: 'Young White Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 123, maxHp: 123, ac: 18, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'young-white-dragon');
  const m = makeMonster({ name: 'Young White Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Young White Dragon 1', creatures: CREATURES })} />);
}

function lairChips() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

beforeEach(() => {
  vi.clearAllMocks();
  pickerProps.current = null;
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-1807 young-white-dragon freezing fog lair chip lock', () => {
  it('MA-1807+MA-1808 promoted: lair block renders TWO named fog rows "Freezing Fog."/"Glacial Fog." + TWO chips "DC 10 Constitution"; only [2] stays an inert static row', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent.trim()).toBe('DC 10 Constitution');
    expect(chips[0].getAttribute('title')).toMatch(/Lair action — DC 10 Constitution/);
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].getAttribute('tabindex')).toBe('0');
    expect(chips[0].closest('.mc-action').querySelector('strong')?.textContent).toBe('Freezing Fog.');
    expect(chips[1].textContent.trim()).toBe('DC 10 Constitution');
    expect(chips[1].getAttribute('title')).toMatch(/Lair action — DC 10 Constitution/);
    expect(chips[1].getAttribute('role')).toBe('button');
    expect(chips[1].getAttribute('tabindex')).toBe('0');
    expect(chips[1].closest('.mc-action').querySelector('strong')?.textContent).toBe('Glacial Fog.');
    const staticRows = Array.from(document.querySelectorAll('.mc-action')).filter(el => !el.querySelector('.mc-dice-link-lair'));
    expect(staticRows).toHaveLength(1);
    expect(staticRows[0].querySelector('strong')).toBeNull();
    expect(staticRows[0].textContent).toMatch(/Jagged ice shards/i);
  });

  it('[0] chip click arms the 20-ft Radius picker at DC 10 Constitution, 3d6 Cold, dcSuccess half, zero conditions', async () => {
    renderDragon();
    fireEvent.click(lairChips()[0]);
    await waitFor(() => expect(pickerProps.current).toBeTruthy());
    const p = pickerProps.current;
    expect(p.saveType).toBe('Constitution');
    expect(p.saveDc).toBe(10);
    expect(p.dcSuccess).toBe('half');
    expect(p.damage).toBe('3d6');
    expect(p.damageType).toBe('Cold');
    expect(p.saveConditions).toEqual([]);
    expect(p.range).toBe(20);
    expect(p.titleOverride).toMatch(/20-ft Radius/);
    expect(p.zoneOnly ?? false).toBe(false);
    expect(p.excludeNames).toContain('Young White Dragon 1');
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('MA-1808: [1] Glacial Fog chip click arms the same DC 10 Constitution 20-ft picker, 3d6 Cold half', async () => {
    renderDragon();
    fireEvent.click(lairChips()[1]);
    await waitFor(() => expect(pickerProps.current).toBeTruthy());
    const p = pickerProps.current;
    expect(p.saveType).toBe('Constitution');
    expect(p.saveDc).toBe(10);
    expect(p.dcSuccess).toBe('half');
    expect(p.damage).toBe('3d6');
    expect(p.damageType).toBe('Cold');
    expect(p.saveConditions).toEqual([]);
    expect(p.range).toBe(20);
    expect(p.titleOverride).toMatch(/20-ft Radius/);
    expect(p.excludeNames).toContain('Young White Dragon 1');
  });
});
