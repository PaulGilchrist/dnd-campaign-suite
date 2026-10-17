// @maintained-by-ai
// @improved-by-ai
// BA-001 save lane: Dodge's "advantage on Dexterity saving throws" is a
// 2014-only clause. Under the 2024 ruleset Dodge grants attack-roll
// disadvantage against the dodger only — a 2024 character (e.g. LFH,
// rules='2024') taking a DEX save while dodging must roll plain (one d20,
// no Advantage marker), and 5e targets keep the clause byte-identical.
//
// Each test walks the full user journey — prompt → Roll Save → result panel
// → Done — and pins every observable outcome (dice count, kept die, total,
// UI mode label, submitted payload) so a broken gate fails on the behavior
// users see, not just a mock call count.
//
// Covered ELSEWHERE — do not re-add here:
// - 5e Dodge DEX vs CON normal lane .... bonuses.test.jsx
// - Hold-until-Done submit flow ........ actions.test.jsx
// - Zealous Presence blanket advantage . zealous-presence.test.jsx
// - Conditional frightened/charmed ..... cla034-conditional-save-advantage.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getAllyList } from '../../hooks/useAllySelection.js';
import * as circleOfPowerHandler from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: (name) => name || 'Unknown' },
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

// Flat +3 save bonus for every character in this file's scenarios.
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
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

// Only the two triggers this lane exercises:
// - dex: DEX save DC 17 Sacred Flame prompt
// - dex-adv: same prompt WITH the explicit advantage flag, proving the
//   2024 Dodge gate is narrow and does not strip unrelated advantage sources.
vi.mock('./Subscriber.jsx', () => {
  const dexPrompt = {
    promptId: 'test-prompt-dex',
    targetName: 'testTarget',
    saveType: 'dex',
    saveDc: 17,
    disadvantage: false,
    dcSuccess: 'half',
    sourceName: 'Sacred Flame',
  };
  function MockSubscriber({ handleEvent, campaignName }) {
    const fire = (testId, data) => React.createElement('button', {
      'data-testid': testId,
      onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-${data.targetName}`, data }),
    });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber' },
      fire('subscriber-trigger-dex', dexPrompt),
      fire('subscriber-trigger-dex-adv', { ...dexPrompt, promptId: 'test-prompt-dex-adv', advantage: true })
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

/**
 * testTarget with the given ruleset ('2024' | '5e' | undefined to test the
 * default). The save bonus is the mocked getAbilitySaveBonus (→ +3), so no
 * ability scores need to be authored here.
 */
function makeTargetChar(rules) {
  return {
    name: 'testTarget',
    level: 1,
    ...(rules ? { rules } : {}),
    class: { class_levels: [] },
    computedStats: {
      abilities: [],
      evasionEffects: [],
    },
    saveModifiers: [],
  };
}

/** Open the prompt, roll, wait for the result panel, return its visible text. */
async function rollWhileDodging(characters, triggerTestId = 'subscriber-trigger-dex') {
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={characters}
      activeMapName={null}
    />
  );
  fireEvent.click(screen.getByTestId(triggerTestId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(document.querySelector('.sp-result-total strong')).toBeTruthy();
  });
  return {
    total: document.querySelector('.sp-result-total strong').textContent,
    breakdown: document.querySelector('.sp-result-breakdown').textContent,
  };
}

describe('BA-001 SavePromptModal — Dodge save-lane ruleset gate', () => {
  beforeEach(() => {
    // Clears all mocks; rollD20→15, computeAuraBonus→{bonus:0}, getRuntimeValue→null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(getAllyList).mockReturnValue([]);
    // Dodge is live on testTarget in EVERY test; the 5e control case proves
    // this exact wiring produces advantage, so the 2024 denials are not vacuous.
    getRuntimeValue.mockImplementation((name, key) =>
      (name === 'testTarget' && key === 'activeBuffs') ? [{ name: 'Dodge', effect: 'dodge' }] : null);
  });
  afterEach(cleanupDefaults);

  it('rolls a plain single d20 for a dodging 2024 target and submits it unmodified', async () => {
    rollD20.mockReturnValue(12);

    const { total, breakdown } = await rollWhileDodging([makeTargetChar('2024')]);

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(total).toBe('15'); // 12 + 3 — dodge bought no second die
    expect(breakdown).toContain('d20 (12)');
    expect(breakdown).not.toMatch(/Advantage|Disadvantage/);
    expect(screen.queryByText(/Advantage/)).not.toBeInTheDocument();
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument(); // 15 < DC 17

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      mode: 'normal',
      roll: 12,
      total: 15,
      success: false,
    }));
  });

  it('still rolls 2d20 keeping the highest with an Advantage marker for a dodging 5e target (byte-inert)', async () => {
    // Distinct dice so a broken gate changes the visible outcome, not just
    // the die count: normal mode would keep the first die (12 → fail).
    rollD20.mockReturnValueOnce(12).mockReturnValueOnce(17);

    const { total, breakdown } = await rollWhileDodging([makeTargetChar('5e')]);

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(total).toBe('20'); // max(12, 17) + 3
    expect(breakdown).toContain('d20 (12, 17)');
    expect(breakdown).toMatch(/\(Advantage\)$/);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      mode: 'advantage',
      roll: 17,
      total: 20,
      success: true,
      rawRolls: [12, 17],
    }));
  });

  it.each`
    case                                     | characters                                    | expectedTotal
    ${'target with no rules field'}        | ${[makeTargetChar(undefined)]}            | ${'20'}
    ${'target absent from the roster'}     | ${[]}                                       | ${'17'}
  `('defaults $case to the 2014 clause — dodging still rolls advantage', async ({ characters, expectedTotal }) => {
    rollD20.mockReturnValueOnce(12).mockReturnValueOnce(17);

    const { total, breakdown } = await rollWhileDodging(characters);

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(total).toBe(expectedTotal); // absent roster member has no save bonus (0)
    expect(breakdown).toMatch(/\(Advantage\)$/);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('does not strip an explicit prompt advantage from a dodging 2024 target', async () => {
    rollD20.mockReturnValueOnce(12).mockReturnValueOnce(17);

    const { total, breakdown } = await rollWhileDodging([makeTargetChar('2024')], 'subscriber-trigger-dex-adv');

    // The gate must deny DODGE's bonus only — the prompt's own advantage
    // (advantage: true) still rolls 2d20, keeps the high die, and is labeled.
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(total).toBe('20');
    expect(breakdown).toMatch(/\(Advantage\)$/);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });
});
