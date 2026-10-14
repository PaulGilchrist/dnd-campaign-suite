// @improved-by-ai
// SavePromptModal — Rolling Mechanics
// Canonical roll-resolution lanes for a save prompt: which die survives
// (disadvantage keeps min, normal rolls once), which bonus source folds into
// the total (character save bonus vs combatSummary creature saveBonuses), the
// DC boundary (total exactly meeting the DC succeeds), and the Evasion-note
// contract for half-damage prompts (own Evasion shows; incapacitation
// suppresses it to the half-damage fallback).
//
// Deliberately NOT re-tested here (covered by sibling files):
// - charmed / Otto's Irresistible Dance DEX disadvantage → evasion-effects
// - beacon, holy aura/nimbus, dodge, Circle of Power, Zealous Presence advantage
//   → evasion-effects / holy-aura / dodge-2024 / cla034 / cla211 / bonuses
//   (their prompt-advantage flag mechanics are pinned there too)
// - reroll lanes → rerolls / indomitable
// - Done/Dismiss submission and save-result dispatch → actions
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
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

// Stubbed so the bonus-source routing can be pinned by arithmetic: every
// found-character save resolves through this stub returning +3, and every
// creature-lane save must show its combatSummary bonus instead.
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

// Test-event feeder: each button dispatches one SSE-shaped event through the
// real handleEvent the modal passes down (campaign-scoped keys, as production
// Subscriber delivers them). Table-driven — only prompts this file needs.
vi.mock('./Subscriber.jsx', () => {
  const promptEvent = (handleEvent, testId, campaign, data) =>
    React.createElement('button', {
      'data-testid': testId,
      onClick: () => handleEvent({ key: `change-${campaign}-savePrompt-${data.targetName}`, data }),
    });

  const PROMPTS = {
    'subscriber-trigger': {
      promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
    },
    'subscriber-trigger-disadvantage': {
      promptId: 'test-prompt-disadv', targetName: 'testTarget3', saveType: 'str', saveDc: 14,
      disadvantage: true, dcSuccess: 'half', sourceName: 'Fireball',
    },
    'subscriber-trigger-advantage': {
      promptId: 'test-prompt-adv', targetName: 'testTarget5', saveType: 'cha', saveDc: 13,
      advantage: true, dcSuccess: 'half',
    },
    'subscriber-trigger-half-con': {
      promptId: 'test-prompt-half-con', targetName: 'testTarget', saveType: 'con', saveDc: 12,
      disadvantage: false, dcSuccess: 'half', sourceName: 'Fireball',
    },
  };

  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      ...Object.entries(PROMPTS).map(([testId, data]) => promptEvent(handleEvent, testId, campaignName, data)),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal(props = {}) {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} {...props} />
  );
}

async function openPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/^(SAVE SUCCESS|SAVE FAILURE)$/)).toBeInTheDocument();
  });
}

// The total renders as: Total: <strong>{total}</strong> vs DC {dc} — split
// across elements, so match the owning <p> by its full textContent.
function expectTotalLine(total, dc) {
  const line = screen.getByText((_content, element) =>
    element?.tagName === 'P' && element.textContent === `Total: ${total} vs DC ${dc}`);
  expect(line).toBeInTheDocument();
}

