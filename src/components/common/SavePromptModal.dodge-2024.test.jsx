// BA-001 save lane: Dodge's "advantage on Dexterity saving throws" is a
// 2014-only clause. Under the 2024 ruleset Dodge grants attack-roll
// disadvantage against the dodger only — a 2024 character (e.g. LFH,
// rules='2024') taking a DEX save while dodging must roll plain (one d20,
// no Advantage marker). 5e targets keep the clause byte-identical.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getAllyList } from '../../hooks/useAllySelection.js';
import * as circleOfPowerHandler from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
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

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber' },
      React.createElement('button', {
        'data-testid': 'subscriber-trigger-dex',
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17, disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame' } }),
      })
    );
  }
  return { default: MockSubscriber };
});

function makeTargetChar(rules) {
  return {
    name: 'testTarget',
    level: 1,
    rules,
    class: { class_levels: [] },
    computedStats: {
      abilities: [{ name: 'Dexterity', bonus: 2 }],
      evasionEffects: [],
    },
    saveModifiers: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
  vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
  vi.mocked(getAllyList).mockReturnValue([]);
  rollD20.mockReturnValue(15);
  getRuntimeValue.mockImplementation((name, key) => {
    if (name === 'testTarget' && key === 'activeBuffs') return [{ name: 'Dodge', effect: 'dodge' }];
    return null;
  });
});
afterEach(cleanupDefaults);

async function rollDexSave(rules) {
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={[makeTargetChar(rules)]}
      activeMapName={null}
    />
  );
  fireEvent.click(screen.getByTestId('subscriber-trigger-dex'));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
}

describe('BA-001 SavePromptModal — Dodge save-lane ruleset gate', () => {
  it('does NOT grant DEX save advantage to a 2024-ruleset dodging target', async () => {
    await rollDexSave('2024');

    await waitFor(() => {
      expect(rollD20).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/Advantage/)).not.toBeInTheDocument();
  });

  it('still grants DEX save advantage to a 5e dodging target (byte-inert)', async () => {
    await rollDexSave('5e');

    await waitFor(() => {
      expect(rollD20).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText(/Advantage/)).toBeInTheDocument();
  });
});
