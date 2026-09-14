// MA-0049: Adult Blue Dracolich Lightning Breath click-path. Row authors
// recharge as a structured usage OBJECT {type:"recharge on roll", dice:"1d6",
// min_value:5} — the row must render "(Recharge 5+)" (never "[object Object]"),
// spend/refuse/regain at threshold 5 via monsterRecharge (MA-0031 economy),
// and route the "90-foot line" text through the MA-0035 line picker (multi
// .secondary-target-row saves DC 20 DEX, half-on-success math untouched).
// Safety gate (Defect 1 self-resolve): a single-target save row (Frightful
// Presence) clicked with NO armed target refuses — popup +
// frightful_presence_refused (no target), zero self-target save.
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
      <div className="sp-overlay drac-line-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 67, rolls: [6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 134, rolls: [], modifier: 0 })),
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

const ARMED = [
  { name: 'Adult Blue Dracolich 1', type: 'npc', monsterType: 'undead', targetName: 'ElderPaladin', currentHp: 225, maxHp: 225, ac: 19, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];
const UNARMED = [
  { name: 'Adult Blue Dracolich 1', type: 'npc', monsterType: 'undead', targetName: null, currentHp: 225, maxHp: 225, ac: 19, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function dracolich() {
  return makeMonster({ ...monstersData.find(m => m.index === 'adult-blue-dracolich'), name: 'Adult Blue Dracolich' });
}

function renderDracolich(creatures = ARMED) {
  return render(<MonsterCardModal {...makeProps(dracolich(), { creatureName: 'Adult Blue Dracolich 1', creatures })} />);
}

function breathRow() {
  return Array.from(document.querySelectorAll('.mc-action')).find(el => el.textContent.includes('Lightning Breath')) || null;
}

function breathLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('.mc-action')?.textContent.includes('Lightning Breath')) || null;
}

function fpLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes('DC 18 Wisdom')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0049 Lightning Breath recharge-usage-object + 90-ft line picker', () => {
  it('row renders "(Recharge 5+)" chip text — never "[object Object]"', () => {
    renderDracolich();
    const row = breathRow();
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('(Recharge 5+)');
    expect(document.body.textContent).not.toContain('[object Object]');
  });

  it('fresh click spends the usage-object recharge at threshold 5 and routes the LINE row to the area picker DC 20 DEX, 12d10, half-on-success', async () => {
    renderDracolich();
    const link = breathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(runtime.store['Adult Blue Dracolich 1.monsterRecharge']).toBeTruthy());
    expect(runtime.store['Adult Blue Dracolich 1.monsterRecharge']).toEqual({ 'Lightning Breath': { recharged: false, threshold: 5 } });
    expect(aoeProps.current).toBeTruthy();
    expect(aoeProps.current.saveDc).toBe(20);
    expect(aoeProps.current.saveType).toBe('Dexterity');
    expect(aoeProps.current.damage).toBe('12d10');
    expect(aoeProps.current.dcSuccess).toBe('half');
    expect(aoeProps.current.rangeGateFt).toBe(90);
    expect(aoeProps.current.excludeNames).toEqual(['Adult Blue Dracolich 1']);
    expect(aoeProps.current.storeLastAttack).toBe(false);
    expect(aoeProps.current.titleOverride).toBe('90-ft Line (GM positions tokens; selection advisory)');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/Lightning Breath.*Recharge 5\+; unavailable until a d6 5\+/);
  });

  it('spent row refuses: "(Recharge 5+ — unavailable)" + lightning_breath_refused popup/log, zero prompts, picker stays closed', async () => {
    runtime.store['Adult Blue Dracolich 1.monsterRecharge'] = { 'Lightning Breath': { recharged: false, threshold: 5 } };
    renderDracolich();
    const link = breathLink();
    expect(link.className).toContain('mc-dice-link-spell-spent');
    expect(breathRow().textContent).toContain('(Recharge 5+ — unavailable)');
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(aoeProps.current).toBeNull();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Not Recharged');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'lightning_breath_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.description).toMatch(/d6 5\+/);
    expect(refusal.characterName).toBe('Adult Blue Dracolich 1');
  });

  it('recharged row re-arms: picker opens again and re-spends', async () => {
    runtime.store['Adult Blue Dracolich 1.monsterRecharge'] = { 'Lightning Breath': { recharged: true, threshold: 5 } };
    renderDracolich();
    fireEvent.click(breathLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    aoeProps.onClose();
    expect(runtime.store['Adult Blue Dracolich 1.monsterRecharge']['Lightning Breath'].recharged).toBe(false);
  });
});

describe('MA-0049 no-target safety gate — no self-resolve', () => {
  it('single-target save row (Frightful Presence) clicked with NO armed target refuses: No Target popup + frightful_presence_refused (no target) log, zero self-save', async () => {
    renderDracolich(UNARMED);
    const chip = fpLink();
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(aoeProps.current).toBeNull();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('No Target');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'frightful_presence_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/refused \(no target\)/);
    expect(runtime.store['Adult Blue Dracolich 1.monsterRecharge'] == null).toBe(true);
  });

  it('same row with an armed target still resolves the save untouched (half-on-success seam)', async () => {
    renderDracolich(ARMED);
    fireEvent.click(fpLink());
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const call = rollSavingThrow.mock.calls[0];
    expect(String(call[0]).toLowerCase()).toBe('wis');
    expect(call[2]).toMatchObject({ saveDc: 18 });
  });
});
