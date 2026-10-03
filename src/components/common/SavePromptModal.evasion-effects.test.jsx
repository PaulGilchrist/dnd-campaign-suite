// @improved-by-ai
// @cleaned-by-ai
// SavePromptModal — Evasion Effects (Beacon of Hope, Cosmic Omen, Disadvantage, Force Roll)
// Tests behavioral outcomes of evasion effects on save resolution.
//
// Cleanup (@cleaned-by-ai):
//   - Removed "dispatches save-result custom event with evasion details" — duplicate of actions.test.jsx
//   - Removed "applies disadvantage for DEX saves when target is charmed" — duplicate of rolling.test.jsx
//   - Removed "applies disadvantage for DEX saves when target has Otto's Irresistible Dance" — duplicate of rolling.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
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
      React.createElement('button', { 'data-testid': 'subscriber-trigger-wis', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false, dcSuccess: 'half' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-dex', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17, disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame' } }) }),
    );
  }
  return { default: MockSubscriber };
});

describe('SavePromptModal — Evasion Effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Beacon of Hope advantage ──

  // SP-014: beacon te lives at CAMPAIGN ROOT targetEffects (producers write
  // setRuntimeValue('campaign','targetEffects',…)); pins were inverted from the
  // broken per-characters probe to the root channel with te.target matching.
  it('grants advantage on WIS saves when beacon_of_hope root targetEffect is active', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
      },
      saveModifiers: [],
    };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects' && name === 'campaign') {
        return [{ target: 'testTarget', effect: 'beacon_of_hope', caster: 'testCaster', duration: 'concentration' }];
      }
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-wis');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/Advantage/)).toBeInTheDocument();
    });

    // Advantage rolls two d20s and keeps the highest
    expect(rollD20).toHaveBeenCalledTimes(2);
  });

  // ── Cosmic Omen ──

  it('applies cosmic omen bonus to save total and clears pending bonus', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'cosmicOmenPendingBonus') return JSON.stringify({ type: 'Weal', value: 2 });
      return null;
    });

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

    // Verify the weal bonus is displayed in the breakdown
    expect(screen.getByText(/2 from Weal/i)).toBeInTheDocument();
    // Verify the pending bonus was cleared after use
    expect(setRuntimeValue).toHaveBeenCalledWith('cosmicOmen', 'cosmicOmenPendingBonus', null, 'test-campaign', true);
    // Normal roll (no advantage/disadvantage) = single d20
    expect(rollD20).toHaveBeenCalledTimes(1);
  });

  // ── Beacon of Hope does NOT grant advantage on non-WIS saves ──

  it('does not grant beacon_of_hope advantage on non-WIS saves', async () => {
    rollD20.mockReturnValue(15);
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
      },
      saveModifiers: [],
    };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects' && name === 'campaign') {
        return [{ target: 'testTarget', effect: 'beacon_of_hope', caster: 'testCaster', duration: 'concentration' }];
      }
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-dex');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    // Normal roll (no advantage) = single d20
    expect(rollD20).toHaveBeenCalledTimes(1);
  });

  // ── Beacon of Hope does NOT cross-grant to un-beaconed targets ──

  it('does not grant advantage when root beacon_of_hope te targets another creature', async () => {
    rollD20.mockReturnValue(15);
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
      },
      saveModifiers: [],
    };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects' && name === 'campaign') {
        return [{ target: 'someoneElse', effect: 'beacon_of_hope', caster: 'testCaster', duration: 'concentration' }];
      }
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
        activeMapName={null}
      />
    );

    fireEvent.click(screen.getByTestId('subscriber-trigger-wis'));

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    // Normal roll (no advantage) = single d20
    expect(rollD20).toHaveBeenCalledTimes(1);
  });

  // ── Cosmic Omen: Weal vs Woe ──

  it('applies negative cosmic omen bonus for Woe type', async () => {
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'cosmicOmenPendingBonus') return JSON.stringify({ type: 'Woe', value: 3 });
      return null;
    });

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

    // Woe should show as negative bonus
    expect(screen.getByText(/3 from Woe/i)).toBeInTheDocument();
    expect(setRuntimeValue).toHaveBeenCalledWith('cosmicOmen', 'cosmicOmenPendingBonus', null, 'test-campaign', true);
  });

});
