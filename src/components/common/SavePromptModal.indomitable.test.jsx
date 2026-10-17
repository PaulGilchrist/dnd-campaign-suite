// @maintained-by-ai
// @improved-by-ai
// CLA-195 regression: SavePromptModal must offer an "Indomitable (+N)" reroll
// on a failed save for a fighter with the Indomitable save-reroll modifier,
// consume indomitableUses, and hide the button at the per-long-rest max.
//
// Scope: modal-level behavior only — button availability (feature present,
// uses below the long-rest cap, one reroll per failed save), the +fighter
// level label, and wiring through to the submit path. Handler-level contracts
// (bonus threading through the pipeline, campaign logging, consumption guards)
// live in savePromptHandlers.indomitable.test.js and are NOT duplicated here.
//
// Improvements over the previous version:
//   - Negative tests now assert the absence of side effects too (no reroll
//     submission, no indomitableUses writes), so they fail if the guard were
//     bypassed silently rather than only hiding the button.
//   - Added the once-per-failed-save guard (a failed reroll must not offer
//     a second reroll even with uses remaining) — not covered elsewhere at
//     the modal level.
//   - Added the level-scaled cap boundaries (lv9 → 1 use, lv13 → 2 uses)
//     and pinned the +level label to fighter level at those boundaries;
//     previously only lv18/3-uses was exercised.
//   - Positive-flow test now asserts the reroll actually rolled the die
//     twice and spent exactly one use (derived, not merely "some call").
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, rollD20: vi.fn(), rollExpression: vi.fn() }
});

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 5),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
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
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', { 'data-testid': 'subscriber-trigger-wis', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false } }) }),
    );
  }
  return { default: MockSubscriber };
});

// ── Fixtures ──

const indomitableModifier = {
  source: 'Indomitable',
  target: 'saving_throw',
  condition: '',
  effect: 'reroll',
  bonusExpression: 'fighter_level',
  oncePerRage: false,
};

function createFighter(name, level, { withIndomitable = true } = {}) {
  const saveModifiers = withIndomitable ? [indomitableModifier] : [];
  return {
    name,
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
// unrelated feature (rage, focus, legendary, guarded mind) leaks into scope.
function mockRuntime({ uses = 0 } = {}) {
  getRuntimeValue.mockImplementation((name, key, campaign) => {
    if (campaign !== 'test-campaign') return null;
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

async function rollAndFailSave() {
  fireEvent.click(screen.getByTestId('subscriber-trigger-wis'));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
  });
}

// WIS save DC 13, +5 save bonus: a natural 1 fails (6 < 13).
function renderFighterModal(character) {
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={[character]}
      activeMapName={null}
    />
  );
}

describe('SavePromptModal — Indomitable reroll (CLA-195)', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // Factory default for every test; the "failed reroll" test overrides it.
    getAbilitySaveBonus.mockReturnValue(5);
  });
  afterEach(cleanupDefaults);

  it('offers Indomitable (+18) on a failed save, rerolls it to success, and spends exactly one use', async () => {
    rollD20.mockReturnValueOnce(1).mockReturnValue(15);
    mockRuntime({ uses: 0 });
    renderFighterModal(createFighter('testTarget', 18));

    await rollAndFailSave();

    fireEvent.click(screen.getByRole('button', { name: 'Indomitable (+18)' }));

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    // The reroll physically happened: one die for the initial save, one for
    // the reroll.
    expect(rollD20).toHaveBeenCalledTimes(2);
    // Exactly one use spent, value derived from uses 0 → 1.
    expect(indomitableUseWrites()).toEqual([
      ['testTarget', 'indomitableUses', 1, 'test-campaign'],
    ]);
    // The rerolled result is the one submitted to the server.
    expect(savePromptService.sendSaveResult).toHaveBeenLastCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-wis',
      success: true,
      bonusDetail: '(+18 Indomitable)',
    }));
  });

  it.each([
    // Level boundaries where the per-long-rest cap changes.
    { level: 9, maxUses: 1 },
    { level: 13, maxUses: 2 },
  ])('scales the reroll bonus (+$level) and long-rest cap ($maxUses uses) with fighter level', async ({ level, maxUses }) => {
    // Below cap: button shown with +fighter-level bonus in its label.
    rollD20.mockReturnValueOnce(1).mockReturnValue(19);
    mockRuntime({ uses: 0 });
    renderFighterModal(createFighter('testTarget', level));

    await rollAndFailSave();

    expect(screen.getByRole('button', { name: `Indomitable (+${level})` })).toBeInTheDocument();
    cleanup();

    // At cap: button gone and nothing spent or submitted beyond the initial
    // failed save.
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    rollD20.mockReturnValue(1);
    mockRuntime({ uses: maxUses });
    renderFighterModal(createFighter('testTarget', level));

    await rollAndFailSave();

    expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
    expect(indomitableUseWrites()).toHaveLength(0);
  });

  it('does not offer Indomitable once all long-rest uses (3 at lv18) are spent', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ uses: 3 });
    renderFighterModal(createFighter('testTarget', 18));

    await rollAndFailSave();

    expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
    expect(indomitableUseWrites()).toHaveLength(0);
  });

  it('does not offer Indomitable to characters without the feature', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ uses: 0 });
    renderFighterModal(createFighter('testTarget', 18, { withIndomitable: false }));

    await rollAndFailSave();

    expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
    expect(indomitableUseWrites()).toHaveLength(0);
  });

  it('offers only one reroll per failed save — a failed reroll is not rerollable again', async () => {
    // Every die lands a 1 and the save is cursed (-8): first save 1-8 = -7
    // fails; even the reroll 1-8+18 = 11 < DC 13 still fails — but the
    // modal must not offer Indomitable a second time while uses remain.
    getAbilitySaveBonus.mockReturnValue(-8);
    rollD20.mockReturnValue(1);
    mockRuntime({ uses: 0 });
    renderFighterModal(createFighter('testTarget', 18));

    await rollAndFailSave();

    fireEvent.click(screen.getByRole('button', { name: 'Indomitable (+18)' }));

    // The reroll submits once and fails honestly (only rerolls auto-submit —
    // an ordinary failed save waits for the player to press Done).
    await waitFor(() => {
      expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
    });
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-wis',
      success: false,
      total: 11, // 1 + (-8) + 18 — the Indomitable bonus was applied, yet still short
      bonusDetail: '(+18 Indomitable)',
    }));

    expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
    // One reroll roll (initial + reroll) and one use spent — no runaway.
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(indomitableUseWrites()).toEqual([
      ['testTarget', 'indomitableUses', 1, 'test-campaign'],
    ]);
  });
});
