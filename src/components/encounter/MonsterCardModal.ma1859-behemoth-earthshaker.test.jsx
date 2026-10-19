// @maintained-by-ai
// MA-1859: Behemoth "Earthshaker (Recharge 5-6)" — "(Recharge 5-6)" was NAME-TEXT
// ONLY: no `recharge` field authored, so the recharge gate resolved null → the DC 25
// Strength save chip re-opened a full save prompt on every same-turn press with zero
// spend, zero refusal, zero recovery die (MA-0663 dust-mephit family).
// Fix: ONE data field `recharge:"5-6"` — the flat byte-shape the live gate reads
// (§252 flat recharge fields; MA-1164 precedent). Row has NO structured range →
// breathAoeShape null → the single-target block-save lane (rollSavingThrow) is the
// live press surface; no AoE picker (discriminator per recharge-cone.test.jsx lane
// discipline). "on the ground" clause stays §70 advisory (grounded-state grep-zero).
// Parse/gate semantics (rechargeUsageOf threshold, display text, refusal-log shape)
// are canonically owned by monsterRecharge.test.js — flat '5-6' twin at :231-236;
// half-on-save math owned by applyDamage.save-full.test.js:18-19. This file owns
// only the disk row identity + the modal spend/refuse/re-arm click lane.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monsters from '../../../public/data/monsters.json';

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: () => <div className="sp-overlay cone-picker-stub" />,
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
import { MONSTER_RECHARGE_KEY, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const BEHEMOTH = monsters.find(m => m.name === 'Behemoth');
const ROW = BEHEMOTH.actions.find(a => a.name === 'Earthshaker (Recharge 5-6)');

const CREATURES = [
  { name: 'Behemoth 1', type: 'npc', monsterType: 'beast', targetName: 'ElderPaladin', currentHp: 594, maxHp: 594, ac: 22, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function renderBehemoth() {
  const m = makeMonster({ name: 'Behemoth', actions: BEHEMOTH.actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Behemoth 1', creatures: CREATURES })} />);
}

function earthshakerSaveChip() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find(a => /^Earthshaker/.test(a.textContent.trim()));
  return row ? Array.from(row.querySelectorAll('.mc-dice-link-save-clickable, .mc-dice-link-save')).find(el => el.textContent.includes('DC 25')) || null : null;
}

function findLogEntry(pred) {
  return addEntry.mock.calls.map(c => c[1]).find(e => e && pred(e));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  setPopupHtml(null);
});

describe('MA-1859 disk data lock — one-field fix recharge:"5-6"', () => {
  it('Earthshaker row full disk identity; flat recharge arms the gate key:Earthshaker threshold:5', () => {
    // Pre-fix this row had no recharge field → monsterRechargeGate null → unlimited
    // same-turn refires. Fresh available from the flat field proves the arm end-to-end;
    // spent/recharged availability + parse/display semantics: monsterRecharge.test.js.
    expect(ROW).toEqual({
      name: 'Earthshaker (Recharge 5-6)',
      save_type: 'Strength',
      save_dc: 25,
      description: 'Strength Saving Throw: DC 25, each creature within 60 ft. on the ground. Failure: 55 (10d10) Bludgeoning damage. Success: Half damage.',
      damage_dice_primary: '10d10',
      damage_type_primary: 'Bludgeoning',
      recharge: '5-6',
    });
    expect(monsterRechargeGate(ROW, null)).toEqual({ key: 'Earthshaker', threshold: 5, available: true });
  });
});

describe('MA-1859 live click-path — spend, refuse, re-arm', () => {
  it('first press FIRES and SPENDS: block save rolls (half-on-save threaded, no picker), recharge stamps spent, ability_use logged', async () => {
    renderBehemoth();
    const chip = earthshakerSaveChip();
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    // recharge-gated rows defer fire() behind the awaited spend (async lane)
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    // shapeless "within 60 ft." row stays the single-target block-save lane —
    // the AoE picker must never open (that is the recharge-cone lane's surface)
    expect(document.querySelector('.cone-picker-stub')).toBeNull();
    const opts = rollSavingThrow.mock.calls[0][2];
    expect(opts.saveDc).toBe(25);
    expect(opts.saveType).toBe('Strength');
    // dc_success unauthored on disk → app-wide half-on-save default threaded to the roll
    expect(opts.dcSuccess).toBe('half');
    await waitFor(() => expect(runtime.store[`Behemoth 1.${MONSTER_RECHARGE_KEY}`]).toEqual({ Earthshaker: { recharged: false, threshold: 5 } }));
    const spend = findLogEntry(e => e.type === 'ability_use' && String(e.abilityName || '').includes('Earthshaker'));
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/d6 5\+/);
  });

  it('SECOND same-turn press REFUSES: .mc-recharge-refusal popup + earthshaker_refused log, zero save roll, zero extra spend', async () => {
    runtime.store['Behemoth 1.monsterRecharge'] = { Earthshaker: { recharged: false, threshold: 5 } };
    renderBehemoth();
    const chip = earthshakerSaveChip();
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(document.body.textContent).toContain('(Recharge 5-6 — unavailable)');
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = findLogEntry(e => e.automationType === 'earthshaker_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Behemoth 1');
    const popupHtml = setPopupHtml.mock.calls.map(c => String(c[0])).find(h => h.includes('mc-recharge-refusal'));
    expect(popupHtml).toBeTruthy();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Behemoth 1.monsterRecharge']).toEqual({ Earthshaker: { recharged: false, threshold: 5 } });
  });

  it('recharged row RE-ARMS: label drops "unavailable", next press fires and RE-SPENDS', async () => {
    runtime.store['Behemoth 1.monsterRecharge'] = { Earthshaker: { recharged: true, threshold: 5 } };
    renderBehemoth();
    expect(document.body.textContent).toContain('(Recharge 5-6)');
    expect(document.body.textContent).not.toContain('unavailable');
    const chip = earthshakerSaveChip();
    expect(chip.className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(chip);
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(runtime.store['Behemoth 1.monsterRecharge'].Earthshaker.recharged).toBe(false));
    const spend = findLogEntry(e => e.type === 'ability_use' && String(e.abilityName || '').includes('Earthshaker'));
    expect(spend).toBeTruthy();
  });
});
