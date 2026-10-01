// MA-1789: Young Red Dragon lair_actions[0] was a BARE STRING (inert static
// span, zero affordance — MonsterCardBody.jsx string short-circuit first
// disjunct). DATA fix promotes it to the adult-red MA-0128 byte-twin named
// SAVE row (description soft-hyphen U+00AD "tak\xad ing" repaired to "taking"
// as the only byte-diff vs adult) → row renders <strong>Magma Geyser.</strong>
// + ONE .mc-dice-link-lair chip "DC 15 Dexterity"; click arms the picker at
// DC 15 Dexterity with 6d6 Fire half-on-success (dcSuccess "half"), saveCondi-
// tions [].
// MA-1790 WIDENS this census 1→2: sibling [1] nameless magma dict promoted to
// the distinct-named "Erupting Magma" save row (MA-1748/MA-1753/MA-1754/
// MA-1767/MA-1773/MA-1784 distinct-sibling-naming precedent — [0] already owns
// "Magma Geyser"; raw duplicate-mechanic rows named distinctly, never merged)
// → lair block renders named rows, each with its own "DC 15 Dexterity"
// .mc-dice-link-lair chip; chips arm the picker at DC 15 Dexterity,
// 6d6 Fire, dcSuccess "half", saveConditions []. MA-1791 WIDENS this census
// 2→3: sibling [2] nameless tremor dict promoted to the adult-red MA-0129
// byte-twin named "Tremor" save row (dc_success "none", save_effect carries
// the canonical prone word → saveConditions ['prone'], no damage dice) → its
// chip arms the picker at DC 15 Dexterity with dcSuccess "none", damage null,
// saveConditions ['prone']; zero static prose rows remain.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const pickerProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    pickerProps.current = props;
    return <div className="sp-overlay young-red-magma-picker-stub"><div className="sp-body">{props.title}</div></div>;
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 21, rolls: [4, 5, 6, 6], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 42, rolls: [4, 5, 6, 6], modifier: 0 })),
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
  { name: 'Young Red Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 178, maxHp: 178, ac: 18, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'young-red-dragon');
  const m = makeMonster({ name: 'Young Red Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Young Red Dragon 1', creatures: CREATURES })} />);
}

function lairChips() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-1789/MA-1790 young-red-dragon magma lair chip lock', () => {
  it('bare-string [0] promoted by MA-1789 + nameless [1] promoted by MA-1790 + nameless [2] tremor promoted by MA-1791: lair block renders THREE named rows ("Magma Geyser."/"Erupting Magma."/"Tremor."), THREE chips "DC 15 Dexterity"; zero static prose rows', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips).toHaveLength(3);
    expect(chips.map(c => c.textContent.trim())).toEqual(['DC 15 Dexterity', 'DC 15 Dexterity', 'DC 15 Dexterity']);
    chips.forEach(c => expect(c.getAttribute('title')).toMatch(/Lair action — DC 15 Dexterity/));
    expect(chips[0].closest('.mc-action').querySelector('strong')?.textContent).toBe('Magma Geyser.');
    expect(chips[1].closest('.mc-action').querySelector('strong')?.textContent).toBe('Erupting Magma.');
    expect(chips[2].closest('.mc-action').querySelector('strong')?.textContent).toBe('Tremor.');
    const staticRows = Array.from(document.querySelectorAll('.mc-action')).filter(el => !el.querySelector('.mc-dice-link-lair'));
    expect(staticRows).toHaveLength(0);
  });

  it('[0] chip click arms the picker at DC 15 Dexterity, 6d6 Fire, dcSuccess half, zero conditions', async () => {
    renderDragon();
    fireEvent.click(lairChips()[0]);
    await waitFor(() => expect(pickerProps.current).toBeTruthy());
    const p = pickerProps.current;
    expect(p.saveType).toBe('Dexterity');
    expect(p.saveDc).toBe(15);
    expect(p.dcSuccess).toBe('half');
    expect(p.damage).toBe('6d6');
    expect(p.damageType).toBe('Fire');
    expect(p.saveConditions).toEqual([]);
    expect(p.zoneOnly ?? false).toBe(false);
    expect(p.excludeNames).toContain('Young Red Dragon 1');
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('[1] chip click arms the picker identically (Erupting Magma — same DC/type/dice/half math seam)', async () => {
    pickerProps.current = null;
    renderDragon();
    fireEvent.click(lairChips()[1]);
    await waitFor(() => expect(pickerProps.current).toBeTruthy());
    const p = pickerProps.current;
    expect(p.saveType).toBe('Dexterity');
    expect(p.saveDc).toBe(15);
    expect(p.dcSuccess).toBe('half');
    expect(p.damage).toBe('6d6');
    expect(p.damageType).toBe('Fire');
    expect(p.saveConditions).toEqual([]);
    expect(p.zoneOnly ?? false).toBe(false);
    expect(p.excludeNames).toContain('Young Red Dragon 1');
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('[2] chip click arms the picker at DC 15 Dexterity, dcSuccess none, no damage, saveConditions ["prone"] (MA-1791 Tremor — damageless prone row)', async () => {
    pickerProps.current = null;
    renderDragon();
    fireEvent.click(lairChips()[2]);
    await waitFor(() => expect(pickerProps.current).toBeTruthy());
    const p = pickerProps.current;
    expect(p.saveType).toBe('Dexterity');
    expect(p.saveDc).toBe(15);
    expect(p.dcSuccess).toBe('none');
    expect(p.damage).toBeNull();
    expect(p.saveConditions).toEqual(['prone']);
    expect(p.zoneOnly ?? false).toBe(false);
    expect(p.excludeNames).toContain('Young Red Dragon 1');
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
