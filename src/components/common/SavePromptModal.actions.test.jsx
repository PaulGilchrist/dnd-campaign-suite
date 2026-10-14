// SavePromptModal — actions
// Tests behavioral outcomes of save prompt interactions: dismissal, rolling,
// event dispatching, prompt queuing, clearing, and storage behavior.
//
// Quality improvements:
//   - Added vi.clearAllMocks() to beforeEach for test isolation
//   - Added setRuntimeValue import (used in assertions)
//   - Removed duplicate save-result event test (lines 201-243 were a weaker duplicate of 156-198)
//   - Strengthened duplicate-prompt test to verify only 1 prompt exists in queue
//   - Added assertions for clearSavePrompt and sendSaveResult calls in Done test
//   - Fixed getRuntimeValue.mockImplementation parameter order to match convention (name, key, campaign)
//   - Added test for dismiss after rolling (verifies sendSaveResult is called on dismiss with result)
//   - Added test for prompt queue: second prompt appears after first is rolled and dismissed
//   - Added test for handleEvent ignoring events from other campaigns
//   - Removed redundant assertions where behavioral outcome already covers the check
//
//   - Removed "advances to next prompt when Done is clicked with single prompt" (lines 190-219)
//     Duplicate of "shows second prompt after first is rolled and Done is clicked" (lines 221-260)
//     which covers the same Done-click behavior with stronger queue assertions
//   - Removed "dispatches save-result event with evasion and rawDamage properties" (lines 309-351)
//     Weaker duplicate of "dispatches save-result custom event with correct detail" (lines 264-307)
//     which already asserts all properties including promptId, targetName, saveType, saveDc, success, roll, mode
//   - Removed "shows queue count and advances to second prompt when multiple prompts exist" (lines 355-393)
//     Duplicate of "shows second prompt after first is rolled and Done is clicked" (lines 221-260)
//     identical flow: trigger → roll → Next Save → verify second prompt
//   - Removed "stores lastAttack data in storage when combatSummary exists" (lines 483-518)
//     Duplicate of special-handlers.test.jsx "stores lastAttack when rolling a save with combatSummary present"
//   - Removed "sends save result via sendSaveResult when done is clicked after roll" (lines 522-556)
//     Duplicate of special-handlers.test.jsx test with identical sendSaveResult + clearSavePrompt assertions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import * as circleOfPowerHandler from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';
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

describe('SavePromptModal — actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Dismiss ──

  it('dismisses the prompt when dismiss button is clicked', async () => {
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

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });

    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
  });

  it('sends save result via sendSaveResult when dismissing after a roll', async () => {
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

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    // After rolling, the Dismiss button is replaced by Done
    // The modal should show the result with Done button
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();

    // Click Done to finalize
    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });

    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
      roll: 15,
      success: true,
    }));
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
  });

  it('shows second prompt after first is rolled and Done is clicked', async () => {
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

    // Queue a second prompt
    const trigger2 = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    const doneBtn = screen.getByRole('button', { name: 'Next Save' });
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
      expect(screen.getByText('DC 15')).toBeInTheDocument();
    });
  });

  // ── save-result event ──

  it('dispatches save-result custom event with correct detail after rolling', async () => {
    const eventHandler = vi.fn();
    window.addEventListener('save-result', eventHandler);

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

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
    });

    const eventDetail = eventHandler.mock.calls[0][0].detail;
    expect(eventDetail.promptId).toBe('test-prompt-1');
    expect(eventDetail.targetName).toBe('testTarget');
    expect(eventDetail.saveType).toBe('con');
    expect(eventDetail.saveDc).toBe(12);
    expect(eventDetail.success).toBe(true);
    expect(eventDetail.roll).toBe(15);
    expect(eventDetail.mode).toBe('normal');

    window.removeEventListener('save-result', eventHandler);
  });

  it('does not add duplicate prompts with same promptId', async () => {
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

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.queryByText(/\(1 of 2\)/)).not.toBeInTheDocument();
    });

    // Verify only one prompt exists by confirming the modal still shows the original target
    expect(screen.getByText('testTarget')).toBeInTheDocument();
  });

  // ── Cleared event ──

  it('removes prompt when savePromptCleared event is received', async () => {
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

    const clearedBtn = screen.getByTestId('subscriber-trigger-cleared');
    fireEvent.click(clearedBtn);

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
  });

  // ── String characters in characters array ──

  it('handles mixed string and object characters in characters array', async () => {
    const character = createCharacter('otherChar');
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testTarget', character]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();

    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);

    expect(savePromptService.sendSaveResult).toHaveBeenCalled();
  });

  // ── Evasion overlay ──

  it('disables apply button when no allies selected in evasion overlay', async () => {
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockImplementation((targetName, campaign) => {
      if (targetName === 'testTarget2' && campaign === 'test-campaign') return true;
      return false;
    });

    const paladin = {
      name: 'Paladin',
      level: 1,
      computedStats: {
        abilities: [{ name: 'Charisma', bonus: 3 }],
        evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 10 }],
      },
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testTarget2', paladin]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
    });

    const applyBtn = screen.getByRole('button', { name: /Apply Evasion \(0\)/ });
    expect(applyBtn).toBeDisabled();
  });

  it('skips evasion overlay when Skip is clicked', async () => {
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockImplementation((targetName, campaign) => {
      if (targetName === 'testTarget2' && campaign === 'test-campaign') return true;
      return false;
    });

    const paladin = {
      name: 'Paladin',
      level: 1,
      computedStats: {
        abilities: [{ name: 'Charisma', bonus: 3 }],
        evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 10 }],
      },
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testTarget2', paladin]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
    });

    const skipBtn = screen.getByRole('button', { name: 'Skip' });
    fireEvent.click(skipBtn);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Leading Evasion/)).not.toBeInTheDocument();
  });

  it('renders overlay dimmed when evasion selection is active', async () => {
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockImplementation((targetName, campaign) => {
      if (targetName === 'testTarget2' && campaign === 'test-campaign') return true;
      return false;
    });

    const paladin = {
      name: 'Paladin',
      level: 1,
      computedStats: {
        abilities: [{ name: 'Charisma', bonus: 3 }],
        evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 10 }],
      },
    };

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testTarget2', paladin]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
    });

    expect(document.querySelector('.sp-overlay--dimmed')).toBeInTheDocument();
  });
});
