// CLA-034: Beguiling Twist conditional_advantage ("advantage on saving throws
// to avoid/end Charmed or Frightened") must key on the SAVE's own condition
// (prompt condition/saveConditions), never on the target merely having the
// condition active. Avoid half fired normal; unrelated saves were over-granted.
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
      // Fear-Ray style prompt: WIS save whose own saveConditions carry 'frightened'.
      React.createElement('button', { 'data-testid': 'prompt-frightened-save', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'cla034-fear', targetName: 'testTarget', saveType: 'WIS', saveDc: 12, disadvantage: false, isSpellDamage: true, saveConditions: ['frightened'] } }) }),
      // Frost-Ray style prompt: unrelated DEX save, no charmed/frightened saveConditions.
      React.createElement('button', { 'data-testid': 'prompt-dex-save', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'cla034-frost', targetName: 'testTarget', saveType: 'DEX', saveDc: 12, disadvantage: false, isSpellDamage: true } }) }),
      // condition-route prompt (SetConditionModal style): condition directly on payload.
      React.createElement('button', { 'data-testid': 'prompt-condition-route', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'cla034-cond', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false, condition: 'charmed' } }) }),
    );
  }
  return { default: MockSubscriber };
});

function beguilingHolder() {
  return {
    name: 'testTarget',
    level: 17,
    class: { class_levels: [] },
    computedStats: {
      abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Dexterity', bonus: 5 }],
      evasionEffects: [],
    },
    saveModifiers: [
      { source: 'Beguiling Twist', target: 'saving_throw', effect: 'advantage', condition: 'charmed', abilities: [], skills: [] },
      { source: 'Beguiling Twist', target: 'saving_throw', effect: 'advantage', condition: 'frightened', abilities: [], skills: [] },
    ],
  };
}

function renderModal(activeConditions) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeConditions') return activeConditions;
    return null;
  });
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={[beguilingHolder()]}
      activeMapName={null}
    />
  );
}

async function rollAndExpect(advantage) {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/Total:/i)).toBeInTheDocument();
  });
  expect(rollD20).toHaveBeenCalledTimes(advantage ? 2 : 1);
  const advLabel = screen.queryByText(/\(Advantage\)/);
  if (advantage) expect(advLabel).toBeInTheDocument();
  else expect(advLabel).not.toBeInTheDocument();
}

describe('SavePromptModal — CLA-034 Beguiling Twist conditional advantage', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(getAllyList).mockReturnValue([]);
  });
  afterEach(cleanupDefaults);

  it('AVOID half: advantage on a fresh frightened save when NOT yet frightened', async () => {
    rollD20.mockReturnValueOnce(13).mockReturnValueOnce(8);
    renderModal([]);
    fireEvent.click(screen.getByTestId('prompt-frightened-save'));
    await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());
    await rollAndExpect(true);
  });

  it('END half: advantage remains on re-saving while already frightened', async () => {
    rollD20.mockReturnValueOnce(14).mockReturnValueOnce(13);
    renderModal(['frightened']);
    fireEvent.click(screen.getByTestId('prompt-frightened-save'));
    await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());
    await rollAndExpect(true);
  });

  it('NO over-grant: unrelated DEX save stays normal while frightened is active', async () => {
    rollD20.mockReturnValueOnce(15);
    renderModal(['frightened']);
    fireEvent.click(screen.getByTestId('prompt-dex-save'));
    await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());
    await rollAndExpect(false);
  });

  it('condition-route prompt (condition:"charmed") grants advantage', async () => {
    rollD20.mockReturnValueOnce(13).mockReturnValueOnce(8);
    renderModal([]);
    fireEvent.click(screen.getByTestId('prompt-condition-route'));
    await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());
    await rollAndExpect(true);
  });

  it('NO advantage for holder whose saveModifiers have no matching save condition', async () => {
    rollD20.mockReturnValueOnce(15);
    getRuntimeValue.mockReturnValue(null);
    const holder = beguilingHolder();
    holder.saveModifiers = [{ source: 'Brave', target: 'saving_throw', effect: 'advantage', condition: 'frightened', abilities: [], skills: [] }];
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[holder]}
        activeMapName={null}
      />
    );
    fireEvent.click(screen.getByTestId('prompt-dex-save'));
    await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());
    await rollAndExpect(false);
  });
});
