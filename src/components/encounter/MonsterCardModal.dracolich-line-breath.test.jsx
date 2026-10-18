// @maintained-by-ai
// MA-0049: Adult Blue Dracolich Lightning Breath click-path — dracolich-DISTINCT
// lane only. Row authors recharge as a structured usage OBJECT
// {type:"recharge on roll", dice:"1d6", min_value:5}, so the modal must render
// "(Recharge 5+)" / "(Recharge 5+ — unavailable)" from that object (never
// "[object Object]"), spend/refuse at threshold 5 through it, and route this row's
// "90-foot line" text to the LINE picker (DC 20 DEX 12d10). Row pinned BY-name
// (#387). Cite-skips: generic line picker/spent-refuse/re-arm →
// MonsterCardModal.line-breath.test.jsx (MA-0035 twin, flat "5-6" string);
// recharge economy (gate/spend/label/regain) → monsterRecharge.test.js (#559);
// armed FP save + no-target refusal builder bytes → dracolich-fp.test.jsx (MA-0044)
// + MonsterCardHelpers.usage.test.js. Safety gate (Defect 1 self-resolve) stays:
// FP clicked with NO armed target refuses — no self-target save.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
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

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

describe('MA-0049 structured usage-object recharge — modal click-path (dracolich-distinct)', () => {
  it('fresh click: row renders structured "(Recharge 5+)" chip (never [object Object]), spends at threshold 5, routes the 90-ft LINE picker DC 20 DEX 12d10', async () => {
    renderDracolich();
    const row = breathRow();
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('(Recharge 5+)');
    expect(document.body.textContent).not.toContain('[object Object]');
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
    expect(aoeProps.current.rangeGateFt).toBe(90);
    expect(aoeProps.current.titleOverride).toBe('90-ft Line (GM positions tokens; selection advisory)');
  });

  it('spent structured row refuses: "(Recharge 5+ — unavailable)" chip, lightning_breath_refused log, zero prompts, picker stays closed', async () => {
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
    expect(refusal.characterName).toBe('Adult Blue Dracolich 1');
  });
});

describe('MA-0049 no-target safety gate — no self-resolve', () => {
  it('single-target save row (Frightful Presence) clicked with NO armed target refuses: No Target popup + frightful_presence_refused log, zero self-save, zero spend', async () => {
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
    expect(refusal.characterName).toBe('Adult Blue Dracolich 1');
    expect(runtime.store['Adult Blue Dracolich 1.monsterRecharge'] == null).toBe(true);
  });
});
