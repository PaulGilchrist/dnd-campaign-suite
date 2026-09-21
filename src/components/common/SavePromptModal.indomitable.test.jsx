// CLA-195 regression: SavePromptModal must offer an "Indomitable (+N)" reroll
// on a failed save for a fighter with the Indomitable save-reroll modifier,
// consume indomitableUses, and hide the button at the per-long-rest max.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, rollD20: vi.fn(), rollExpression: vi.fn() }
});

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 5),
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
      React.createElement('button', { 'data-testid': 'subscriber-trigger-wis', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false } }) }),
    );
  }
  return { default: MockSubscriber };
});

// ── Fixtures ──

const indomitableModifier = {
  source: 'Indomitable',
  target: 'saving_throw',
  condition: '',
  effect: 'reroll',
  bonusExpression: 'fighter_level',
  oncePerRage: false,
};

function createFighter(name, level) {
  return {
    name,
    level,
    class: { name: 'Fighter', class_levels: [] },
    computedStats: {
      level,
      abilities: [{ name: 'Wisdom', bonus: 5 }],
      evasionEffects: [],
      automation: { passives: [] },
      saveModifiers: [indomitableModifier],
    },
    saveModifiers: [indomitableModifier],
  };
}

function mockRuntime({ uses = 0 } = {}) {
  getRuntimeValue.mockImplementation((name, key, campaign) => {
    if (key === 'activeBuffs' && campaign === 'test-campaign') return [];
    if (key === 'activeConditions' && campaign === 'test-campaign') return [];
    if (key === 'fanaticalFocusUsed' && campaign === 'test-campaign') return false;
    if (key === 'indomitableUses' && campaign === 'test-campaign') return uses;
    return null;
  });
}

async function rollAndFailSave() {
  fireEvent.click(screen.getByTestId('subscriber-trigger-wis'));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
  });
}

describe('SavePromptModal — Indomitable reroll (CLA-195)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  it('shows Indomitable (+18) after a failed save and consumes a use on click', async () => {
    rollD20.mockReturnValueOnce(1).mockReturnValue(15);
    mockRuntime({ uses: 0 });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[createFighter('testTarget', 18)]}
        activeMapName={null}
      />
    );

    await rollAndFailSave();

    const rerollBtn = screen.getByRole('button', { name: /Indomitable \(\+18\)/ });
    fireEvent.click(rerollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'indomitableUses', 1, 'test-campaign');
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-wis',
      success: true,
      bonusDetail: '(+18 Indomitable)',
    }));
  });

  it('does not show the Indomitable button once max uses (3 at lv18) are spent', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ uses: 3 });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[createFighter('testTarget', 18)]}
        activeMapName={null}
      />
    );

    await rollAndFailSave();

    expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
  });

  it('does not show the Indomitable button for characters without the feature', async () => {
    rollD20.mockReturnValue(1);
    mockRuntime({ uses: 0 });
    const nonFighter = createFighter('testTarget', 18);
    nonFighter.saveModifiers = [];
    nonFighter.computedStats.saveModifiers = [];

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[nonFighter]}
        activeMapName={null}
      />
    );

    await rollAndFailSave();

    expect(screen.queryByRole('button', { name: /Indomitable/ })).not.toBeInTheDocument();
  });
});
