// @maintained-by-ai
// MA-1789/1790/1791 modal-seam lane: young-red-dragon lair_actions [0] was a
// BARE STRING and [1]/[2] nameless dicts (all inert static spans —
// MonsterCardBody.jsx MonsterLairAction string/nameless disjuncts). DATA fixes
// promote them to three named SAVE rows: "Magma Geyser" + "Erupting Magma"
// (both DC 15 Dexterity, 6d6 Fire, dcSuccess "half"; [0] mirrors the MA-0128
// adult-red byte-twin) and "Tremor" (MA-0129 adult-red byte-twin: dc_success
// "none", save_effect carries the canonical prone word, no damage dice).
// This file pins ONLY the modal seam: the rendered chip census vs real disk +
// each press arming SaveAttackAoeModal at the authored DC/type/damage through
// handleLairRow → executeBlockSaveRoll's aoe!=null picker branch.
// Cited owners, NOT re-pinned here: disk data locks (monsterLairActions.test.js
// :3308-3320 young-red census, :3142 geyser row, :3219 Tremor byte-twin),
// chip-vs-static render branches + inert gate + refusal machine
// (MonsterCardModal.lair-actions.test.jsx:114/:153/:176).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const pickerProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    pickerProps.current = props;
    return <div className="sp-overlay young-red-magma-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
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

// Per-chip picker contract: [0]/[1] are the DEX DC 15 half-damage magma twins
// (5-ft Radius picker from the "5-foot-radius geyser" prose, 6d6 Fire);
// [2] is the damageless tremor leg (60-ft Radius, dcSuccess none, prone).
// Radius is GM point-placed so rangeGateFt stays null (selection advisory);
// no zone/push markers on these rows — honest nulls. Nulling
// pickerProps.current first proves THIS click (not a stale render) armed it.
const PICKER_CASES = [
  { i: 0, damage: '6d6', damageType: 'Fire', dcSuccess: 'half', saveConditions: [], range: 5, titleOverride: '5-ft Radius (GM positions tokens; selection advisory)' },
  { i: 1, damage: '6d6', damageType: 'Fire', dcSuccess: 'half', saveConditions: [], range: 5, titleOverride: '5-ft Radius (GM positions tokens; selection advisory)' },
  { i: 2, damage: null, damageType: null, dcSuccess: 'none', saveConditions: ['prone'], range: 60, titleOverride: '60-ft Radius (GM positions tokens; selection advisory)' },
];

async function clickChip({ i, damage, damageType, dcSuccess, saveConditions, range, titleOverride }) {
  pickerProps.current = null;
  fireEvent.click(lairChips()[i]);
  await waitFor(() => expect(pickerProps.current, `chip ${i} did not open the picker`).toBeTruthy());
  const p = pickerProps.current;
  expect(p.saveDc, `chip ${i} saveDc`).toBe(15);
  expect(p.saveType, `chip ${i} saveType`).toBe('Dexterity');
  expect(p.dcSuccess, `chip ${i} dcSuccess`).toBe(dcSuccess);
  expect(p.damage ?? null, `chip ${i} damage`).toBe(damage);
  expect(p.damageType || null, `chip ${i} damageType`).toBe(damageType);
  expect(p.saveConditions, `chip ${i} saveConditions`).toEqual(saveConditions);
  expect(p.range, `chip ${i} range`).toBe(range);
  expect(p.titleOverride, `chip ${i} titleOverride`).toBe(titleOverride);
  expect(p.rangeGateFt, `chip ${i} rangeGateFt`).toBeNull();
  expect(p.zoneOnly, `chip ${i} zoneOnly`).toBe(false);
  expect(p.zoneTe ?? null, `chip ${i} zoneTe`).toBeNull();
  expect(p.pushFeet ?? null, `chip ${i} pushFeet`).toBeNull();
  expect(p.excludeNames, `chip ${i} excludeNames`).toEqual(['Young Red Dragon 1']);
  expect(p.storeLastAttack, `chip ${i} storeLastAttack`).toBe(false);
  expect(ROLLERS.rollSavingThrow, `chip ${i} rolled a save before the picker resolved`).not.toHaveBeenCalled();
  return p;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  pickerProps.current = null;
});

describe('MA-1789/1790/1791 young-red-dragon magma + tremor lair chip lock', () => {
  it('lair block renders EXACTLY THREE clickable chips — "Magma Geyser." + "Erupting Magma." + "Tremor.", all "DC 15 Dexterity"; zero static prose rows', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips).toHaveLength(3);
    expect(chips.map(c => c.textContent.trim())).toEqual(['DC 15 Dexterity', 'DC 15 Dexterity', 'DC 15 Dexterity']);
    expect(chips.map(c => c.getAttribute('title'))).toEqual([
      'Lair action — DC 15 Dexterity. Chosen on initiative 20, GM-enforced.',
      'Lair action — DC 15 Dexterity. Chosen on initiative 20, GM-enforced.',
      'Lair action — DC 15 Dexterity. Chosen on initiative 20, GM-enforced.',
    ]);
    expect(chips.map(c => c.closest('.mc-action').querySelector('strong')?.textContent)).toEqual(['Magma Geyser.', 'Erupting Magma.', 'Tremor.']);
    const staticRows = Array.from(document.querySelectorAll('.mc-action')).filter(el => !el.querySelector('.mc-dice-link-lair'));
    expect(staticRows).toHaveLength(0);
  });

  it('all three chip presses arm the picker at the authored save legs — DEX DC 15 6d6 Fire half twins (5-ft Radius) + damageless tremor knocker (60-ft Radius, prone), zero save rolled at press', async () => {
    renderDragon();
    for (const c of PICKER_CASES) await clickChip(c);
  });
});
