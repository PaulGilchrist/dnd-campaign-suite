// MA-0068: Adult Brass Dragon Sleep Breath click-path enforcement —
// data lock (Recharge 5-6, dc_success 'none', staged_sleep), recharge gate
// + spend at picker open, cone picker armed with sleepStaging
// (unconscious_minutes×10 rounds, CLA-334) and no half-damage dcSuccess,
// spent row refuses with sleep_breath_refused zero prompts.
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
  { name: 'Adult Brass Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 172, maxHp: 172, ac: 18, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function brassActions() {
  const dragon = monstersData.find(m => m.index === 'adult-brass-dragon');
  return dragon.actions;
}

function sleepBreathAction() {
  return brassActions().find(a => a.name === 'Sleep Breath');
}

function renderBrass() {
  const m = makeMonster({ name: 'Adult Brass Dragon', actions: brassActions() });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Brass Dragon 1', creatures: CREATURES })} />);
}

function sleepBreathLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Sleep Breath')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0068 Adult Brass Dragon Sleep Breath data lock', () => {
  it('row authors recharge 5-6, dc_success none, staged_sleep 10 minutes, DC 18 CON, no damage dice', () => {
    const action = sleepBreathAction();
    expect(action).toBeTruthy();
    expect(action.save_dc).toBe(18);
    expect(action.save_type).toBe('Constitution');
    expect(action.recharge).toBe('5-6');
    expect(action.dc_success).toBe('none');
    expect(action.staged_sleep).toEqual({ unconscious_minutes: 10 });
    expect(action.damage_dice_primary == null).toBe(true);
  });
});

describe('MA-0068 Sleep Breath recharge gate + staged cone picker', () => {
  it('fresh click spends the recharge and arms the cone picker with sleepStaging (100 rounds), dc_success none, no damage', async () => {
    renderBrass();
    const link = sleepBreathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(runtime.store['Adult Brass Dragon 1.monsterRecharge']).toBeTruthy());
    expect(runtime.store['Adult Brass Dragon 1.monsterRecharge']).toEqual({ 'Sleep Breath': { recharged: false, threshold: 5 } });
    expect(aoeProps.current).toBeTruthy();
    expect(aoeProps.current.saveDc).toBe(18);
    expect(aoeProps.current.saveType).toBe('Constitution');
    expect(aoeProps.current.damage).toBe(null);
    expect(aoeProps.current.dcSuccess).toBe('none');
    expect(aoeProps.current.sleepStaging).toEqual({ unconsciousRounds: 100 });
    expect(aoeProps.current.coneFt ?? aoeProps.current.range).toBe(60);
    expect(aoeProps.current.excludeNames).toEqual(['Adult Brass Dragon 1']);
    expect(aoeProps.current.storeLastAttack).toBe(false);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/Sleep Breath.*Recharge 5-6; unavailable until a d6 5\+/);
  });

  it('spent row refuses: popup + sleep_breath_refused (not recharged), picker stays closed, zero prompts', () => {
    runtime.store['Adult Brass Dragon 1.monsterRecharge'] = { 'Sleep Breath': { recharged: false, threshold: 5 } };
    renderBrass();
    const link = sleepBreathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(aoeProps.current).toBeNull();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Not Recharged');
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'sleep_breath_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Adult Brass Dragon 1');
  });

  it('recharged row re-arms: picker opens again with sleepStaging', async () => {
    runtime.store['Adult Brass Dragon 1.monsterRecharge'] = { 'Sleep Breath': { recharged: true, threshold: 5 } };
    renderBrass();
    fireEvent.click(sleepBreathLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.sleepStaging).toEqual({ unconsciousRounds: 100 });
    aoeProps.onClose();
    expect(runtime.store['Adult Brass Dragon 1.monsterRecharge']['Sleep Breath'].recharged).toBe(false);
  });
});
