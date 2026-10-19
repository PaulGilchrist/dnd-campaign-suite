// @maintained-by-ai
// MA-1783/84/85 modal-seam lane: young-green-dragon lair_actions [0] was a
// BARE STRING, [1] a nameless dict, [2] a nameless thorn-wall dict (all inert
// static spans — MonsterCardBody.jsx:385 first disjunct). DATA fixes promote
// them to three named SAVE rows: "Grasping Roots" + "Erupting Roots" (both
// DC 15 Strength, dcSuccess none, restrained) and "Wall of Thorns"
// (DC 15 Dexterity, 4d8 Piercing half-on-success). This file pins ONLY the
// modal seam: the rendered chip census and each press arming SaveAttackAoeModal
// at the authored DC/type through handleLairRow → handleSaveRoll.
// Cited owners, NOT re-pinned here: disk data locks (monsterLairActions.test.js
// :2881-2895, :2974-2978), chip-vs-static render branches + inert gate
// (MonsterCardModal.lair-actions.test.jsx:114/:153/:176), breathAoeShape
// Line-parse of the thorn row (MonsterCardModal.save-variant-shape.test.jsx:50-55).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const pickerProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    pickerProps.current = props;
    return <div className="sp-overlay young-green-roots-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
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

// Per-chip picker contract: [0]/[1] are the STR DC 15 restrained save twins
// (20-ft Radius picker from prose radius, rangeGateFt null); [2] is the DEX
// half-damage thorn leg (prose Line, coverage 120 — parse owned by
// save-variant-shape.test.jsx:50-55). Nulling pickerProps.current first
// proves THIS click (not a stale render) opened/updated the picker.
const PICKER_CASES = [
  { i: 0, saveType: 'Strength', dcSuccess: 'none', saveConditions: ['restrained'], range: 20, rangeGateFt: null, titleOverride: '20-ft Radius (GM positions tokens; selection advisory)' },
  { i: 1, saveType: 'Strength', dcSuccess: 'none', saveConditions: ['restrained'], range: 20, rangeGateFt: null, titleOverride: '20-ft Radius (GM positions tokens; selection advisory)' },
  { i: 2, saveType: 'Dexterity', dcSuccess: 'half', saveConditions: [], range: 120, rangeGateFt: 120, titleOverride: '120-ft Line (GM positions tokens; selection advisory)' },
];

async function clickChip({ i, saveType, dcSuccess, saveConditions, range, rangeGateFt, titleOverride }) {
  pickerProps.current = null;
  fireEvent.click(lairChips()[i]);
  await waitFor(() => expect(pickerProps.current, `chip ${i} did not open the picker`).toBeTruthy());
  const p = pickerProps.current;
  expect(p.saveDc, `chip ${i} saveDc`).toBe(15);
  expect(p.saveType, `chip ${i} saveType`).toBe(saveType);
  expect(p.dcSuccess, `chip ${i} dcSuccess`).toBe(dcSuccess);
  expect(p.saveConditions, `chip ${i} saveConditions`).toEqual(saveConditions);
  expect(p.range, `chip ${i} range`).toBe(range);
  expect(p.titleOverride, `chip ${i} titleOverride`).toBe(titleOverride);
  expect(p.rangeGateFt, `chip ${i} rangeGateFt`).toBe(rangeGateFt);
  expect(p.zoneOnly, `chip ${i} zoneOnly`).toBe(false);
  expect(p.zoneTe ?? null, `chip ${i} zoneTe`).toBeNull();
  expect(p.pushFeet ?? null, `chip ${i} pushFeet`).toBeNull();
  expect(p.excludeNames, `chip ${i} excludeNames`).toEqual(['Young Green Dragon 1']);
  expect(p.storeLastAttack, `chip ${i} storeLastAttack`).toBe(false);
  expect(ROLLERS.rollSavingThrow, `chip ${i} rolled a save before the picker resolved`).not.toHaveBeenCalled();
  return p;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  pickerProps.current = null;
});

describe('MA-1783/84/85 young-green-dragon roots + thorn-wall lair chip lock', () => {
  it('lair block renders EXACTLY THREE clickable chips — "Grasping Roots." + "Erupting Roots." ("DC 15 Strength") + "Wall of Thorns." ("DC 15 Dexterity")', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips).toHaveLength(3);
    expect(chips.map(c => c.textContent.trim())).toEqual(['DC 15 Strength', 'DC 15 Strength', 'DC 15 Dexterity']);
    expect(chips.map(c => c.getAttribute('title'))).toEqual([
      'Lair action — DC 15 Strength. Chosen on initiative 20, GM-enforced.',
      'Lair action — DC 15 Strength. Chosen on initiative 20, GM-enforced.',
      'Lair action — DC 15 Dexterity. Chosen on initiative 20, GM-enforced.',
    ]);
    expect(chips.map(c => c.closest('.mc-action').querySelector('strong')?.textContent)).toEqual(['Grasping Roots.', 'Erupting Roots.', 'Wall of Thorns.']);
  });

  it('all three chip presses arm the picker at the authored save legs — STR DC 15 restrained twins (20-ft Radius, no damage) + DEX 4d8 Piercing half (120-ft Line), zero save rolled at press', async () => {
    renderDragon();
    for (const c of PICKER_CASES) {
      const p = await clickChip(c);
      const damage = p.damage ?? null;
      if (c.i === 2) {
        expect(damage, 'thorn chip damage').toBe('4d8');
        expect(p.damageType, 'thorn chip damageType').toBe('Piercing');
      } else {
        expect(damage, `roots chip ${c.i} damage (damageless RAW)`).toBeNull();
        expect(p.damageType || null, `roots chip ${c.i} damageType`).toBeNull();
      }
    }
  });
});
