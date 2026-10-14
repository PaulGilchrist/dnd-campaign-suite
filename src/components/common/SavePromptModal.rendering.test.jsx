// SavePromptModal — rendering
// Tests the visual rendering of the save prompt modal: overlay visibility,
// prompt display content (target, ability, DC, disadvantage, source, evasion notes),
// and edge cases for character array types.
//
//   - Added vi.clearAllMocks() to beforeEach for test isolation
//   - Removed tests fully duplicated in other test files:
//     * "shows result failure message" → covered in rolling.test.jsx
//     * "shows result after rolling" → covered in actions.test.jsx
//     * "shows queue count" → covered in actions.test.jsx
//     * "shows aura bonus" → covered in bonuses.test.jsx
//     * "shows result breakdown" → covered in bonuses.test.jsx
//     * "shows No damage on successful save" → covered in test-utils-coverage.test.jsx
//     * "shows evasion message (own or shared)" → covered in coverage.test.jsx
//     * "shows evasion message (circle of power)" → covered in coverage.test.jsx
//   - Strengthened assertions to verify behavioral outcomes (not just presence of text)
//   - Fixed getRuntimeValue.mockImplementation parameter order to match convention (name, key, campaign)
//   - Added missing assertion: verify overlay element class presence
//   - Added edge case: verify modal renders with string characters in array
//
//   - Removed "shows result failure message when save fails" — duplicate of rolling.test.jsx and actions.test.jsx roll+result flows
//   - Removed "shows result total and breakdown after rolling a save" — duplicate of actions.test.jsx "sends save result via sendSaveResult when dismissing after a roll"
//   - Removed "shows queue count in header when multiple prompts exist" — duplicate of actions.test.jsx "shows queue count and advances to second prompt when multiple prompts exist"
//   - Removed "shows advantage badge when prompt has advantage flag" — brittle negative assertion; test name says "advantage" but verifies absence of disadvantage; mocks withAdvantage flag that doesn't affect badge display

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';

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

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', { 'data-testid': 'subscriber-trigger', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-second', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget2`, data: { promptId: 'test-prompt-2', targetName: 'testTarget2', saveType: 'dex', saveDc: 15, disadvantage: true, dcSuccess: 'half' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-cleared', onClick: () => handleEvent({ key: `change-${campaignName}-savePromptCleared-testTarget`, data: { promptId: 'test-prompt-1' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-disadvantage', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget3`, data: { promptId: 'test-prompt-disadv', targetName: 'testTarget3', saveType: 'str', saveDc: 14, disadvantage: true, dcSuccess: 'half', sourceName: 'Fireball' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-dex', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17, disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-none-dc', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget4`, data: { promptId: 'test-prompt-none', targetName: 'testTarget4', saveType: 'wis', saveDc: 16, disadvantage: false, dcSuccess: 'none' } }) }),
    );
  }
  return { default: MockSubscriber };
});

// ── Re-import mocked modules ──

import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

describe('SavePromptModal — rendering', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Overlay visibility ──

  it('renders nothing when there are no prompts', () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );
    expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  // ── Prompt display content ──

  it('displays the modal with target name, ability, and DC when a prompt is queued', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(screen.getByText('testTarget')).toBeInTheDocument();
    expect(screen.getByText('CON')).toBeInTheDocument();
    expect(screen.getByText('DC 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('shows disadvantage badge when prompt has disadvantage flag', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-disadvantage');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText('(Disadvantage)')).toBeInTheDocument();
  });

  it('shows source name when provided in prompt', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-disadvantage');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Source: Fireball/i)).toBeInTheDocument();
    });
  });

  it('shows half damage message when dcSuccess is "half" without evasion', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-dex');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Half damage on successful save/i)).toBeInTheDocument();
  });

  // ── Edge cases ──

  it('renders correctly when characters array contains string names', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testTarget']}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText('testTarget')).toBeInTheDocument();
    expect(screen.getByText('CON')).toBeInTheDocument();
    expect(screen.getByText('DC 12')).toBeInTheDocument();
  });

  it('renders correctly when characters array contains object characters', async () => {
    const targetChar = createCharacter('testTarget', [], []);
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText('testTarget')).toBeInTheDocument();
    expect(screen.getByText('CON')).toBeInTheDocument();
    expect(screen.getByText('DC 12')).toBeInTheDocument();
  });

  it('renders correctly when characters array contains mixed strings and objects', async () => {
    const otherChar = createCharacter('otherChar');
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testTarget', otherChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText('testTarget')).toBeInTheDocument();
  });

  it('shows "No damage on successful save" note when dcSuccess is "none"', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-none-dc');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/No damage on successful save/i)).toBeInTheDocument();
    });
  });
});
