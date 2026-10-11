// MA-1881 regression: Demogorgon legendary_actions[1] "Gaze"
// (`delegates_to:"Gaze"`) inherited the MA-1878 dead lane — the chip press
// spent honestly, opened a plain (fake 60-ft Line) save picker, offered ZERO
// chooser arms, rolled ZERO d6 branch, and applied the master's FIRST clause
// with zero condition/te grant. Fix: legendaryDelegateChooserAction
// (MonsterCardModal) copies the parent's variants[] + save fields onto the
// child BEFORE the first-clause shortcut, so the legendary panel reaches the
// SAME MA-1436/MA-1878 chooser seam (tryOpenVariantChoosers →
// SaveVariantChooserModal) as the parent row. Chip press now: gate → spend →
// chooser (Beguiling / Confusing / Hypnotic arms) → pick → inline WIS DC 23
// save with the picked variant stamped on the save context (te→targetEffects
// consumer grantSaveVariantClause, MA-1878, rides downstream).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const r = { rollAttack: null, rollDamage: null, rollSavingThrow: null };
  return r;
});
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
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 120),
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

const CREATURES = [
  { name: 'Demogorgon 1', type: 'npc', monsterType: 'aberration', targetName: 'Bandit 1', currentHp: 464, maxHp: 464, ac: 22, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const demogorgon = () => monstersData.find(m => m.index === 'demogorgon');
const laRow = (name) => Array.from(document.querySelectorAll('.mc-action'))
  .find(r => (r.querySelector('strong')?.textContent || '').startsWith(name) && r.querySelector('.mc-dice-link-legendary'));

describe('MA-1881 Demogorgon legendary Gaze — chooser reachable from the legendary panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });
  afterEach(() => { vi.restoreAllMocks(); });

  function renderDemo(uses) {
    runtime.store['Demogorgon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Demogorgon',
      actions: demogorgon().actions,
      legendary_actions: demogorgon().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Demogorgon 1', creatures: CREATURES })} />);
  }

  it('chip press spends ONE use, opens the parent chooser with all 3 arms, and rolls NO save before the pick', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(document.querySelector('.mc-overlay--save-variant')).not.toBe(null));
    const arms = Array.from(document.querySelectorAll('.mc-overlay--save-variant .save-variant-row'));
    expect(arms.map(a => a.querySelector('strong')?.textContent)).toEqual([
      'Beguiling Gaze (1-2)', 'Confusing Gaze (3-4)', 'Hypnotic Gaze (5-6)',
    ]);
    // Zero save rolled, zero fake-Line picker, economy honest.
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(document.querySelector('.mc-overlay--cone')).toBe(null);
    expect(runtime.store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /expends a legendary use for Gaze/.test(e.description));
    expect(spend).toBeTruthy();
  });

  it('pick Beguiling → inline WIS DC 23 save with the variant stamped (stunned arm, dc_success none, no damage)', async () => {
    renderDemo({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(document.querySelector('.mc-overlay--save-variant')).not.toBe(null));
    fireEvent.click(document.querySelectorAll('.mc-overlay--save-variant .save-variant-row')[0]);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const saveCtx = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(saveCtx.saveDc).toBe(23);
    expect(saveCtx.saveType).toBe('Wisdom');
    expect(saveCtx.dcSuccess).toBe('none');
    expect(saveCtx.saveVariant).toMatchObject({ key: 'beguiling', conditions: ['stunned'], rounds: 2 });
    expect(saveCtx.targetName).toBe('Bandit 1');
    expect(saveCtx.attackerName).toBe('Demogorgon 1');
    const selected = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'save_variant_selected');
    expect(selected).toBeTruthy();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
  });

  it('pick Confusing → the te arm rides the save context (confusion te, MA-1878 consumer downstream)', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(document.querySelector('.mc-overlay--save-variant')).not.toBe(null));
    fireEvent.click(document.querySelectorAll('.mc-overlay--save-variant .save-variant-row')[1]);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const saveCtx = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(saveCtx.saveVariant).toMatchObject({ key: 'confusing', te: 'confusion', rounds: 2 });
    expect(saveCtx.saveVariant.conditions).toEqual([]);
  });

  it('skip arm ("Use without variant") logs the decline and rolls NO save (never prompts an effect-less save)', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(document.querySelector('.mc-overlay--save-variant')).not.toBe(null));
    fireEvent.click(document.querySelector('.mc-overlay--save-variant .sp-dismiss-btn'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'save_variant_declined')).toBe(true));
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('same-boundary refire refuses on the turn latch — chooser never reopens, zero extra spend', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(document.querySelector('.mc-overlay--save-variant')).not.toBe(null));
    fireEvent.click(document.querySelectorAll('.mc-overlay--save-variant .save-variant-row')[0]);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    setPopupHtml.mockClear();
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(document.querySelectorAll('.mc-overlay--save-variant').length).toBe(0);
    expect(runtime.store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  it('exhausted (2/2): press refuses with popup + legendary_use_refused, zero chooser, zero roll', async () => {
    renderDemo({ max: 2, used: 2 });
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(document.querySelector('.mc-overlay--save-variant')).toBe(null);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
  });
});
