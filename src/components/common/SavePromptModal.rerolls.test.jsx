// @improved-by-ai
// SavePromptModal — reroll lanes.
// Behavioral coverage for the reroll features offered on a failed save prompt:
// Fanatical Focus, Disciplined Survivor, Guarded Mind, and Living Legend.
// Each lane is verified end-to-end: when its button appears (and when it must
// not), that clicking it actually re-resolves the save with the right bonus,
// and that the correct runtime resource is spent — or deliberately not spent.
//
// Test-design notes:
//   - Reroll die values are chosen so the reroll can only succeed thanks to
//     the lane's own bonus (e.g. Fanatical Focus: reroll 8 + 3 save vs DC 12
//     passes ONLY with the +2 rage bonus), so a broken bonus cannot pass
//     silently. A 15 that wins anyway would prove nothing.
//   - Guarded Mind negatives target the SAME character as the positives, so
//     a hidden button proves the rule under test, not an unrelated
//     character-not-found fallback.
//   - One scenario per test; no mid-test cleanup/reset.
//   - Indomitable has its own dedicated lane (SavePromptModal.indomitable
//     .test.jsx) and is kept switched off here via empty saveModifiers.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createRageCharacter } from './SavePromptModal.test-utils.jsx';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
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

// Subscriber feeds SSE save-prompt events through the modal's handleEvent
// seam. Only the triggers this file needs; all target 'testTarget' so that
// negative-path clicks exercise the same character as the positive paths.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, key, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-${key}`, data }),
      });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      trigger('subscriber-trigger-con', 'savePrompt-testTarget', { promptId: 'test-prompt-con', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false }),
      trigger('subscriber-trigger-wis', 'savePrompt-testTarget', { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false }),
      trigger('subscriber-trigger-str', 'savePrompt-testTarget', { promptId: 'test-prompt-str', targetName: 'testTarget', saveType: 'str', saveDc: 15, disadvantage: false })
    );
  }
  return { default: MockSubscriber };
});

// ── Fixtures & helpers ──

const RAGE_BUFF = [{ damageBonusExpression: 'rage_damage' }];
const GUARDED_MIND_ACTION = { type: 'auto_reroll', effect: 'override_fail_to_success', oncePer: 'short_or_long_rest' };

// Runtime store reads answered per save-key, campaign-scoped; every unlisted
// key reads null so reroll lanes stay closed unless a test opens them.
function mockRuntime(overrides = {}) {
  getRuntimeValue.mockImplementation((name, key, campaign) =>
    campaign === 'test-campaign' && key in overrides ? overrides[key] : null
  );
}

function makeCharacter({ classLevels = [{}], specialActions = [] } = {}) {
  return {
    name: 'testTarget',
    level: 1,
    class: { class_levels: classLevels },
    computedStats: {
      abilities: [{ name: 'Constitution', bonus: 3 }],
      evasionEffects: [],
      automation: { passives: [], specialActions },
    },
    saveModifiers: [],
  };
}

function renderModal(character) {
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={[character]}
      activeMapName={null}
    />
  );
}

async function openPrompt(triggerTestId = 'subscriber-trigger-con') {
  fireEvent.click(screen.getByTestId(triggerTestId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

async function rollSave(expectedOutcome = /SAVE FAILURE/) {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(expectedOutcome)).toBeInTheDocument();
  });
}

function clickButton(name) {
  fireEvent.click(screen.getByRole('button', { name }));
}

// Every reroll affordance the result panel can offer, for "no way out"
// negative assertions (Roll Save cannot match — it lacks 'Reroll').
function rerollButtons() {
  return screen.queryAllByRole('button', { name: /Reroll Save|Guarded Mind|Indomitable/ });
}

