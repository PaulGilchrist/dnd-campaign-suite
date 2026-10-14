// @improved-by-ai
// SavePromptModal — Evasion Effects (Beacon of Hope, Cosmic Omen, Disadvantage lanes)
// Pins the behavioral outcome of each evasion effect on save resolution: which
// die faces survive (advantage keeps max, disadvantage keeps min), the numeric
// total with each bonus folded in, and one-shot consumption of Cosmic Omen.
//
// Scope notes:
//   - Explicit prompt-flag disadvantage is covered by rolling.test.jsx; the
//     condition/te lanes below were deleted from BOTH files under a circular
//     "covered by the other file" claim, so they are restored here:
//       charmed → DEX save disadvantage (condition lane)
//       ottos_irresistible_dance → DEX save disadvantage (te lane)
//   - Unit-level getSaveDisadvantage rules (Slow, hex, ability-scoped) live in
//     savePromptUtils.test.js; this file only pins the modal's roll behavior.
//   - The "Force Roll" in the old title referenced an unreachable ref
//     (forceRollTo20Ref is never set true) — no test exists for it, removed
//     from the title rather than faked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

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

// Flat +3 save bonus for every ability — totals below are computed against it.
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

// SSE triggers for the prompts this file exercises. The component renders the
// Subscriber only when EventSource exists (setupDefaults provides the stub).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, prompt) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-${prompt.targetName}`, data: prompt }),
      });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      trigger('trigger-con', { promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false }),
      trigger('trigger-wis', { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false, dcSuccess: 'half' }),
      trigger('trigger-wis-dis', { promptId: 'test-prompt-wis-dis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: true, dcSuccess: 'half' }),
      trigger('trigger-dex', { promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17, disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame' }),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

const targetChar = () => createCharacter('testTarget');

function renderModal(characters = [targetChar()]) {
  render(<SavePromptModal campaignName="test-campaign" characters={characters} activeMapName={null} />);
}

async function openPrompt(testId) {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/Total:/i)).toBeInTheDocument();
  });
}

// Exact breakdown pins the raw dice, folded bonus total, and roll mode label
// (e.g. 'd20 (7, 17) + 3 (Advantage)') — catches min/max swaps and bonus drops.
function expectBreakdown(text) {
  expect(screen.getByText(text)).toBeInTheDocument();
}

function expectSaveTotal(total) {
  const el = document.querySelector('.sp-result-total strong');
  expect(el).toBeInTheDocument();
  expect(el.textContent).toBe(String(total));
}

// Route campaign-root targetEffects reads through the mocked runtime store.
// (SP-014: producers write setRuntimeValue('campaign','targetEffects',…),
// and te.target matching must keep the effect from granting cross-target.)
function routeCampaignTargetEffects(targetEffects) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (name === 'campaign' && key === 'targetEffects') return targetEffects;
    return null;
  });
}

