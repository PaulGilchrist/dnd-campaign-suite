// MA-0035: Adult Black Dragon Acid Breath (Recharge 5-6) click-path.
// Fresh click spends the recharge (threshold 5), routes the LINE row through
// the SAME SaveAttackAoeModal flow as MA-0031 cones with a labelled
// "60-ft Line" title; row exposes the labelled "DC 18 Dexterity" save
// affordance; spent click refuses with acid_breath_refused (not recharged)
// zero prompts. Save math untouched (picker per-target half-on-success).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null, onClose: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    aoeProps.onClose = props.onClose;
    return (
      <div className="sp-overlay line-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 51, rolls: [4, 4, 7, 6, 6, 3, 6, 5, 3, 2, 2, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 102, rolls: [], modifier: 0 })),
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
  { name: 'Adult Black Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 195, maxHp: 195, ac: 19, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function dragonActions() {
  return monstersData.find(m => m.name === 'Adult Black Dragon').actions;
}

function renderDragon() {
  const m = makeMonster({ name: 'Adult Black Dragon', actions: dragonActions() });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Black Dragon 1', creatures: CREATURES })} />);
}

function acidBreathLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Acid Breath')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0035 Acid Breath (Recharge 5-6) recharge gate + line routing', () => {
  it('fresh click spends recharge at threshold 5 and routes the LINE row to the area picker with a labelled title', async () => {
    renderDragon();
    const link = acidBreathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(runtime.store['Adult Black Dragon 1.monsterRecharge']).toBeTruthy());
    expect(runtime.store['Adult Black Dragon 1.monsterRecharge']).toEqual({ 'Acid Breath': { recharged: false, threshold: 5 } });
    expect(aoeProps.current).toBeTruthy();
    expect(aoeProps.current.saveDc).toBe(18);
    expect(aoeProps.current.saveType).toBe('Dexterity');
    expect(aoeProps.current.damage).toBe('12d8');
    expect(aoeProps.current.dcSuccess).toBe('half');
    expect(aoeProps.current.rangeGateFt).toBe(60);
    expect(aoeProps.current.excludeNames).toEqual(['Adult Black Dragon 1']);
    expect(aoeProps.current.storeLastAttack).toBe(false);
    expect(aoeProps.current.titleOverride).toBe('60-ft Line (GM positions tokens; selection advisory)');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/Acid Breath.*Recharge 5-6; unavailable until a d6 5\+/);
  });

  it('row exposes the labelled "DC 18 Dexterity" save affordance beside the dice chip', async () => {
    renderDragon();
    const chip = acidBreathLink();
    expect(chip.textContent.trim()).toContain('12d8');
    const label = chip.closest('.mc-action').querySelector('.mc-dice-link-save');
    expect(label).toBeTruthy();
    expect(label.textContent.trim()).toContain('DC 18 Dexterity');
    fireEvent.click(label);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.saveDc).toBe(18);
  });

  it('spent row refuses: acid_breath_refused (not recharged) popup + log, zero prompts, picker stays closed', async () => {
    runtime.store['Adult Black Dragon 1.monsterRecharge'] = { 'Acid Breath': { recharged: false, threshold: 5 } };
    renderDragon();
    const link = acidBreathLink();
    expect(link.className).toContain('mc-dice-link-spell-spent');
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(aoeProps.current).toBeNull();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Not Recharged');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'acid_breath_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.description).toMatch(/d6 5\+/);
    expect(refusal.characterName).toBe('Adult Black Dragon 1');
  });

  it('recharged row re-arms: picker opens again and re-spends', async () => {
    runtime.store['Adult Black Dragon 1.monsterRecharge'] = { 'Acid Breath': { recharged: true, threshold: 5 } };
    renderDragon();
    fireEvent.click(acidBreathLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    aoeProps.onClose();
    expect(runtime.store['Adult Black Dragon 1.monsterRecharge']['Acid Breath'].recharged).toBe(false);
  });
});