describe('SavePromptModal — rerolls', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Fanatical Focus ──

  it('offers no reroll after a failed save when the target is not raging and holds no resources', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime();
    renderModal(createRageCharacter('testTarget', 2));

    await openPrompt();
    await rollSave();

    expect(rerollButtons()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('shows the +2 Fanatical Focus reroll button only after a failed save while raging', async () => {
    rollD20.mockReturnValue(1); // 1 + 3 save bonus fails DC 12
    mockRuntime({ activeBuffs: RAGE_BUFF, fanaticalFocusUsed: false });
    renderModal(createRageCharacter('testTarget', 2));

    await openPrompt();
    expect(rerollButtons()).toHaveLength(0); // nothing offered before the save is rolled

    await rollSave();

    expect(rerollButtons()).toHaveLength(1); // exactly the FF lane is open
    expect(screen.getByRole('button', { name: 'Reroll Save (+2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('rerolls with the +2 Fanatical Focus bonus folded into the total', async () => {
    rollD20.mockReturnValueOnce(1).mockReturnValueOnce(8);
    mockRuntime({ activeBuffs: RAGE_BUFF, fanaticalFocusUsed: false });
    renderModal(createRageCharacter('testTarget', 2));

    await openPrompt();
    await rollSave();
    clickButton('Reroll Save (+2)');

    // 8 + 3 = 11 fails DC 12 — success here can only come from the +2 rage bonus.
    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'fanaticalFocusUsed', true, 'test-campaign');
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-con',
      success: true,
      roll: 8,
      total: 13,
      bonusDetail: expect.stringContaining('Fanatical Focus'),
    }));
  });

  it('allows only one reroll per save — a failed Fanatical Focus reroll offers no second chance', async () => {
    rollD20.mockReturnValue(1); // original AND reroll fail (1 + 3 + 2 < DC 12)
    mockRuntime({ activeBuffs: RAGE_BUFF, fanaticalFocusUsed: false });
    renderModal(createRageCharacter('testTarget', 2));

    await openPrompt();
    await rollSave();
    clickButton('Reroll Save (+2)');

    await waitFor(() => {
      expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({ success: false }));
    });

    expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    expect(rerollButtons()).toHaveLength(0); // rerollUsedForSave guard — no second reroll lane
    expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1); // the failed reroll posted exactly once
  });

  it('suppresses every reroll lane once Fanatical Focus has been used', async () => {
    // Rage buff, focus points, and Living Legend would ALL offer a reroll
    // button — the shared per-turn FF-use flag must close every lane.
    rollD20.mockReturnValue(1);
    mockRuntime({ activeBuffs: RAGE_BUFF, fanaticalFocusUsed: true, focusPoints: 2, livingLegendActive: true });
    renderModal(createRageCharacter('testTarget', 2));

    await openPrompt();
    await rollSave();

    expect(rerollButtons()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Disciplined Survivor ──

  it('shows the focus-point reroll button as the only reroll lane when focus points remain', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ focusPoints: 2 });
    renderModal(makeCharacter({ classLevels: [{ focus_points: 3 }] }));

    await openPrompt();
    await rollSave();

    expect(rerollButtons()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Reroll Save (1 Focus Point)' })).toBeInTheDocument();
  });

  it('spends one focus point and submits the rerolled result when Disciplined Survivor is used', async () => {
    rollD20.mockReturnValueOnce(1).mockReturnValueOnce(15);
    mockRuntime({ focusPoints: 2 });
    renderModal(makeCharacter({ classLevels: [{ focus_points: 3 }] }));

    await openPrompt();
    await rollSave();
    clickButton('Reroll Save (1 Focus Point)');

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'focusPoints', 1, 'test-campaign');
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-con',
      success: true,
      roll: 15,
      total: 18,
      bonusDetail: '(-1 Focus Point)',
    }));
  });

  it('offers no reroll and spends nothing when focus points are exhausted', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ focusPoints: 0 });
    renderModal(makeCharacter({ classLevels: [{ focus_points: 3 }] }));

    await openPrompt();
    await rollSave();

    expect(rerollButtons()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('testTarget', 'focusPoints', expect.anything(), 'test-campaign');
  });

  // ── Guarded Mind ──

  it('shows the Guarded Mind button on a failed mental save with the feature automation', async () => {
    rollD20.mockReturnValue(1); // 1 + 3 fails DC 13
    mockRuntime({ _guardedMind_usedRest: false });
    renderModal(makeCharacter({ specialActions: [GUARDED_MIND_ACTION] }));

    await openPrompt('subscriber-trigger-wis');
    await rollSave();

    expect(screen.getByRole('button', { name: 'Guarded Mind' })).toBeInTheDocument();
  });

  it.each(['str', 'con'])('does not offer Guarded Mind on a non-mental (%s) save', async (saveType) => {
    rollD20.mockReturnValue(1);
    mockRuntime({ _guardedMind_usedRest: false });
    renderModal(makeCharacter({ specialActions: [GUARDED_MIND_ACTION] }));

    await openPrompt(`subscriber-trigger-${saveType}`);
    await rollSave();

    expect(screen.queryByRole('button', { name: 'Guarded Mind' })).not.toBeInTheDocument();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('converts a failed mental save to an automatic success without rolling again', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ _guardedMind_usedRest: false });
    renderModal(makeCharacter({ specialActions: [GUARDED_MIND_ACTION] }));

    await openPrompt('subscriber-trigger-wis');
    await rollSave();
    clickButton('Guarded Mind');

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(rollD20).toHaveBeenCalledTimes(1); // override, not reroll — no second d20
    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', '_guardedMind_usedRest', 'rest', 'test-campaign');
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-wis',
      success: true,
      roll: 20,
      total: 13,
      bonusDetail: '(Guarded Mind)',
    }));
  });

  it('offers no Guarded Mind once it has been used since the last rest', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ _guardedMind_usedRest: 'rest' });
    renderModal(makeCharacter({ specialActions: [GUARDED_MIND_ACTION] }));

    await openPrompt('subscriber-trigger-wis');
    await rollSave();

    expect(screen.queryByRole('button', { name: 'Guarded Mind' })).not.toBeInTheDocument();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Living Legend ──

  it('shows the Living Legend reroll button while the feature is active', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ livingLegendActive: true });
    renderModal(makeCharacter());

    await openPrompt();
    await rollSave();

    expect(rerollButtons()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Reroll Save' })).toBeInTheDocument();
  });

  it('rerolls for free — Living Legend spends no tracked resource', async () => {
    rollD20.mockReturnValueOnce(1).mockReturnValueOnce(15);
    mockRuntime({ livingLegendActive: true });
    renderModal(makeCharacter());

    await openPrompt();
    await rollSave();
    clickButton('Reroll Save');

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-con',
      success: true,
      roll: 15,
      total: 18,
      bonusDetail: undefined, // bonus-free reroll
    }));
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', { livingLegendActive: false }],
    ['its use already spent', { livingLegendActive: true, indomitableUses: 1 }],
  ])('hides the Living Legend reroll when the feature is %s', async (_case, runtime) => {
    rollD20.mockReturnValue(1);
    mockRuntime(runtime);
    renderModal(makeCharacter());

    await openPrompt();
    await rollSave();

    expect(rerollButtons()).toHaveLength(0);
  });

  // ── Across all lanes ──

  it('offers no reroll button on a successful save, even with every lane available', async () => {
    rollD20.mockReturnValue(15); // 15 + 3 passes DC 12
    mockRuntime({
      activeBuffs: RAGE_BUFF,
      fanaticalFocusUsed: false,
      focusPoints: 2,
      livingLegendActive: true,
      _guardedMind_usedRest: false,
    });
    renderModal(makeCharacter({
      classLevels: [{ rage_damage: 2, focus_points: 3 }],
      specialActions: [GUARDED_MIND_ACTION],
    }));

    await openPrompt();
    await rollSave(/SAVE SUCCESS/);

    expect(rerollButtons()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
