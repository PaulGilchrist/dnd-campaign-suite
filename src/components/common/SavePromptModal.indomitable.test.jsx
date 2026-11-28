// @maintained-by-ai 2026-11-27 — CLA-195 Indomitable reroll lane: cap ladder bracketed at every tier, bonus-only-reachable reroll dice, exact visible total/breakdown pins, mock keys mirrored to #1935-#1942, phantoms purged
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

// CLA-195 lane: the Fighter "Indomitable" save-REROLL button at the save-prompt
// seam — availability (feature row present, uses below the level-scaled
// long-rest cap, exactly one reroll per failed save), the +fighter-level label
// produced by the REAL fighter_level expression, and the reroll's projections
// (die spent, exactly one use consumed, auto-submitted result carries the
// bonus). This modal has NO Indomitable MIGHT logic — the Barbarian min-10
// floor lives in useLoggedDiceRollAttack/DiceRollResult and its display face
// is pinned in DiceRollResult.infoDisplay.test.jsx (#1899). Nothing here
// restates those bytes.
//
// Owned HERE (visible faces exact-pin .sp-result-total strong and
// .sp-result-breakdown, so a dropped +level bonus changes on-screen bytes,
// not just a call count — #1936 idiom):
// - Positive flow: reroll die chosen so success is ONLY reachable with the
//   +level bonus (2 + 5 = 7 fails DC 13; 2 + 5 + 18 = 25 passes) — a mutant
//   that forgets extraBonus flips the caption too. Two dice total, exactly one
//   4-arg indomitableUses write, auto-submit exactly once (rerolls auto-submit;
//   the ordinary hold-until-Done flow is .actions' face).
// - Cap ladder BRACKETED at every tier: lv9 (1 use), lv13 (2), lv17 (3) —
//   each tier shown JUST BELOW cap (the shown legs also pin the +level label
//   scaling) and hidden AT cap with zero consumption writes and zero
//   submissions.
// - Feature-absent negative (no reroll saveModifiers row).
// - Once-per-failed-save guard: a failed reroll stays failed (1 − 8 + 18 = 11
//   < DC 13) and the button must NOT reappear while the uses read (0) is still
//   below the cap — so the hiding proves the rerollUsedForSave gate, not the
//   cap.
//
// Owned ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement, Apply(0)
//   presentation gate ................................. .actions.test.jsx (#1935)
// - 5e Dodge arithmetic, CLA-324 against_spell + lastAttack,
//   bane/bless/warding-bond bonus-string arithmetic .... .bonuses.test.jsx (#1936)
// - saveConditions / mod.condition legs ............... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ..... .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, confirm-closes-leaves-PENDING,
//   clear/dismiss advancement ......................... .coverage.test.jsx (#1939)
// - 2024 Dodge ruleset gate (BA-001) .................. .dodge-2024.test.jsx (#1940)
// - Beacon WIS gate, Cosmic Omen consume, charmed/Otto DEX disadvantage .... .evasion-effects.test.jsx (#1941)
// - holy_aura te grant + ALL-saves contrast ........... .holy-aura.test.jsx (#1942)
// - concentration offset-cancel (ConcentrationPromptModal.holy-aura.test.jsx, #1896)
// - DC-boundary/min-math ..... .rolling.test.jsx
// - Fanatical Focus / Disciplined Survivor / Guarded Mind / Living Legend
//   reroll lanes ...................................... .rerolls.test.jsx
// - Handler contract: createIndomitableHandler payload threading through the
//   pipeline, campaign logging, unavailable/at-max/no-prompt guards
//   .................................................. savePromptHandlers.indomitable.test.js

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: (name) => name || 'Unknown' },
}));

// importOriginal spread is REQUIRED here (unlike most sibling lanes): the
// label runs the REAL evaluateAutoExpression('fighter_level'), and
// automationExpressions.js imports canRollExpression/rollExpressionMaximized
// from this module — a bare two-key factory would crash the live selector.
vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rollD20: vi.fn(), rollExpression: vi.fn() };
});

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock even though this lane never sends (#1935-#1942 pattern).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// Flat save bonus for every character; legs that need a different value
// re-baseline it in beforeEach (clearAllMocks keeps mockReturnValue).
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 5),
}));

