// MA-0079: Adult Bronze Dragon Repulsion Breath click-path — damageless
// Recharge 5-6 STR cone. Fresh click spends the recharge (d6 5+ regain),
// routes to the cone area picker with dc_success none (never the half-damage
// prompt boilerplate), the parsed Prone saveConditions and the parsed 60-ft
// push clause (pushFeet) so the picker grants prone + push marker on fails.
// A spent row refuses with popup + repulsion_breath_refused zero-prompt.
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
      <div className="sp-overlay cone-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
}));

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
  { name: 'Adult Bronze Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'AberrantSorcerer', currentHp: 212, maxHp: 212, ac: 18, conditions: [] },
  { name: 'AberrantSorcerer', type: 'player', currentHp: 52, maxHp: 52, conditions: [] },
];

function dragonActions() {
  return monstersData.find(m => m.index === 'adult-bronze-dragon').actions;
}

function renderDragon() {
  const m = makeMonster({ name: 'Adult Bronze Dragon', actions: dragonActions() });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Bronze Dragon 1', creatures: CREATURES })} />);
}

function repulsionLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Repulsion Breath')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0079 Repulsion Breath recharge gate + cone picker seams', () => {
  it('data lock: recharge 5-6 + dc_success none authored on the Repulsion Breath row', () => {
    const row = dragonActions().find(a => a.name === 'Repulsion Breath');
    expect(row.recharge).toBe('5-6');
    expect(row.dc_success).toBe('none');
  });

  it('fresh click spends the recharge (threshold 5) and routes the CONE row to the area picker with prone + pushFeet + dc_success none', async () => {
    renderDragon();
    const link = repulsionLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(runtime.store['Adult Bronze Dragon 1.monsterRecharge']).toBeTruthy());
    expect(runtime.store['Adult Bronze Dragon 1.monsterRecharge']).toEqual({ 'Repulsion Breath': { recharged: false, threshold: 5 } });
    expect(aoeProps.current).toBeTruthy();
    expect(aoeProps.current.saveDc).toBe(19);
    expect(aoeProps.current.saveType).toBe('Strength');
    expect(aoeProps.current.damage).toBeNull();
    expect(aoeProps.current.dcSuccess).toBe('none');
    expect(aoeProps.current.saveConditions).toEqual(['prone']);
    expect(aoeProps.current.pushFeet).toBe(60);
    expect(aoeProps.current.storeLastAttack).toBe(false);
    expect(aoeProps.current.excludeNames).toEqual(['Adult Bronze Dragon 1']);
    expect(aoeProps.current.rangeGateFt).toBe(30);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/Repulsion Breath.*Recharge 5-6; unavailable until a d6 5\+/);
  });

  it('spent row refuses: Not Recharged popup + repulsion_breath_refused log, zero prompts, picker stays closed', async () => {
    runtime.store['Adult Bronze Dragon 1.monsterRecharge'] = { 'Repulsion Breath': { recharged: false, threshold: 5 } };
    renderDragon();
    const link = repulsionLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(aoeProps.current).toBeNull();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Not Recharged');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'repulsion_breath_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Adult Bronze Dragon 1');
  });

  it('recharged row re-arms: picker opens and re-spends (picker-open spend convention)', async () => {
    runtime.store['Adult Bronze Dragon 1.monsterRecharge'] = { 'Repulsion Breath': { recharged: true, threshold: 5 } };
    renderDragon();
    fireEvent.click(repulsionLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    aoeProps.onClose();
    expect(runtime.store['Adult Bronze Dragon 1.monsterRecharge']['Repulsion Breath'].recharged).toBe(false);
  });
});
