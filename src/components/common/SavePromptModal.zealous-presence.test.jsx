// CLA-394: Zealous Presence buff (advantage_attacks_and_saves) must grant
// blanket saving-throw advantage in the SavePromptModal roll path.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

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

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber' },
      React.createElement('button', {
        'data-testid': 'subscriber-trigger-zealot-dex',
        onClick: () => handleEvent({
          key: `change-${campaignName}-savePrompt-zealotTarget`,
          data: { promptId: 'zp-1', targetName: 'zealotTarget', saveType: 'dex', saveDc: 12, disadvantage: false, dcSuccess: 'half', sourceName: 'Frost Ray' },
        }),
      })
    );
  }
  return { default: MockSubscriber };
});

describe('SavePromptModal — CLA-394 Zealous Presence save advantage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  function renderModal() {
    render(<SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger-zealot-dex'));
    return waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });
  }

  it('rolls 2d20 with advantage when the target carries the Zealous Presence buff', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'zealotTarget' && key === 'activeBuffs') {
        return [{ name: 'Zealous Presence', effect: 'advantage_attacks_and_saves' }];
      }
      return null;
    });
    rollD20.mockReturnValueOnce(4).mockReturnValueOnce(16);

    await renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));

    await waitFor(() => {
      expect(screen.getByText(/Advantage/i)).toBeInTheDocument();
    });
    expect(rollD20).toHaveBeenCalledTimes(2);
    // kept die 16 + bonus 3 = 19 >= DC 12
    expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
  });

  it('control: rolls a single d20 (normal mode) when the buff is absent', async () => {
    rollD20.mockReturnValue(15);

    await renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
  });
});
