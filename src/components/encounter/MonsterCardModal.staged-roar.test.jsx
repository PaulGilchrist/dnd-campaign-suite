// @maintained-by-ai
// MA-0268 regression: Androsphinx Roar INLINE click lane in MonsterCardModal.
// The disk row (live bytes via roarRow()) is staged_roar:true, maxUses:3,
// WIS DC 18, shapeless (no area field) — click N arms ONLY stage N's canonical
// legs straight through rollSavingThrow (pre-fix every click was the conflated
// union: 8d10 thunder + Deafened/Frightened/Prone on all three roars,
// dc_success half on the damage-free roars, inert usage gate). Stage legs are
// hardcoded ROAR_STAGES bytes (this row carries NO roar_stages key).
// Owned elsewhere, not re-pinned here: stage leg table bytes + exhausted→null
// (roarService.test.js:107-191); picker-lane threading for row-authored
// roar_stages rows (MonsterCardModal.ma1502-staged-roar.test.jsx); refusal
// popup builder bytes (monsterAbilityUses.js:48, pinned in its own suite);
// inline spend-at-confirm (saveProcessing MA-0020 lane — the inline save never
// spends inside the modal, so per-stage fixtures seed the persisted counter).
// Unique here: the full 45-key save ctx locked exact per stage — only the
// stage's own legs arm live; every unrelated rider rides an honest null.
// Note the dc_success canary: stage 3's 'half' is stage-table-armed (the
// disk row itself authors NO dc_success key); stages 1-2 print honest
// "none" (zero-damage legs). The chip face is row-level (always "DC 18
// Wisdom"); only the (N left) counter moves with the spend.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
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

const CREATURES = [
  { name: 'Androsphinx 1', type: 'npc', monsterType: 'monstrosity', targetName: 'TestPC', currentHp: 199, maxHp: 199, ac: 17, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

// Every rider the roar row must NOT arm — one shared honest-null block so
// each stage's ctx locks exact-key-set: a new live rider here is a loud,
// single-place diff.
const INERT_RIDERS = {
  spellName: null,
  autoDamageSecondaryFormula: null,
  autoDamageSecondaryName: null,
  autoDamageSecondaryDamageType: null,
  saveVariant: null,
  _characters: [],
  isSpellDamage: false,
  consumeMemoriesClause: false,
  conditionDurationNote: null,
  successImmunity: null,
  stagedPetrify: null,
  concentrationDisadvantage: null,
  speedHalf: null,
  subtractDebuff: null,
  demiplaneTransport: null,
  dreamPlaneBanishment: null,
  acPenaltyClause: null,
  speedZeroClause: null,
  slowedClauses: null,
  tempHpGrant: null,
  exhaustionLevel: null,
  animalSpiritVariant: null,
  animalSpiritFortifyHp: null,
  hpThresholdKill: null,
  infernalWound: null,
  saveMargin: null,
  saveHpMaxReduce: null,
  saveAttackerRecover: null,
  saveTargetEffect: null,
  saveRiderAttackDamage: null,
  eyeRay: null,
};

function renderAndrosphinx(spent) {
  if (spent) runtime.store['Androsphinx 1.monsterSpellUses'] = { Roar: spent };
  const roar = monstersData.find(m => m.index === 'androsphinx').actions.find(a => a.name === 'Roar');
  const m = makeMonster({ name: 'Androsphinx', type: 'monstrosity', actions: [roar] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Androsphinx 1', creatures: CREATURES })} />);
  const chips = Array.from(document.querySelectorAll('.mc-dice-link-save-clickable'));
  expect(chips.length).toBe(1); // single-action monster — the Roar chip is the only save affordance
  return chips[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-0268 staged roar inline click lane', () => {
  it.each([
    { spent: 0, abbr: 'WIS', saveType: 'Wisdom', dcSuccess: 'none', formula: null, damageType: null, saveConditions: ['frightened'], repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 } },
    { spent: 1, abbr: 'WIS', saveType: 'Wisdom', dcSuccess: 'none', formula: null, damageType: null, saveConditions: ['deafened', 'frightened'], repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 } },
    { spent: 2, abbr: 'CON', saveType: 'Constitution', dcSuccess: 'half', formula: '8d10', damageType: 'Thunder', saveConditions: ['prone'], repeatSave: null },
  ])('click with $spent spent arms ONLY stage $spent: $abbr DC 18, damage $formula, $saveConditions, repeatSave $repeatSave — ctx exact-key-set', ({ spent, abbr, saveType, dcSuccess, formula, damageType, saveConditions, repeatSave }) => {
    const chip = renderAndrosphinx(spent);
    expect(chip.textContent).toContain(`(3/Day · ${3 - spent} left)`);
    fireEvent.click(chip);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const [saveAbbr, saveMod, ctx] = rollSavingThrow.mock.calls[0];
    const label = `Roar ${spent + 1} of 3`;
    expect(saveAbbr).toBe(abbr);
    expect(saveMod).toBe(0); // TestPC carries no computedStats — honest zero modifier
    expect(ctx).toEqual({
      attackerName: 'Androsphinx 1',
      targetName: 'TestPC',
      actionName: label,
      saveDc: 18,
      saveType,
      dcSuccess,
      autoDamageFormula: formula,
      autoDamageDamageType: damageType,
      autoDamageName: label,
      saveConditions,
      monsterAbilityUse: { useKey: 'Roar', maxUses: 3, actionName: label },
      repeatSave,
      ...INERT_RIDERS,
    });
  });

  it('4th click (3 spent): gate refuses — zero prompts, Uses Exhausted popup, exact roar_refused log', async () => {
    const chip = renderAndrosphinx(3);
    expect(chip.textContent).toContain('(3/Day · 0 left)');
    fireEvent.click(chip);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('<h3>Uses Exhausted</h3>');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Androsphinx 1 has already used Roar today (3/Day). No save rolled, nothing spent.');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'automation',
      automationType: 'roar_refused',
      characterName: 'Androsphinx 1',
      abilityName: 'Roar',
      description: 'Androsphinx 1 has already used Roar today (3/Day) — Roar refused. Uses reset at dawn; GM-enforced for monsters.',
      timestamp: expect.any(Number),
    });
  });
});