// Graph keys mirrored to the seven sibling lanes (#1935-#1941): no
// useSyncedState/listeners phantoms — this modal never imports them.
// deleteRuntimeKey/setRuntimeObject/getAllStoreKeys back real graph imports
// (savePrompt.js, evasionUtils.js, store probes).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getStore: vi.fn(() => new Map()),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  deleteRuntimeKey: vi.fn(),
  setRuntimeObject: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

// Only the one trigger this lane exercises: WIS save DC 13.
vi.mock('./Subscriber.jsx', () => {
  const wisPrompt = {
    promptId: 'test-prompt-wis',
    targetName: 'testTarget',
    saveType: 'WIS',
    saveDc: 13,
    disadvantage: false,
  };
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement('div', {
      'data-testid': 'subscriber',
      'data-campaign': campaignName,
    }, React.createElement('button', {
      'data-testid': 'subscriber-trigger-wis',
      onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-${wisPrompt.targetName}`, data: wisPrompt }),
    }));
  }
  return { default: MockSubscriber };
});

// ── Fixtures ──

// Registry-true row: automationModifiers.js auto_reroll builder output for the
// Fighter "Indomitable" feature (classes.json automation type auto_reroll,
// bonusExpression fighter_level).
const indomitableModifier = {
  source: 'Indomitable',
  target: 'saving_throw',
  condition: '',
  effect: 'reroll',
  bonusExpression: 'fighter_level',
  oncePerRage: false,
};

function createFighter(level, { withIndomitable = true } = {}) {
  const saveModifiers = withIndomitable ? [indomitableModifier] : [];
  return {
    name: 'testTarget',
    level,
    class: { name: 'Fighter', class_levels: [] },
    computedStats: {
      level,
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      evasionEffects: [],
      automation: { passives: [] },
      saveModifiers,
    },
    saveModifiers,
  };
}

// Seeds every runtime read the modal performs during a failed save so no
// unrelated reroll (rage, focus, legendary, guarded mind) leaks into scope —
// the ONLY reroll button that can appear is Indomitable's.
function mockRuntime({ uses = 0 } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeBuffs') return [];
    if (key === 'activeConditions') return [];
    if (key === 'fanaticalFocusUsed') return false;
    if (key === 'indomitableUses') return uses;
    return null;
  });
}

function indomitableUseWrites() {
  return setRuntimeValue.mock.calls.filter(([, key]) => key === 'indomitableUses');
}

const visibleTotal = () => document.querySelector('.sp-result-total strong').textContent;
const visibleBreakdown = () => document.querySelector('.sp-result-breakdown').textContent;

/**
 * Render the fighter, open the WIS DC-13 prompt, roll every die a 1, and flush
 * on the exact 'SAVE FAILURE' caption. With the mocked +5 save bonus the
 * failure total is 1 + 5 = 6. The reroll die can be steered afterwards via
 * rollD20.mockReturnValue(...) before clicking the button.
 */
async function openFailedSave(character, uses) {
  mockRuntime({ uses });
  rollD20.mockReturnValue(1);
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={[character]}
      activeMapName={null}
    />
  );
  fireEvent.click(screen.getByTestId('subscriber-trigger-wis'));
  await screen.findByTestId('active-save-prompt');
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await screen.findByText('SAVE FAILURE');
}

describe('SavePromptModal — Indomitable reroll (CLA-195)', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // Re-baseline EVERY override (clearAllMocks keeps mockReturnValue): the
    // cursed-save test below switches this to -8.
    getAbilitySaveBonus.mockReturnValue(5);
  });
  afterEach(cleanupDefaults);

  it('offers Indomitable (+18) on a failed save, rerolls it to a success only the bonus can reach, and spends exactly one use', async () => {
    await openFailedSave(createFighter(18), 0);

    // Pre-reroll face: the +18 is NOT folded until the button is clicked.
    expect(visibleTotal()).toBe('6'); // 1 + 5
    expect(visibleBreakdown()).toBe('d20 (1) + 5');

    // Reroll die 2: 2 + 5 = 7 still fails DC 13 — success is reachable ONLY
    // with the +18 Indomitable bonus (2 + 23 = 25).
    rollD20.mockReturnValue(2);
    fireEvent.click(screen.getByRole('button', { name: 'Indomitable (+18)' }));
    await screen.findByText('SAVE SUCCESS');

    expect(visibleTotal()).toBe('25');
    expect(visibleBreakdown()).toBe('d20 (2) + 23 (+18 Indomitable)');
    // The reroll physically happened: one die for the save, one for the reroll.
    expect(rollD20).toHaveBeenCalledTimes(2);
    // Exactly one use spent, value derived from uses 0 → 1 (WRITE-side 4-arg pin).
    expect(indomitableUseWrites()).toEqual([
      ['testTarget', 'indomitableUses', 1, 'test-campaign'],
    ]);
    // Rerolls auto-submit — exactly once, with the bonus threaded into the
    // submitted projection (payload SHAPE/flow is .actions' face, #1935).
    expect(sendSaveResult).toHaveBeenCalledTimes(1);
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-wis',
      success: true,
      roll: 2,
      total: 25,
      bonusDetail: '(+18 Indomitable)',
    }));
  });

  it.each([
    // Cap ladder bracketed at each tier (indomitableMaxUsesForLevel:
    // lv9 → 1, lv13 → 2, lv17 → 3). Shown legs pin the level-scaled
    // +fighter-level label through the REAL fighter_level expression.
    { level: 9, uses: 0, label: 'Indomitable (+9)' },
    { level: 9, uses: 1, label: null },
    { level: 13, uses: 1, label: 'Indomitable (+13)' },
    { level: 13, uses: 2, label: null },
    { level: 17, uses: 2, label: 'Indomitable (+17)' },
    { level: 17, uses: 3, label: null },
  ])('lv$level with $uses use(s) spent $label', async ({ level, uses, label }) => {
    await openFailedSave(createFighter(level), uses);

    if (label) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    } else {
      // At cap: button gone AND no side effects — a guard bypass that only
      // hid the button while still consuming/spending must fail here too.
      expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
      expect(indomitableUseWrites()).toHaveLength(0);
      expect(sendSaveResult).not.toHaveBeenCalled();
    }
  });

  it('does not offer Indomitable to characters without the reroll saveModifier', async () => {
    await openFailedSave(createFighter(18, { withIndomitable: false }), 0);

    expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
    expect(indomitableUseWrites()).toHaveLength(0);
    expect(sendSaveResult).not.toHaveBeenCalled();
  });

  it('offers only one reroll per failed save — a failed reroll is not rerollable again', async () => {
    // Every die lands a 1 and the save is cursed (-8): first save 1 − 8 = −7
    // fails; the reroll 1 − 8 + 18 = 11 is still below DC 13 — but with uses
    // reading 0 (< the lv18 cap of 3) the button's disappearance can only be
    // the once-per-failed-save gate.
    getAbilitySaveBonus.mockReturnValue(-8);
    await openFailedSave(createFighter(18), 0);

    fireEvent.click(screen.getByRole('button', { name: 'Indomitable (+18)' }));
    // Flush on the rerolled breakdown string itself (the caption was already
    // on screen pre-reroll — the mutation of THIS line proves the reroll
    // resolved).
    await screen.findByText('d20 (1) + 10 (+18 Indomitable)');

    expect(visibleTotal()).toBe('11');
    expect(visibleBreakdown()).toBe('d20 (1) + 10 (+18 Indomitable)');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
    // The failed reroll still auto-submits once, honestly, with the bonus
    // applied (a dropped bonus would post total −7 instead of 11).
    expect(sendSaveResult).toHaveBeenCalledTimes(1);
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-wis',
      success: false,
      total: 11,
      bonusDetail: '(+18 Indomitable)',
    }));
    // One reroll roll (initial + reroll) and one use spent — no runaway.
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(indomitableUseWrites()).toEqual([
      ['testTarget', 'indomitableUses', 1, 'test-campaign'],
    ]);
  });
});
