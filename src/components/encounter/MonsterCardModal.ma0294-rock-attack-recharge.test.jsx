// @maintained-by-ai
// MA-0294: recharge gate on ATTACK-roll rows — Ape Rock (Recharge 6).
// This lane owns ONLY the handleAttack press seam (the fix commit e8b221e55:
// the gate/spend previously lived only in executeBlockSaveRoll). Press legs,
// once per branch, single mount: available press fires the attack AND spends
// the MONSTER_RECHARGE_KEY marker (byte); spent press refuses with popup +
// rock_refused log and zero extra rollAttack; an ungated sibling (Fist) stays
// inert to the gate. Recovery-rearm leg: rollMonsterRecharges at d6-threshold
// re-opens the gate so the next press fires fresh and re-spends.
// Owned elsewhere, never restated: recharge economy internals
// (monsterRecharge.test.js), spent-chip class + "(Recharge 6 — unavailable)"
// render template (MonsterAction.ma1014-ice-wall-chip / recharge-cone),
// generic attack-chip press transport (MonsterCardModal.scorching-ray).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollAttack = vi.fn();
  const _setPopupHtml = vi.fn();
  const mockHook = vi.fn(() => ({ popupHtml: null, setPopupHtml: _setPopupHtml, rollAttack: _rollAttack }));
  return { default: mockHook, _rollAttack, _setPopupHtml };
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
import { rollMonsterRecharges } from '../../services/encounters/monsterRecharge.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Ape 1', type: 'npc', monsterType: 'beast', targetName: 'ElderPaladin', currentHp: 59, maxHp: 59, ac: 12, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, ac: 19, conditions: [] },
];

function apeActions() {
  return monstersData.find(m => m.index === 'ape').actions;
}

function renderApe() {
  const m = makeMonster({ name: 'Ape', actions: apeActions() });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ape 1', creatures: CREATURES })} />);
}

function chipFor(actionName) {
  return Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith(actionName))?.querySelector('.mc-dice-link') || null;
}

function rockChip() { return chipFor('Rock'); }
function fistChip() { return chipFor('Fist'); }

function logsWhere(pred) {
  return addEntry.mock.calls.map(c => c[1]).find(pred);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-0294 Ape Rock attack-row recharge gate', () => {
  it('expend→refuse: fresh press rolls +5 attack, spends the marker + logs ability_use; spent press refuses popup/log, zero extra roll; ungated Fist still fires', async () => {
    renderApe();
    const rock = rockChip();
    expect(rock).toBeTruthy();
    expect(rock.className).not.toContain('mc-dice-link-spell-spent');

    fireEvent.click(rock);
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][0]).toBe('Rock (Recharge 6)');
    expect(rollAttack.mock.calls[0][1]).toBe(5);
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: false, threshold: 6 } });
    await waitFor(() => expect(logsWhere(e => e.type === 'ability_use')).toBeTruthy());
    expect(logsWhere(e => e.type === 'ability_use').description).toMatch(/Rock.*Recharge 6; unavailable until a d6 6\+/);
    expect(logsWhere(e => e.automationType === 'rock_refused')).toBeUndefined();

    fireEvent.click(rock);
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(String(setPopupHtml.mock.calls[setPopupHtml.mock.calls.length - 1][0])).toContain('Not Recharged');
    await waitFor(() => expect(logsWhere(e => e.automationType === 'rock_refused')).toBeTruthy());
    const refusal = logsWhere(e => e.automationType === 'rock_refused');
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Ape 1');
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: false, threshold: 6 } });

    fireEvent.click(fistChip());
    expect(rollAttack).toHaveBeenCalledTimes(2);
    expect(rollAttack.mock.calls[1][0]).toBe('Fist');
  });

  it('recovery-rearm: d6 threshold hit re-arms the gate, next press fires fresh and re-spends', async () => {
    renderApe();
    fireEvent.click(rockChip());
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: false, threshold: 6 } });

    const hit = await rollMonsterRecharges({
      monsterName: 'Ape 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: runtime.getRuntimeValue,
        setRuntimeValue: runtime.setRuntimeValue,
        addEntry: async () => {},
        rollExpression: () => ({ total: 6 }),
      },
    });
    expect(hit).toEqual({ rolled: true, outcomes: [{ key: 'Rock', rolled: 6, recharged: true }] });
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: true, threshold: 6 } });

    fireEvent.click(rockChip());
    expect(rollAttack).toHaveBeenCalledTimes(2);
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: false, threshold: 6 } });
  });
});
