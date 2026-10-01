// MA-1783: Young Green Dragon lair_actions[0] was a BARE STRING (inert
// static span, zero affordance — MonsterCardBody.jsx:357 first disjunct).
// DATA fix promotes it to the adult-green MA-0117 byte-twin named SAVE row
// → row renders <strong>Grasping Roots.</strong> + ONE .mc-dice-link-lair
// chip "DC 15 Strength"; click routes through handleSaveRoll → the existing
// save seam at the authored DC/type, dcSuccess "none" (damageless RAW),
// autoDamageFormula null, saveConditions ['restrained']. Nameless siblings
// [1] (MA-1784) / [2] (MA-1785) stay static — chip census EXACTLY ONE.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const pickerProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    pickerProps.current = props;
    return <div className="sp-overlay young-green-roots-picker-stub"><div className="sp-body">{props.title}</div></div>;
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
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
  { name: 'Young Green Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 136, maxHp: 136, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'young-green-dragon');
  const m = makeMonster({ name: 'Young Green Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Young Green Dragon 1', creatures: CREATURES })} />);
}

function lairChips() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-1783 young-green-dragon grasping-roots lair chip lock', () => {
  it('lair block renders EXACTLY ONE chip "DC 15 Strength" on the "Grasping Roots." row', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent.trim()).toBe('DC 15 Strength');
    expect(chips[0].getAttribute('title')).toMatch(/Lair action — DC 15 Strength/);
    const row = chips[0].closest('.mc-action');
    expect(row.querySelector('strong')?.textContent).toBe('Grasping Roots.');
  });

  it('nameless inert siblings [1]/[2] render zero chips (static prose only)', () => {
    renderDragon();
    const staticRows = Array.from(document.querySelectorAll('.mc-action')).filter(el => !el.querySelector('.mc-dice-link-lair'));
    expect(staticRows.some(el => el.textContent.includes('Grasping roots and vines erupt'))).toBe(true);
    expect(staticRows.some(el => el.textContent.includes('tangled brush bristling with thorns'))).toBe(true);
    expect(staticRows.every(el => el.querySelectorAll('span[role="button"]').length === 0)).toBe(true);
  });

  it('chip click arms the 20-ft Radius picker at DC 15 Strength, dcSuccess none, no damage (disk twin wins, picker route)', async () => {
    renderDragon();
    fireEvent.click(lairChips()[0]);
    await waitFor(() => expect(pickerProps.current).toBeTruthy());
    const p = pickerProps.current;
    expect(p.range).toBe(20);
    expect(p.titleOverride).toMatch(/20-ft Radius/);
    expect(p.saveType).toBe('Strength');
    expect(p.saveDc).toBe(15);
    expect(p.dcSuccess).toBe('none');
    expect(p.damage ?? null).toBeFalsy();
    expect(p.damageType ?? null).toBeFalsy();
    expect(p.saveConditions).toEqual(['restrained']);
    expect(p.zoneOnly ?? false).toBe(false);
    expect(p.excludeNames).toContain('Young Green Dragon 1');
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
