// MA-0031: Abominable Yeti Cold Breath (Recharge 6) click-path enforcement.
// Fresh row → area picker opens (spend at click, picker-open convention),
// recharge map stamps unavailable, row reads "(Recharge 6 — unavailable)",
// second click refuses with popup + cold_breath_refused (not recharged) zero
// prompts; recharged row re-arms. Non-cone save rows keep the byte-identical
// single-target block save (rollSavingThrow).
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
  { name: 'Abominable Yeti 1', type: 'npc', monsterType: 'monstrosity', targetName: 'ElderPaladin', currentHp: 137, maxHp: 137, ac: 15, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function yetiActions() {
  const yeti = monstersData.find(m => m.index === 'abominable-yeti');
  return yeti.actions;
}

function renderYeti() {
  const m = makeMonster({ name: 'Abominable Yeti', actions: yetiActions() });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Abominable Yeti 1', creatures: CREATURES })} />);
}

function coldBreathLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Cold Breath')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0031 Cold Breath recharge gate + cone routing', () => {
  it('fresh click spends the recharge, routes the CONE row to the area picker (no single-target roll)', async () => {
    renderYeti();
    const link = coldBreathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(runtime.store['Abominable Yeti 1.monsterRecharge']).toBeTruthy());
    expect(runtime.store['Abominable Yeti 1.monsterRecharge']).toEqual({ 'Cold Breath': { recharged: false, threshold: 6 } });
    expect(aoeProps.current).toBeTruthy();
    expect(aoeProps.current.saveDc).toBe(18);
    expect(aoeProps.current.saveType).toBe('Constitution');
    expect(aoeProps.current.damage).toBe('10d8');
    expect(aoeProps.current.dcSuccess).toBe('half');
    expect(aoeProps.current.storeLastAttack).toBe(false);
    expect(aoeProps.current.excludeNames).toEqual(['Abominable Yeti 1']);
    expect(aoeProps.current.rangeGateFt).toBe(30);
    expect(aoeProps.current.titleOverride).toBe('30-ft Cone (GM positions tokens; selection advisory)');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/Cold Breath.*Recharge 6; unavailable until a d6 6\+/);
  });

  it('spent row shows "(Recharge 6 — unavailable)" + refused popup/log, zero prompts, picker stays closed', async () => {
    runtime.store['Abominable Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: false, threshold: 6 } };
    renderYeti();
    const link = coldBreathLink();
    expect(document.body.textContent).toContain('(Recharge 6 — unavailable)');
    expect(coldBreathLink()).toBeTruthy();
    expect(link.className).toContain('mc-dice-link-spell-spent');
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(aoeProps.current).toBeNull();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Not Recharged');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'cold_breath_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Abominable Yeti 1');
  });

  it('recharged row re-arms: label "(Recharge 6)" and picker opens again', async () => {
    runtime.store['Abominable Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: true, threshold: 6 } };
    renderYeti();
    expect(document.body.textContent).toContain('(Recharge 6)');
    expect(document.body.textContent).not.toContain('unavailable');
    fireEvent.click(coldBreathLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    // re-fire re-spends (picker-open spend convention); close keeps it spent
    aoeProps.onClose();
    expect(runtime.store['Abominable Yeti 1.monsterRecharge']['Cold Breath'].recharged).toBe(false);
  });

  it('non-cone save row keeps the byte-compatible single-target block save', async () => {
    runtime.store['Abominable Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: false, threshold: 6 } };
    renderYeti();
    const gaze = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => (el.closest('.mc-action')?.textContent || '').startsWith('Chilling Gaze'));
    fireEvent.click(gaze);
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(aoeProps.current).toBeNull();
    expect(rollSavingThrow.mock.calls[0][2].saveDc).toBe(18);
    expect(rollSavingThrow.mock.calls[0][2].dcSuccess).toBe('none');
  });
});
