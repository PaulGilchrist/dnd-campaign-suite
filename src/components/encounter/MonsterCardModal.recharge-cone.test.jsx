// @maintained-by-ai
// MA-0031: Abominable Yeti Cold Breath (Recharge 6) — the recharge CONE lane of
// MonsterCardModal. This file owns the row-specific click lane only: fresh press
// spends at picker-open (CLA-384 convention) and routes the "30-foot Cone" save
// row to the SaveAttackAoeModal picker (the picker IS target selection — zero
// single-target rollSavingThrow); a spent press refuses with the .mc-recharge-refusal
// popup byte + cold_breath_refused log and zero spend; a recharged row re-arms and
// refires. Parse/gate semantics (threshold, suffix-stripped key, display text,
// turn-start d6 recovery) are canonically owned by monsterRecharge.test.js:41-57 /
// :145 / :203-237 — here only rechargeUsageOf(ROW)+monsterRechargeGate(ROW, null)
// arm bytes on the disk row. dc_success unauthored on the cone row → honest app-wide
// 'half' default (ma1859 :131 discipline); the Chilling Gaze row's authored
// dc_success:"none" override is asserted live on its own block-save press (MA-0030;
// immunity helper log shape owned by MonsterCardHelpers.gaze-immunity.test.js).
// Half-damage math: applyDamage.save-full.test.js:18-25. No diceRoller mock: this
// lane rolls nothing in the modal (recharge d6 lives at the turnStartEffects seam).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monsters from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return (
      <div className="sp-overlay cone-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
        <button className="cone-picker-close" onClick={() => props.onClose()}>Close</button>
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
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
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
import { MONSTER_RECHARGE_KEY, monsterRechargeGate, rechargeUsageOf } from '../../services/encounters/monsterRecharge.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const KEY = `Abominable Yeti 1.${MONSTER_RECHARGE_KEY}`;
const YETI = monsters.find(m => m.index === 'abominable-yeti');
const ROW = YETI.actions.find(a => a.name === 'Cold Breath (Recharge 6)');

const CREATURES = [
  { name: 'Abominable Yeti 1', type: 'npc', monsterType: 'monstrosity', targetName: 'ElderPaladin', currentHp: 137, maxHp: 137, ac: 15, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function yetiProps() {
  const m = makeMonster({ name: 'Abominable Yeti', actions: YETI.actions });
  return makeProps(m, { creatureName: 'Abominable Yeti 1', creatures: CREATURES });
}

function actionRow(namePrefix) {
  return Array.from(document.querySelectorAll('.mc-action')).find(el => el.textContent.trim().startsWith(namePrefix)) || null;
}

function chipInRow(namePrefix) {
  const row = actionRow(namePrefix);
  return row ? row.querySelector('.mc-dice-link') : null;
}

function logEntries(pred) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e && pred(e));
}