describe('SavePromptModal — Evasion Effects', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Beacon of Hope (campaign-root targetEffect) ──

  it('grants advantage on Wisdom saves to the beaconed target and keeps the higher d20', async () => {
    rollD20.mockReturnValueOnce(7).mockReturnValueOnce(17);
    routeCampaignTargetEffects([
      { target: 'testTarget', effect: 'beacon_of_hope', caster: 'testCaster', duration: 'concentration' },
    ]);

    renderModal();
    await openPrompt('trigger-wis');
    await rollSave();

    // Two dice, maximum (17) kept: 17 + 3 = 20 ≥ DC 13.
    expect(rollD20).toHaveBeenCalledTimes(2);
    expectBreakdown('d20 (7, 17) + 3 (Advantage)');
    expectSaveTotal(20);
    expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
  });

  it('does not grant beacon_of_hope advantage on non-Wisdom saves', async () => {
    rollD20.mockReturnValue(15);
    routeCampaignTargetEffects([
      { target: 'testTarget', effect: 'beacon_of_hope', caster: 'testCaster', duration: 'concentration' },
    ]);

    renderModal();
    await openPrompt('trigger-dex');
    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expectBreakdown('d20 (15) + 3');
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
    expectSaveTotal(18);
  });

  it('does not grant advantage when the beacon targetEffect names another creature', async () => {
    rollD20.mockReturnValue(15);
    routeCampaignTargetEffects([
      { target: 'someoneElse', effect: 'beacon_of_hope', caster: 'testCaster', duration: 'concentration' },
    ]);

    renderModal();
    await openPrompt('trigger-wis');
    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expectBreakdown('d20 (15) + 3');
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
  });

  it('does not let beacon_of_hope override explicit prompt disadvantage', async () => {
    // Advantage/advantage-gating order: disadvantage wins, minimum kept.
    rollD20.mockReturnValueOnce(14).mockReturnValueOnce(6);
    routeCampaignTargetEffects([
      { target: 'testTarget', effect: 'beacon_of_hope', caster: 'testCaster', duration: 'concentration' },
    ]);

    renderModal();
    await openPrompt('trigger-wis-dis');
    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expectBreakdown('d20 (14, 6) + 3 (Disadvantage)');
    expectSaveTotal(9);
    expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
  });

  // ── Cosmic Omen (one-shot pending bonus) ──

  it('folds a Weal pending bonus into the save total and posts it on Done', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'cosmicOmenPendingBonus') return JSON.stringify({ type: 'Weal', value: 2 });
      return null;
    });

    renderModal();
    await openPrompt('trigger-con');
    await rollSave();

    // 15 + 3 save + 2 Weal = 20, with the omen itemized in the breakdown.
    expect(rollD20).toHaveBeenCalledTimes(1);
    expectBreakdown('d20 (15) + 5 (+2 from Weal)');
    expectSaveTotal(20);
    // One-shot: the pending bonus is cleared after use.
    expect(setRuntimeValue).toHaveBeenCalledWith('cosmicOmen', 'cosmicOmenPendingBonus', null, 'test-campaign', true);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
        promptId: 'test-prompt-1',
        success: true,
        total: 20,
        saveBonus: 5,
        bonusDetail: '(+2 from Weal)',
      }));
    });
  });

  it('subtracts a Woe pending bonus from the save total', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'cosmicOmenPendingBonus') return JSON.stringify({ type: 'Woe', value: 3 });
      return null;
    });

    renderModal();
    await openPrompt('trigger-con');
    await rollSave();

    // Woe is NEGATIVE: 15 + 3 − 3 = 15 (a sign bug would show 21).
    expectBreakdown('d20 (15) + 0 (-3 from Woe)');
    expectSaveTotal(15);
    expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    expect(setRuntimeValue).toHaveBeenCalledWith('cosmicOmen', 'cosmicOmenPendingBonus', null, 'test-campaign', true);
  });

  it('rolls normally when the pending cosmic omen payload is unparseable and does not clear it', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'cosmicOmenPendingBonus') return '{not json';
      return null;
    });

    renderModal();
    await openPrompt('trigger-con');
    await rollSave();

    // Corrupt payload must not corrupt the roll: no phantom bonus, no omen copy.
    expectBreakdown('d20 (15) + 3');
    expectSaveTotal(18);
    expect(screen.queryByText(/from (Weal|Woe)/i)).not.toBeInTheDocument();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('cosmicOmen', 'cosmicOmenPendingBonus', null, 'test-campaign', true);
  });

  // ── DEX save disadvantage lanes (restored — deleted from both this file and
  //    rolling.test.jsx under a circular duplicate claim) ──

  it('rolls with disadvantage (keeps the lower d20) on a DEX save while the target is charmed', async () => {
    rollD20.mockReturnValueOnce(16).mockReturnValueOnce(9);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'testTarget' && key === 'activeConditions') return ['charmed'];
      return null;
    });

    renderModal();
    await openPrompt('trigger-dex');
    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expectBreakdown('d20 (16, 9) + 3 (Disadvantage)');
    // 9 + 3 = 12 < DC 17.
    expectSaveTotal(12);
    expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
  });

  it('rolls with disadvantage on a DEX save under an ottos_irresistible_dance targetEffect', async () => {
    rollD20.mockReturnValueOnce(16).mockReturnValueOnce(9);
    routeCampaignTargetEffects([
      { target: 'testTarget', effect: 'ottos_irresistible_dance', caster: 'testCaster' },
    ]);

    renderModal();
    await openPrompt('trigger-dex');
    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expectBreakdown('d20 (16, 9) + 3 (Disadvantage)');
    expectSaveTotal(12);
    expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
  });
});
