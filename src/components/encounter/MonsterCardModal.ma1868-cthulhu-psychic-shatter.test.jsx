// MA-1868: Cthulhu "Psychic Shatter" once-per-turn gate on the REGULAR
// save-chip lane. The row (actions[3], numeric save_dc → ActionSaveRoll chip
// "DC 24 Intelligence") resolves through handleSaveRoll and NEVER reaches
// expendLegendaryUse, so the MA-0073 cooldown never armed — pre-fix the chip
// re-fired unlimited times per turn (live: 2/2 fires, 0 refused). Fix = DATA
// `once_per_turn: true` + oncePerTurnActionGate in handleSaveRoll reusing the
// MA-0073 latch vocabulary: same-turn second press REFUSES (popup +
// `psychic_shatter_refused (once per turn)` log, zero second save/damage/
// condition), and the monster's OWN turn-start (regainLegendaryUses :361
// clear, legendary-state-independent) clears the latch → next-turn refire
// ALLOWED. Harness mirrors MonsterCardModal.legendary-uses.test.jsx
// deps-shape (§385); save/damage core was verified byte-exact separately —
// this file locks ONLY the gate axis.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { regainLegendaryUses, MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null,
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    setRuntimeObject: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  setRuntimeObject: runtime.setRuntimeObject,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CTHULHU = monstersData.find((m) => m.index === 'cthulhu');
const SHATTER = CTHULHU.actions[3];
const CAMPAIGN = 'test-campaign';
const MONSTER = 'Cthulhu 1';
const VICTIM = 'Bandit 1';

const CREATURES = [
  { name: MONSTER, type: 'npc', targetName: VICTIM, currentHp: 540, maxHp: 540, ac: 22, conditions: [] },
  { name: VICTIM, type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [], ability_score_modifiers: { int: -2 } },
];

function renderCthulhu() {
  render(<MonsterCardModal {...makeProps(makeMonster({ ...CTHULHU }), { creatureName: MONSTER, creatures: CREATURES })} />);
}

function shatterChip() {
  const row = [...document.querySelectorAll('.mc-action')].find((r) => {
    const s = r.querySelector('strong');
    return s && s.textContent.trim().startsWith('Psychic Shatter');
  });
  return row ? row.querySelector('.mc-dice-link-save-clickable') : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtime.store)) delete runtime.store[k];
  ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: [] };
});

describe('MA-1868 disk fingerprint', () => {
  it('cthulhu.actions[3] Psychic Shatter: once_per_turn:true + exact save/damage core', () => {
    expect(SHATTER.name).toBe('Psychic Shatter');
    expect(SHATTER.once_per_turn).toBe(true);
    expect(SHATTER.save_dc).toBe(24);
    expect(SHATTER.save_type).toBe('Intelligence');
    expect(SHATTER.damage_dice_primary).toBe('6d10');
    expect(SHATTER.damage_type_primary).toBe('Psychic');
    expect(SHATTER.conditions).toEqual(['stunned']);
  });

  it('the row is a REGULAR action row — NOT legendary, NO recharge/uses lane fields', () => {
    expect(CTHULHU.actions[3]).toBe(SHATTER);
    expect(CTHULHU.legendary_actions.some((a) => a.name === 'Psychic Shatter')).toBe(false);
    expect(SHATTER.recharge).toBeUndefined();
    expect(SHATTER.uses).toBeUndefined();
    expect(SHATTER.maxUses).toBeUndefined();
  });
});

describe('MA-1868 once-per-turn gate on the regular save-chip lane', () => {
  it('first press resolves (rolls the DC 24 INT save) and stamps the cooldown; second press SAME turn REFUSES — zero second save roll, MA-0073 refusal vocabulary', async () => {
    renderCthulhu();
    const chip = shatterChip();
    expect(chip).not.toBeNull();
    expect(chip.textContent.trim()).toBe('DC 24 Intelligence');

    fireEvent.click(chip);
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('INT');
    expect(ROLLERS.rollSavingThrow.mock.calls[0][2]).toMatchObject({ saveDc: 24, saveType: 'Intelligence', dcSuccess: 'half' });
    await waitFor(() => expect(runtime.store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toMatchObject({ psychic_shatter: { round: 1 } }));

    // SECOND press, same turn — refused before any roll.
    ROLLERS.rollSavingThrow.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(chip);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/can't take Psychic Shatter again until the start of its next turn/);
    await waitFor(() => expect(addEntry.mock.calls.map((c) => c[1]).some((e) => e.automationType === 'psychic_shatter_refused (once per turn)')).toBe(true));
    // refusal is zero-spend/zero-roll: no save prompt threaded, latch untouched
    expect(runtime.store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toMatchObject({ psychic_shatter: { round: 1 } });
  });

  it('monster OWN turn-start (regainLegendaryUses clears the latch, no uses needed) → next-turn refire ALLOWED', async () => {
    renderCthulhu();
    const chip = shatterChip();

    // fire + refusal (same turn) as above
    fireEvent.click(chip);
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(runtime.store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toMatchObject({ psychic_shatter: { round: 1 } }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map((c) => c[1]).some((e) => e.automationType === 'psychic_shatter_refused (once per turn)')).toBe(true));
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);

    // Cthulhu's own turn-start: the EXISTING MA-0073 clear runs for regular
    // monsters too (regained:false — no uses economy — but the latch key clears)
    ctx.value = { round: 2, activeCreatureName: MONSTER, creatures: CREATURES };
    const regain = await regainLegendaryUses({ monsterName: MONSTER, campaignName: CAMPAIGN });
    expect(regain).toEqual({ regained: false });
    expect(runtime.store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toBeNull();

    // next turn — chip re-fires honestly (fresh save roll + fresh stamp)
    ctx.value = { round: 2, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    ROLLERS.rollSavingThrow.mockClear();
    fireEvent.click(chip);
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(runtime.store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toMatchObject({ psychic_shatter: { round: 2 } }));
  });

  it('rows without once_per_turn stay byte-inert on the same card (Claw attack chip unaffected)', async () => {
    renderCthulhu();
    const clawChip = [...document.querySelectorAll('.mc-dice-link')].filter((el) => {
      const row = el.closest('.mc-action');
      const s = row?.querySelector('strong');
      return s && s.textContent.trim().startsWith('Claw') && el.classList.contains('mc-dice-link');
    })[0];
    expect(clawChip).toBeTruthy();
    fireEvent.click(clawChip);
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(1);
    expect(runtime.store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toBeUndefined();
    // re-press allowed — ungated rows never gain a cooldown stamp
    fireEvent.click(clawChip);
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(2);
    expect(runtime.store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toBeUndefined();
  });
});