describe('SavePromptModal — rolling', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // mockReturnValue from a previous test is NOT removed by clearAllMocks —
    // reset explicitly so tests stay order-independent.
    vi.mocked(getCombatSummary).mockReset();
  });
  afterEach(cleanupDefaults);

  // ── Disadvantage: explicit prompt flag keeps the lower die ──

  it('rolls two d20s and keeps the minimum when the prompt sets the disadvantage flag', async () => {
    // Distinct dice so a broken keep logic changes the visible outcome, not
    // just the die count: normal mode would keep 18 (≥ DC 14 → success).
    rollD20.mockReturnValueOnce(18).mockReturnValueOnce(5);

    renderModal();
    await openPrompt('subscriber-trigger-disadvantage');
    expect(screen.getByText('(Disadvantage)')).toBeInTheDocument();

    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    // min(18, 5) = 5; no character on the roster so the bonus is 0; 5 < DC 14.
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    expect(screen.queryByText('SAVE SUCCESS')).not.toBeInTheDocument();
    expectTotalLine(5, 14);
    expect(screen.getByText('d20 (18, 5) + 0 (Disadvantage)')).toBeInTheDocument();
  });

  // ── Normal roll: charmed must not bleed onto non-DEX saves ──

  it('rolls a single d20, unlabeled, for a non-DEX save while the target is charmed', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'testTarget' && key === 'activeConditions') return ['charmed'];
      return null;
    });
    rollD20.mockReturnValue(15);

    renderModal();
    await openPrompt();

    // The prompt itself carries no disadvantage, so the badge stays hidden even
    // while charmed is active — the charmed lane is DEX-only (evasion-effects).
    expect(screen.queryByText('(Disadvantage)')).not.toBeInTheDocument();

    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    // 15 + 0 bonus (empty roster, empty combatSummary) ≥ DC 12.
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expectTotalLine(15, 12);
    // Plain roll: breakdown shows a single die and no mode suffix.
    expect(screen.getByText('d20 (15) + 0')).toBeInTheDocument();
    expect(screen.queryByText(/Disadvantage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
  });

  // ── Bonus-source routing ──

  it('uses the found character save bonus, not combatSummary saveBonuses', async () => {
    // Decoy creature bonus: if the creature lane wrongly ran, the total would
    // be 15 + 9 = 24 instead of 15 + 3 = 18.
    rollD20.mockReturnValue(15);
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [{ name: 'testTarget', saveBonuses: { con: 9 } }],
    });

    renderModal({ characters: [createCharacter('testTarget')] });
    await openPrompt();
    await rollSave();

    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expectTotalLine(18, 12);
    expect(screen.getByText('d20 (15) + 3')).toBeInTheDocument();
  });

  it('uses creature saveBonuses from combatSummary when the target is not on the character roster', async () => {
    // +5 proves the creature lane ran: the character stub returns +3, so a
    // mistaken character lane would show 18, not 20.
    rollD20.mockReturnValue(15);
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [{ name: 'testTarget', saveBonuses: { con: 5 } }],
    });

    renderModal();
    await openPrompt();
    await rollSave();

    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expectTotalLine(20, 12);
    expect(screen.getByText('d20 (15) + 5')).toBeInTheDocument();
  });

  // ── DC boundary ──

  it('counts a save total that exactly meets the DC as a success', async () => {
    rollD20.mockReturnValue(9);

    renderModal({ characters: [createCharacter('testTarget')] });
    await openPrompt();
    await rollSave();

    // RAW: succeeding means meeting or beating the DC — 9 + 3 = 12 vs DC 12.
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expect(screen.queryByText('SAVE FAILURE')).not.toBeInTheDocument();
    expectTotalLine(12, 12);
  });

  // ── Evasion note on half-damage prompts ──

  it('shows the Evasion note when the target holds its own Evasion for this save', async () => {
    renderModal({
      characters: [createCharacter('testTarget', [], [{ saveType: 'CON' }])],
    });
    await openPrompt('subscriber-trigger-half-con');

    expect(screen.getByText('Evasion: No damage on success, half damage on failure')).toBeInTheDocument();
    expect(screen.queryByText(/Half damage on successful save/i)).not.toBeInTheDocument();
  });

  it('suppresses own Evasion to the half-damage note when the target is incapacitated', async () => {
    // Same setup as the positive control, but incapacitated — if the gate
    // ever leaks, the Evasion note appears here and this test fails.
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'testTarget' && key === 'activeConditions') return ['incapacitated'];
      return null;
    });

    renderModal({
      characters: [createCharacter('testTarget', [], [{ saveType: 'CON' }])],
    });
    await openPrompt('subscriber-trigger-half-con');

    expect(screen.getByText(/Half damage on successful save/i)).toBeInTheDocument();
    expect(screen.queryByText(/Evasion:/i)).not.toBeInTheDocument();

    // The save itself still resolves normally: single d20, bonus +3, DC 12.
    await rollSave();
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expectTotalLine(18, 12);
  });
});
