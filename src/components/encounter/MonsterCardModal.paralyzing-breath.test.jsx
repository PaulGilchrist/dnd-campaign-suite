// MA-0248: Ancient Silver Dragon Paralyzing Breath click-path enforcement —
// data lock (dc_success 'none', staged_paralysis 1 minute), NO recharge,
// cone picker armed with stagedParalysis (paralyzed_minutes×10 rounds,
// CLA-334), no half-damage dcSuccess, zero damage. Re-usable row: every
// fresh click arms the picker (MA-0068 sleepStaging shape minus the gate).
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

const CREATURES = [
  { name: 'Ancient Silver Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 468, maxHp: 468, ac: 22, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function silverActions() {
  const dragon = monstersData.find(m => m.index === 'ancient-silver-dragon');
  return dragon.actions;
}

function paralyzingBreathAction() {
  return silverActions().find(a => a.name === 'Paralyzing Breath');
}

function renderSilver() {
  const m = makeMonster({ name: 'Ancient Silver Dragon', actions: silverActions() });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Silver Dragon 1', creatures: CREATURES })} />);
}

function paralyzingBreathLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Paralyzing Breath')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0248 Ancient Silver Dragon Paralyzing Breath data lock', () => {
  it('row authors dc_success none + staged_paralysis 1 minute on DC 24 CON, no damage dice, no recharge', () => {
    const action = paralyzingBreathAction();
    expect(action).toBeTruthy();
    expect(action.save_dc).toBe(24);
    expect(action.save_type).toBe('Constitution');
    expect(action.dc_success).toBe('none');
    expect(action.staged_paralysis).toEqual({ paralyzed_minutes: 1 });
    expect(action.recharge == null).toBe(true);
    expect(action.damage_dice_primary == null).toBe(true);
  });

  it('save_effect keeps canonical two-stage ladder prose', () => {
    const action = paralyzingBreathAction();
    expect(action.save_effect).toContain('First Failure: The target has the Incapacitated condition');
    expect(action.save_effect).toContain('Second Failure: The target has the Paralyzed condition');
    expect(action.save_effect).toContain('After 1 minute, it succeeds automatically');
  });
});

describe('MA-0248 Paralyzing Breath staged cone picker', () => {
  it('fresh click arms the cone picker with stagedParalysis (10 rounds), dc_success none, no damage, no sleepStaging', async () => {
    renderSilver();
    const link = paralyzingBreathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.saveDc).toBe(24);
    expect(aoeProps.current.saveType).toBe('Constitution');
    expect(aoeProps.current.damage).toBe(null);
    expect(aoeProps.current.dcSuccess).toBe('none');
    expect(aoeProps.current.stagedParalysis).toEqual({ paralyzedRounds: 10 });
    expect(aoeProps.current.sleepStaging == null).toBe(true);
    expect(aoeProps.current.coneFt ?? aoeProps.current.range).toBe(90);
    expect(aoeProps.current.excludeNames).toEqual(['Ancient Silver Dragon 1']);
    expect(aoeProps.current.storeLastAttack).toBe(false);
  });

  it('ungated row re-arms: close + click opens the picker again with stagedParalysis (no recharge authored)', async () => {
    renderSilver();
    fireEvent.click(paralyzingBreathLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const firstProps = aoeProps.current;
    expect(firstProps.stagedParalysis).toEqual({ paralyzedRounds: 10 });
    aoeProps.onClose();
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeNull());
    fireEvent.click(paralyzingBreathLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.stagedParalysis).toEqual({ paralyzedRounds: 10 });
    expect(runtime.store['Ancient Silver Dragon 1.monsterRecharge'] == null).toBe(true);
  });
});
