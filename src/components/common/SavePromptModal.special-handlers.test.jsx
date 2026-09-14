  // @improved-by-ai
  // @cleaned-by-ai
  // SavePromptModal — Special Handlers (Bane on attacker, HP restoration, CombatSummary, Storage)
  //
  // Cleanup: Consolidated 2 redundant lastAttack storage tests into 1:
  //   - "updates combatSummary lastAttack when submitSaveResult is called with combatSummary" was
  //     a near-duplicate of "stores lastAttack when rolling a save with combatSummary present" —
  //     both test the same storage.set('lastAttack', ...) code path with different triggers but
  //     identical assertion shapes. Merged into a single test that verifies the core behavior.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
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
  computeAuraBonus: vi.fn().mockResolvedValue({ bonus: 0, sourceName: null }),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
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
      React.createElement('button', { 'data-testid': 'subscriber-trigger-attacker', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-attacker', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, attackerName: 'testAttacker' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-rawdamage', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-rd', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, rawDamage: 10, dcSuccess: 'half' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-rawdamage-none', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-rd-none', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, rawDamage: 10, dcSuccess: 'none' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-rawdamage-reroll', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-rd-reroll', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, rawDamage: 10, dcSuccess: 'half' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-saveconditions', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget5`, data: { promptId: 'test-prompt-saveconditions', targetName: 'testTarget5', saveType: 'str', saveDc: 19, disadvantage: false, dcSuccess: 'none', sourceName: 'Adult Bronze Dragon 1', rawDamage: 0, saveConditions: ['prone'] } }) }),
    );
  }
  return { default: MockSubscriber };
});

describe('SavePromptModal — Special Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Bane on attacker ──

  it('applies bane attacker bonus when attacker has bane_penalty', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key, _campaign) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { target: 'testTarget', effect: 'bane_penalty' },
        { target: 'testTarget', effect: 'bless_bonus' },
        { target: 'testTarget', effect: 'warding_bond', saveBonus: 1 },
        { target: 'testAttacker', effect: 'bane_penalty' },
      ];
      return null;
    });
    vi.mocked(rollExpression).mockReturnValue({ total: 3 });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-attacker');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Bane/i)).toBeInTheDocument();
  });

  // ── Storage: lastAttack with secondary formula ──

  it('stores lastAttack when rolling a save with combatSummary present', async () => {
    rollD20.mockReturnValue(15);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });

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

    expect(storage.set).toHaveBeenCalledWith('lastAttack', expect.objectContaining({
      rollType: 'save',
      saveType: 'con',
      saveDc: 12,
    }), 'test-campaign');
  });

  // MA-0079: quick-roll lastAttack keeps the saveConditions carried on the
  // AoE-prompt payload (Repulsion Breath) — previously always [].
  it('quick-roll lastAttack stamps saveConditions from the prompt payload', async () => {
    rollD20.mockReturnValue(11);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    fireEvent.click(screen.getByTestId('subscriber-trigger-saveconditions'));

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Half damage on successful save/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No damage on successful save/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(storage.set).toHaveBeenCalledWith('lastAttack', expect.objectContaining({
      saveType: 'str',
      saveDc: 19,
      saveConditions: ['prone'],
    }), 'test-campaign');
  });
});
