// MA-0039 regression: Adult Black Dragon Frightful Presence legendary row.
// DATA fix (monsters.json): FP gains save_dc 17 / save_type Wisdom /
// save_effect frightened — the row rides the landed seams: MA-0021 gated
// legendary spend (round+turn latch = once-per-turn gate), MA-0035 DC-chip
// affordance, MA-0017 damageless failed-save condition application
// (saveProcessing.applyDamagelessSaveConditions), MA-0019 condition
// provenance. 60-ft multi-target selection stays advisory (MV-21 model).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
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
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const ABD = monstersData.find(m => m.name === 'Adult Black Dragon');
const FP = ABD.legendary_actions.find(a => a.name === 'Frightful Presence');

const CREATURES = [
  { name: 'Adult Black Dragon 1', type: 'npc', targetName: 'TestPC', currentHp: 195, maxHp: 195, ac: 19, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function renderDragon(uses) {
  if (uses !== undefined) runtime.store['Adult Black Dragon 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({ ...ABD, name: 'Adult Black Dragon' });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Black Dragon 1', creatures: CREATURES })} />);
}

function fpSaveChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.closest('div')?.textContent.includes('Frightful Presence')) || null;
}

describe('MA-0039 monsters.json data: ABD Frightful Presence legendary row structured', () => {
  it('authors save_dc 17 (8+PB5+CHA4) Wisdom + frightened save_effect', () => {
    expect(FP.save_dc).toBe(17);
    expect(FP.save_type).toBe('Wisdom');
    expect(extractConditionsFromSaveEffect(FP.save_effect)).toEqual(['frightened']);
  });
});

describe('MA-0039 MonsterCardModal Frightful Presence legendary resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  it('row renders clickable DC 17 Wisdom affordance', () => {
    renderDragon({ max: 3, used: 0 });
    const chip = fpSaveChip();
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('DC 17 Wisdom');
  });

  it('click expends 1 legendary use and opens WIS save at DC 17 with frightened context, no damage', async () => {
    renderDragon({ max: 3, used: 0 });
    fireEvent.click(fpSaveChip());
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(runtime.store['Adult Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(String(call[0]).toLowerCase()).toBe('wis');
    expect(call[2]).toMatchObject({
      saveDc: 17,
      saveType: 'Wisdom',
      saveConditions: ['frightened'],
      autoDamageFormula: null,
      attackerName: 'Adult Black Dragon 1',
      actionName: 'Frightful Presence',
    });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Frightful Presence/.test(e.description));
    expect(spend).toBeTruthy();
  });

  it('once-per-turn gate: second same-turn click refused (turn latch), zero extra spend, no second save prompt', async () => {
    renderDragon({ max: 3, used: 0 });
    fireEvent.click(fpSaveChip());
    await waitFor(() => expect(runtime.store['Adult Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Black Dragon 1._legendaryUses_usedRound']).toEqual({ round: 1, activeCreature: 'Thug 1' });
    fireEvent.click(fpSaveChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  it('exhausted: refusal popup + log, zero spend, no save prompt', async () => {
    renderDragon({ max: 3, used: 3 });
    fireEvent.click(fpSaveChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    expect(runtime.store['Adult Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