// Picker-arm transport: exact-shape one-shot of the semantic props the cone row
// hands SaveAttackAoeModal — authored bytes plus honest nulls for every clause the
// Cold Breath row does NOT write (zoneTe/pushFeet/staging family).
const PICKER_KEYS = ['range', 'damage', 'damageType', 'secondaryDamage', 'secondaryDamageType', 'saveType', 'saveDc', 'dcSuccess', 'titleOverride', 'excludeNames', 'rangeGateFt', 'zoneTe', 'zoneOnly', 'saveConditions', 'sleepStaging', 'stagedParalysis', 'pushFeet'];
const pickerArm = (props) => Object.fromEntries(PICKER_KEYS.map(k => [k, props[k]]));

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0031 Cold Breath (Recharge 6) cone lane', () => {
  it('disk row arms the gate: flat recharge:"6" → threshold 6, suffix-stripped key "Cold Breath"', () => {
    // Full disk identity locks the byte contract behind the live press tests.
    expect(ROW).toEqual({
      name: 'Cold Breath (Recharge 6)',
      description: 'Constitution Saving Throw: DC 18, each creature in a 30-foot <strong>Cone</strong>. <strong>Failure:</strong> 45 (10d8) Cold damage. <strong>Success:</strong> Half damage.',
      save_dc: 18,
      save_type: 'Constitution',
      recharge: '6',
      damage_dice_primary: '10d8',
      damage_type_primary: 'Cold',
      save_effect: 'Failure: 45 (10d8) Cold damage. Success: Half damage.',
    });
    expect(rechargeUsageOf(ROW)).toEqual({ threshold: 6 });
    expect(monsterRechargeGate(ROW, null)).toEqual({ key: 'Cold Breath', threshold: 6, available: true });
  });

  it('press lifecycle: fresh press spends at picker-open (zero single-target roll); spent press refuses popup+log with zero spend; recharged row re-arms and refires', async () => {
    const ui = render(<MonsterCardModal {...yetiProps()} />);

    // press 1 — fresh: cone routes to the picker, spend stamped, spend logged.
    fireEvent.click(chipInRow('Cold Breath'));
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeTruthy());
    // the picker IS target selection — no single-target block save on a cone row
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[KEY]).toEqual({ 'Cold Breath': { recharged: false, threshold: 6 } });
    const spends = logEntries(e => e.type === 'ability_use');
    expect(spends).toHaveLength(1);
    expect(spends[0].description).toMatch(/Cold Breath.*Recharge 6; unavailable until a d6 6\+/);
    expect(pickerArm(aoeProps.current)).toEqual({
      range: 30,
      damage: '10d8',
      damageType: 'Cold',
      secondaryDamage: null,
      secondaryDamageType: null,
      saveType: 'Constitution',
      saveDc: 18,
      // dc_success unauthored on disk → honest app-wide half-on-save default
      dcSuccess: 'half',
      titleOverride: '30-ft Cone (GM positions tokens; selection advisory)',
      excludeNames: ['Abominable Yeti 1'],
      rangeGateFt: 30,
      zoneTe: null,
      zoneOnly: false,
      saveConditions: [],
      sleepStaging: null,
      stagedParalysis: null,
      pushFeet: null,
    });
    // row re-rendered SPENT behind the open picker
    expect(chipInRow('Cold Breath').className).toContain('mc-dice-link-spell-spent');
    expect(actionRow('Cold Breath').textContent).toContain('(Recharge 6 — unavailable)');

    // close keeps it spent (picker-open spend convention, CLA-384)
    fireEvent.click(document.querySelector('.cone-picker-close'));
    expect(document.querySelector('.cone-picker-stub')).toBeNull();
    expect(runtime.store[KEY]['Cold Breath'].recharged).toBe(false);

    // press 2 — spent: refusal popup byte + refused log, picker stays closed,
    // zero rolls, zero extra spend.
    aoeProps.current = null;
    fireEvent.click(chipInRow('Cold Breath'));
    await waitFor(() => expect(logEntries(e => e.automationType === 'cold_breath_refused')).toHaveLength(1));
    const refusal = logEntries(e => e.automationType === 'cold_breath_refused')[0];
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Abominable Yeti 1');
    expect(setPopupHtml.mock.calls.map(c => String(c[0])).some(h => h.includes('mc-recharge-refusal'))).toBe(true);
    expect(document.querySelector('.cone-picker-stub')).toBeNull();
    expect(aoeProps.current).toBeNull();
    expect(runtime.store[KEY]).toEqual({ 'Cold Breath': { recharged: false, threshold: 6 } });

    // press 3 — recharged (turn-start d6 recovery is monsterRecharge.test.js-owned):
    // label drops "unavailable", picker re-arms and RE-SPENDS.
    runtime.store[KEY] = { 'Cold Breath': { recharged: true, threshold: 6 } };
    ui.rerender(<MonsterCardModal {...yetiProps()} />);
    expect(chipInRow('Cold Breath').className).not.toContain('mc-dice-link-spell-spent');
    expect(actionRow('Cold Breath').textContent).toContain('(Recharge 6)');
    expect(actionRow('Cold Breath').textContent).not.toContain('unavailable');
    fireEvent.click(chipInRow('Cold Breath'));
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeTruthy());
    await waitFor(() => expect(runtime.store[KEY]['Cold Breath']).toEqual({ recharged: false, threshold: 6 }));
    expect(aoeProps.current.titleOverride).toBe('30-ft Cone (GM positions tokens; selection advisory)');

    // lifecycle totals: two spends, one refusal, never a single-target roll
    expect(logEntries(e => e.type === 'ability_use')).toHaveLength(2);
    expect(logEntries(e => e.automationType === 'cold_breath_refused')).toHaveLength(1);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('non-cone save row on the same card stays the block-save lane: authored dc_success:"none" rides the roll, a spent cone row never blocks it', async () => {
    runtime.store[KEY] = { 'Cold Breath': { recharged: false, threshold: 6 } };
    render(<MonsterCardModal {...yetiProps()} />);
    fireEvent.click(chipInRow('Chilling Gaze'));
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.cone-picker-stub')).toBeNull();
    const opts = rollSavingThrow.mock.calls[0][2];
    expect(opts.saveDc).toBe(18);
    // MA-0030: authored dc_success:"none" overrides the app-wide 'half' default
    expect(opts.dcSuccess).toBe('none');
  });
});
