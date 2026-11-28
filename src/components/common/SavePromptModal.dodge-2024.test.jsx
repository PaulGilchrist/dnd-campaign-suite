// @maintained-by-ai 2026-11-27 — mock keys mirrored to #1935-#1939, phantoms purged, exact-string breakdown pins, findByTestId/exact-copy flushes
// BA-001 save lane: the 2024-ruleset Dodge gate face at the save-prompt seam
// (is2024 clause, SavePromptModal.jsx:131). "Advantage on Dexterity saving
// throws" is a 2014-only Dodge clause — under 2024 Dodge grants attack-roll
// disadvantage only, so a dodging character whose roster entry carries
// rules:'2024' must roll a plain single d20. The rules field is read via
// strict c.name === current.targetName equality and defaults '5e', so every
// fixture here is a REAL character object (bare strings take wrong lookup
// branches) and the default legs cover a rules-less entry AND an
// absent-from-roster target (the ?. leg). The gate must be narrow: an
// explicit prompt advantage flag survives untouched on a 2024 dodger.
//
// Each leg walks prompt → Roll Save → result panel and exact-pins the full
// .sp-result-breakdown string AND the visible total (#1936 idiom), with dice
// rigged so a broken gate changes on-screen bytes, not just a die count.
// The Done-payload pins below are gate projections only (mode/roll/total on
// THIS fixture) — the submit-flow contract itself is owned by .actions.
//
// Owned ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement, Apply(0)
//   presentation gate ................................. .actions.test.jsx (#1935)
// - 5e Dodge DEX-vs-CON arithmetic, CLA-324
//   against_spell + lastAttack ........................ .bonuses.test.jsx (#1936)
// - saveConditions / mod.condition legs ............... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ..... .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, confirm-closes-leaves-PENDING,
//   clear/dismiss advancement ......................... .coverage.test.jsx (#1939)
// - Zealous Presence blanket advantage ................ zealous-presence.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock even though this lane never sends (#1935-#1939 pattern).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
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

// Graph keys mirrored to the five sibling lanes (#1935-#1939): no
// useSyncedState/listeners phantoms — this modal never imports them.
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
async function rollWhileDodging(characters, expectedCaption, triggerTestId = 'subscriber-trigger-dex') {
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={characters}
      activeMapName={null}
    />
  );
  fireEvent.click(screen.getByTestId(triggerTestId));
  await screen.findByTestId('active-save-prompt');
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  // The caption and the total/breakdown land in the SAME result render —
  // flushing on the exact copy (bonuses-lane idiom) needs no DOM polling.
  await screen.findByText(expectedCaption);
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

    const { total, breakdown } = await rollWhileDodging([makeTargetChar('2024')], 'SAVE FAILURE');

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(total).toBe('15'); // 12 + 3 — dodge bought no second die
    expect(breakdown).toBe('d20 (12) + 3');
    expect(screen.queryByText(/Advantage|Disadvantage/)).not.toBeInTheDocument();
    // 15 < DC 17 (flushed by the caption above).

    // Gate projection at the submit seam: mode stays 'normal' — the payload
    // SHAPE/flow contract is .actions' face, not re-tested here.
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

    const { total, breakdown } = await rollWhileDodging([makeTargetChar('5e')], 'SAVE SUCCESS');

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(total).toBe('20'); // max(12, 17) + 3
    expect(breakdown).toBe('d20 (12, 17) + 3 (Advantage)');

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
    case                                   | characters                         | expectedTotal | expectedBreakdown
    ${'target with no rules field'}        | ${[makeTargetChar(undefined)]}     | ${'20'}       | ${'d20 (12, 17) + 3 (Advantage)'}
    ${'target absent from the roster'}     | ${[]}                              | ${'17'}       | ${'d20 (12, 17) + 0 (Advantage)'}
  `('defaults $case to the 2014 clause — dodging still rolls advantage', async ({ characters, expectedTotal, expectedBreakdown }) => {
    rollD20.mockReturnValueOnce(12).mockReturnValueOnce(17);

    const { total, breakdown } = await rollWhileDodging(characters, 'SAVE SUCCESS');

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(total).toBe(expectedTotal); // absent roster member has no save bonus (0)
    expect(breakdown).toBe(expectedBreakdown);
  });

  it('does not strip an explicit prompt advantage from a dodging 2024 target', async () => {
    rollD20.mockReturnValueOnce(12).mockReturnValueOnce(17);

    const { total, breakdown } = await rollWhileDodging(
      [makeTargetChar('2024')], 'SAVE SUCCESS', 'subscriber-trigger-dex-adv');

    // The gate must deny DODGE's bonus only — the prompt's own advantage
    // (advantage: true) still rolls 2d20, keeps the high die, and is labeled.
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(total).toBe('20');
    expect(breakdown).toBe('d20 (12, 17) + 3 (Advantage)');
  });
});
