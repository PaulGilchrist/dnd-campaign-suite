// MA-0294: recharge gate on ATTACK-roll rows — Ape Rock (Recharge 6).
// The gate/spend previously lived only in executeBlockSaveRoll; handleAttack
// now mirrors the save-path seam exactly: first click rolls the attack AND
// spends the recharge marker (same MONSTER_RECHARGE_KEY semantics), an
// immediate second click refuses with popup + rock_refused (not recharged)
// log and ZERO rollAttack calls, and the turn-start recovery roll
// (rollMonsterRecharges, MA-0031 seam) re-arms the chip for a fresh fire.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

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
  const _rollAttack = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollAttack, _setPopupHtml };
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

vi.mock('../../services/combat/rangeValidation.js', () => ({
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

function rockChip() {
  return Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith('Rock'))?.querySelector('.mc-dice-link') || null;
}

function fistChip() {
  return Array.from(document.querySelectorAll('.mc-action')).find(el => el.querySelector('strong')?.textContent.startsWith('Fist'))?.querySelector('.mc-dice-link') || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-0294 Ape Rock attack-row recharge gate', () => {
  it('first click rolls the attack and spends the recharge marker + logs ability_use', async () => {
    renderApe();
    const chip = rockChip();
    expect(chip).toBeTruthy();
    expect(chip.className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][0]).toBe('Rock (Recharge 6)');
    expect(rollAttack.mock.calls[0][1]).toBe(5);
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: false, threshold: 6 } });
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/Rock.*Recharge 6; unavailable until a d6 6\+/);
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'rock_refused')).toBeUndefined();
  });

  it('immediate second click refuses: popup + rock_refused log, zero extra rollAttack, marker stays spent', async () => {
    const { unmount } = renderApe();
    fireEvent.click(rockChip());
    await waitFor(() => expect(runtime.store['Ape 1.monsterRecharge']).toBeTruthy());
    expect(rollAttack).toHaveBeenCalledTimes(1);
    unmount();
    renderApe();
    const chip = rockChip();
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(document.body.textContent).toContain('(Recharge 6 — unavailable)');
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(String(setPopupHtml.mock.calls[setPopupHtml.mock.calls.length - 1][0])).toContain('Not Recharged');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'rock_refused')).toBe(true));
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'rock_refused');
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Ape 1');
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: false, threshold: 6 } });
  });

  it('turn-start recovery re-arms: recovery d6 below threshold keeps spent, threshold hit re-arms and the next click fires fresh', async () => {
    renderApe();
    fireEvent.click(rockChip());
    await waitFor(() => expect(runtime.store['Ape 1.monsterRecharge']).toBeTruthy());

    const miss = await rollMonsterRecharges({
      monsterName: 'Ape 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: runtime.getRuntimeValue,
        setRuntimeValue: runtime.setRuntimeValue,
        addEntry: async () => {},
        rollExpression: () => ({ total: 2 }),
      },
    });
    expect(miss.rolled).toBe(true);
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: false, threshold: 6 } });
    fireEvent.click(rockChip());
    expect(rollAttack).toHaveBeenCalledTimes(1);

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
    expect(hit.outcomes).toEqual([{ key: 'Rock', rolled: 6, recharged: true }]);
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: true, threshold: 6 } });

    fireEvent.click(rockChip());
    expect(rollAttack).toHaveBeenCalledTimes(2);
    expect(runtime.store['Ape 1.monsterRecharge']).toEqual({ Rock: { recharged: false, threshold: 6 } });
  });

  it('non-recharge sibling (Fist) stays ungated and byte-unchanged', async () => {
    renderApe();
    fireEvent.click(rockChip());
    await waitFor(() => expect(runtime.store['Ape 1.monsterRecharge']).toBeTruthy());
    const fist = fistChip();
    expect(fist.className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(fist);
    expect(rollAttack).toHaveBeenCalledTimes(2);
    expect(rollAttack.mock.calls[1][0]).toBe('Fist');
  });
});
