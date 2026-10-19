// @maintained-by-ai
// MA-1881 RENDER lane: Demogorgon legendary "Gaze" (`delegates_to:"Gaze"`) —
// the chip press used to ride the MA-1878 dead lane (fake 60-ft Line picker,
// ZERO chooser arms, first-clause collapse with zero condition/te grant).
// Fix: legendaryDelegateChooserAction copies the parent's variants[] + save
// fields onto the child BEFORE the first-clause shortcut, so the legendary
// panel reaches the SAME chooser seam (tryOpenVariantChoosers →
// SaveVariantChooserModal) as the parent row. Owned flow faces pinned here:
// gate → spend → chooser arms → pick → save-context stamp → skip → latch →
// exhausted, one press per distinct arm payload shape (beguiling =
// conditions[], confusing = te-only; hypnotic shares the conditions[] shape —
// its bytes are pinned by the inherit lane below).
// CITED, not re-pinned here:
// - inherit contract (child.variants inherit, passthrough, chooser resolve):
//   MonsterCardModal.ma1881-demogorgon-legendary-gaze-inherit.test.js (#743)
// - master Gaze parse + data lock: MonsterCardHelpers.save-variant-chooser
//   .test.js + saveProcessing.ma1878-demogorgon-gaze.test.js
// - fake-Line pure-parse face: MonsterCardModal.save-variant-shape.test.jsx:37-42
// - generic exhausted popup / turn-latch economy (shared gate
//   monsterLegendaryUses.js): MonsterCardModal.legendary-uses.test.jsx:195-212, :309-316
// - multi-spend Cast-a-Spell lane: monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js:136-210
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

// Mock hygiene (#739/#740 baseline): every mock bisected — diceRoller,
// sanitize, dataLoader, mapsService, rangeValidation and damageUtils mocks
// dropped (deletion stays green; all dice flow through the mocked hook and
// the real helper modules run offline). The three mocks kept are load-
// bearing: rolls/popup capture (asserted), log capture (asserted), runtime
// store (economy seeding + asserted).
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
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
const chooseArms = () => Array.from(document.querySelectorAll('.mc-overlay--save-variant .save-variant-row'));
const legendarySpendLogs = () => addEntry.mock.calls
  .map(c => c[1]).filter(e => e.type === 'ability_use' && /expends a legendary use for Gaze/.test(e.description));

describe('MA-1881 Demogorgon legendary Gaze — chooser reachable from the legendary panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
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
    // Pre-fix fingerprint: fake Line picker instead of chooser arms.
    expect(document.querySelector('.mc-overlay--cone')).toBe(null);
    expect(chooseArms().map(a => a.querySelector('strong')?.textContent)).toEqual([
      'Beguiling Gaze (1-2)', 'Confusing Gaze (3-4)', 'Hypnotic Gaze (5-6)',
    ]);
    // Economy honest: exactly one spend, nothing rolled before the pick.
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    expect(legendarySpendLogs()).toHaveLength(1);
  });

  it('pick Beguiling → inline WIS DC 23 save with the variant stamped (stunned arm, dc_success none, no damage)', async () => {
    renderDemo({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(document.querySelector('.mc-overlay--save-variant')).not.toBe(null));
    fireEvent.click(chooseArms()[0]);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const saveCtx = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(saveCtx.saveDc).toBe(23);
    expect(saveCtx.saveType).toBe('Wisdom');
    expect(saveCtx.dcSuccess).toBe('none');
    expect(saveCtx.saveVariant).toMatchObject({ key: 'beguiling', conditions: ['stunned'], rounds: 2 });
    expect(saveCtx.targetName).toBe('Bandit 1');
    expect(saveCtx.attackerName).toBe('Demogorgon 1');
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'save_variant_selected')).toBe(true);
    // MA-1878 dead-lane fingerprint must not reappear on this seam.
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
  });

  it('pick Confusing → the te-only arm shape rides the save context (confusion te, MA-1878 consumer downstream)', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(document.querySelector('.mc-overlay--save-variant')).not.toBe(null));
    fireEvent.click(chooseArms()[1]);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1));
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

  it('same-boundary refire refuses on the turn latch — chooser never reopens, zero extra spend, no second save', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(document.querySelector('.mc-overlay--save-variant')).not.toBe(null));
    fireEvent.click(chooseArms()[0]);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    setPopupHtml.mockClear();
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    // Latch-specific wording distinguishes this refusal from exhausted.
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(document.querySelectorAll('.mc-overlay--save-variant').length).toBe(0);
    expect(runtime.store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  // Refused-press popup wording + legendary_use_refused log byte: canonical
  // in legendary-uses.test.jsx:195-212 (shared monsterLegendaryUses.js gate).
  // This leg pins only the chooser-lane ordering fingerprint: the gate runs
  // BEFORE the chooser seam, so an exhausted press never opens a picker.
  it('exhausted (2/2): press refuses before the chooser — picker never opens, zero spend, zero roll', async () => {
    renderDemo({ max: 2, used: 2 });
    fireEvent.click(laRow('Gaze').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(document.querySelector('.mc-overlay--save-variant')).toBe(null);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(legendarySpendLogs()).toHaveLength(0);
    expect(runtime.store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
  });
});
