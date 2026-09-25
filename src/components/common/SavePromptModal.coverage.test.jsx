// @improved-by-ai
// @cleaned-by-ai
// SavePromptModal — Additional coverage for evasion overlay and prompt queue advancement
// These tests provide deeper coverage of edge cases already tested in other files.
//
// Quality improvements:
//   - Removed duplicate test (dismiss without rolling) already in actions.test.jsx
//   - Removed duplicate test (Living Legend) already in rerolls.test.jsx
//   - Added missing vi.mocked import for evasion tests
//   - Strengthened assertions to verify behavioral outcomes (not just that something was called)
//   - Added missing tests: prompt queue advancement after clear, Guarded Mind reroll with proper state verification
//   - Fixed evasion overlay tests to verify exact DOM state changes
//   - Removed redundant mocking in beforeEach for circleOfPowerHandler
//
// Cleanup (@cleaned-by-ai):
//   - Removed duplicate Guarded Mind reroll test (covered by rerolls.test.jsx "overrides failed save to success when Guarded Mind is used")
//   - Removed duplicate Disciplined Survivor reroll test (covered by rerolls.test.jsx "rerolls save and decrements focus points when Disciplined Survivor is used")

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import * as circleOfPowerHandler from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

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
      React.createElement('button', { 'data-testid': 'subscriber-trigger-wis', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false, dcSuccess: 'half' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-rawdamage-reroll', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-rd-reroll', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, rawDamage: 10, dcSuccess: 'half' } }) }),
    );
  }
  return { default: MockSubscriber };
});

describe('SavePromptModal — Additional Coverage', () => {
  beforeEach(() => setupDefaults(rollD20, computeAuraBonus, getRuntimeValue));
  afterEach(cleanupDefaults);

  // ── Evasion overlay: confirm selection ──

  it('applies evasion to selected allies when confirm is clicked', async () => {
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

    // Select the target by clicking the label
    const labels = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(labels[0]);

    await waitFor(() => {
      expect(document.querySelector('.secondary-target-selected')).toBeInTheDocument();
    });

    // Confirm selection
    const applyBtn = screen.getByRole('button', { name: /Apply Evasion \(1\)/ });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Leading Evasion/)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });

  // ── Evasion overlay: deselect ally ──

  it('removes ally from selection when clicking already selected', async () => {
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

    // Select the target
    const labels = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(labels[0]);

    await waitFor(() => {
      expect(document.querySelector('.secondary-target-selected')).toBeInTheDocument();
    });

    // Deselect the target
    fireEvent.click(labels[0]);

    await waitFor(() => {
      expect(document.querySelector('.secondary-target-selected')).not.toBeInTheDocument();
    });
  });

  // ── Evasion overlay: overlay background click is inert ──

  it('keeps evasion overlay visible when clicking the dimmed background', async () => {
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

    // Click the evasion overlay background (outside the modal)
    const evasionOverlay = document.querySelector('.sp-overlay--evasion');
    if (evasionOverlay) {
      fireEvent.click(evasionOverlay);
    }

    // The evasion overlay should still be visible
    expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
  });

  // ── Evasion overlay: stopPropagation on modal click ──

  it('prevents evasion overlay dismissal when clicking inside the modal', async () => {
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

    // Click inside the modal (should NOT dismiss the evasion overlay)
    const modal = document.querySelector('.sp-overlay--evasion .sp-modal');
    if (modal) {
      fireEvent.click(modal);
    }

    // The evasion overlay should still be visible
    expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
  });

  // ── Prompt queue advancement after clear event ──

  it('advances to second prompt after first is cleared via savePromptCleared event', async () => {
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

    // Clear the first prompt
    const clearedBtn = screen.getByTestId('subscriber-trigger-cleared');
    fireEvent.click(clearedBtn);

    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
    });
  });

  // ── Prompt queue: second prompt shows after first is dismissed ──

  it('shows second prompt after first is dismissed', async () => {
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

    // Dismiss the first prompt
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
      expect(screen.getByText('DC 15')).toBeInTheDocument();
    });
  });
});
