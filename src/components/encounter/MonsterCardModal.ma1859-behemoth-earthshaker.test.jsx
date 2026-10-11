// MA-1859: Behemoth "Earthshaker (Recharge 5-6)" (monsters.json actions[3]) —
// "(Recharge 5-6)" was NAME-TEXT ONLY: no `recharge` field authored, so
// rechargeUsageOf (monsterRecharge.js:35) resolved null → gate null → the DC 25
// Strength save chip re-opened a full save prompt on every same-turn press with
// zero spend, zero refusal, zero recovery die (MA-0663 dust-mephit family).
// Fix: ONE data field `recharge:"5-6"` — the flat byte-shape the LIVE gate reads
// (§252: flat recharge fields enforced — spend at fire, same-round refuse
// `.mc-recharge-refusal` + `earthshaker_refused`, d6 recovery at owner turn-start;
// MA-1164 precedent). Row has NO structured range → breathAoeShape null → the
// single-target block-save lane (rollSavingThrow) is the live press surface.
// "on the ground" clause stays §70 advisory (grounded-state grep-zero, out of scope).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monsters from '../../../public/data/monsters.json';
import { breathAoeShape } from './MonsterCardModal.jsx';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: () => <div className="sp-overlay cone-picker-stub" />,
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 55, rolls: [6, 8, 5, 9, 4, 7, 5, 3, 5, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 110, rolls: [], modifier: 0 })),
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
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 60)),
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
import {
  MONSTER_RECHARGE_KEY,
  rechargeUsageOf,
  monsterRechargeGate,
  rechargeDisplayText,
  rechargeActionKey,
} from '../../services/encounters/monsterRecharge.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const BEHEMOTH = monsters.find(m => m.name === 'Behemoth');
const ROW = BEHEMOTH.actions[3];

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
  it('actions[3] is the Earthshaker save row, byte-intact core numerics', () => {
    expect(ROW.name).toBe('Earthshaker (Recharge 5-6)');
    expect(ROW.save_dc).toBe(25);
    expect(ROW.save_type).toBe('Strength');
    expect(ROW.damage_dice_primary).toBe('10d10');
    expect(ROW.damage_type_primary).toBe('Bludgeoning');
    expect(ROW.description).toContain('each creature within 60 ft. on the ground');
  });

  it('authors recharge:"5-6" — rechargeUsageOf parses threshold 5 (was null pre-fix)', () => {
    expect(ROW.recharge).toBe('5-6');
    expect(rechargeUsageOf(ROW)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(ROW)).toBe('Earthshaker');
    expect(rechargeDisplayText(ROW)).toBe('5-6');
  });

  it('gate resolves live: fresh available at threshold 5; spent map refuses', () => {
    expect(monsterRechargeGate(ROW, null)).toEqual({ key: 'Earthshaker', threshold: 5, available: true });
    expect(monsterRechargeGate(ROW, { Earthshaker: { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(ROW, { Earthshaker: { recharged: true, threshold: 5 } }).available).toBe(true);
  });

  it('shapeless "within 60 ft." row keeps the block-save lane (no fake picker)', () => {
    expect(breathAoeShape(ROW, null)).toBeNull();
  });
});

describe('MA-1859 live click-path — spend, refuse, re-arm', () => {
  it('first press FIRES and SPENDS: block save rolls, monsterRecharge stamps recharged:false threshold:5, ability_use logged', async () => {
    renderBehemoth();
    const chip = earthshakerSaveChip();
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    // recharge-gated rows defer fire() behind the awaited spend (async lane)
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    const opts = rollSavingThrow.mock.calls[0][2];
    expect(opts.saveDc).toBe(25);
    await waitFor(() => expect(runtime.store[`Behemoth 1.${MONSTER_RECHARGE_KEY}`]).toBeTruthy());
    expect(runtime.store['Behemoth 1.monsterRecharge']).toEqual({ Earthshaker: { recharged: false, threshold: 5 } });
    const spend = findLogEntry(e => e.type === 'ability_use' && String(e.abilityName || '').includes('Earthshaker'));
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/Recharge 5-6; unavailable until a d6 5\+/);
  });

  it('SECOND same-turn press REFUSES: .mc-recharge-refusal popup + earthshaker_refused log, zero second save roll, zero extra spend', async () => {
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
    expect(refusal.description).toMatch(/Zero spend, no save prompt/);
    expect(refusal.characterName).toBe('Behemoth 1');
    const popupHtml = setPopupHtml.mock.calls.map(c => String(c[0])).find(h => h.includes('Not Recharged'));
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

describe('MA-1859 save-core half-on-save math (dc_success unauthored = half)', () => {
  it('failed save pays FULL raw roll', () => {
    expect(computeDamageAfterSave(65, false, 'half')).toBe(65);
  });
  it('successful save pays floor(raw/2)', () => {
    expect(computeDamageAfterSave(44, true, 'half')).toBe(22);
    expect(computeDamageAfterSave(57, true, 'half')).toBe(28);
  });
});
