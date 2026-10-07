// CLA-211: Leading Evasion — chooser selection must be persisted (runtime stamp
// keyed by promptId) and adjudication must fold ONLY the ticked allies:
// ticked sharee folds, unselected control pays full, Skip grants nobody.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { stampLeadingEvasionSelections, clearLeadingEvasionSelection } from '../../services/rules/combat/evasionUtils.js';
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
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

vi.mock('../../services/rules/combat/evasionUtils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    stampLeadingEvasionSelections: vi.fn(),
    clearLeadingEvasionSelection: vi.fn(),
  };
});

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const t = (id, name, testId) => (
      <button
        data-testid={`trigger-${testId}`}
        onClick={() => handleEvent({
          key: `change-${campaignName}-savePrompt-${name}`,
          data: { promptId: id, targetName: name, saveType: 'DEX', saveDc: 16, disadvantage: false, dcSuccess: 'half', sourceName: 'Lightning Breath' },
        })}
      >t</button>
    );
    return (
      <div data-testid="subscriber">
        {t('p-hex', 'HexWarlock', 'hex')}
        {t('p-pal', 'ElderPaladin', 'pal')}
        {t('p-bard', 'Bard', 'bard')}
      </div>
    );
  }
  return { default: MockSubscriber };
});

const BARD = { name: 'Bard', computedStats: { abilities: [], evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 5 }] }, saveModifiers: [] };
const HEX = { name: 'HexWarlock', computedStats: { abilities: [], evasionEffects: [] }, saveModifiers: [] };
const PAL = { name: 'ElderPaladin', computedStats: { abilities: [], evasionEffects: [] }, saveModifiers: [] };

function rollSubmit(name) {
  fireEvent.click(screen.getByTestId(`trigger-${name}`));
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
}

function submit(promptName, buttonName) {
  fireEvent.click(screen.getByRole('button', { name: buttonName || 'Done' }));
  void promptName;
}

describe('SavePromptModal — CLA-211 Leading Evasion chooser', () => {
  let dispatched = [];
  const onSaveResult = (e) => dispatched.push(e.detail);

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    rollD20.mockReturnValue(10);
    dispatched = [];
    window.addEventListener('save-result', onSaveResult);
  });
  afterEach(() => {
    window.removeEventListener('save-result', onSaveResult);
    cleanupDefaults();
  });

  it('chooser confirm stamps the ticked prompt and the ticked ally folds; stamp cleared after submit', async () => {
    render(<SavePromptModal campaignName="test-campaign" characters={[BARD, HEX, PAL]} activeMapName={null} />);

    fireEvent.click(screen.getByTestId('trigger-hex'));
    await waitFor(() => expect(screen.getByText(/Leading Evasion — Choose Allies/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Apply Evasion \(1\)/i }));

    expect(stampLeadingEvasionSelections).toHaveBeenCalledWith('test-campaign', [['p-hex', ['HexWarlock']]]);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'automation',
      automationType: 'leading_evasion_shared',
    }));

    rollSubmit('hex');
    await waitFor(() => expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument());
    submit('hex');

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].targetName).toBe('HexWarlock');
    expect(dispatched[0].evasionActive).toBe(true);
    expect(clearLeadingEvasionSelection).toHaveBeenCalledWith('test-campaign', 'p-hex');
  });

  it('SKIP declines the share: no stamp, declined logged, unselected target pays full (evasionActive false)', async () => {
    render(<SavePromptModal campaignName="test-campaign" characters={[BARD, HEX, PAL]} activeMapName={null} />);

    fireEvent.click(screen.getByTestId('trigger-pal'));
    await waitFor(() => expect(screen.getByText(/Leading Evasion — Choose Allies/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(stampLeadingEvasionSelections).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'automation',
      automationType: 'leading_evasion_declined',
    }));

    rollSubmit('pal');
    await waitFor(() => expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument());
    submit('pal');

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].targetName).toBe('ElderPaladin');
    expect(dispatched[0].evasionActive).toBe(false);
  });

  it('the holder itself folds own Evasion with no chooser', async () => {
    render(<SavePromptModal campaignName="test-campaign" characters={[BARD, HEX, PAL]} activeMapName={null} />);

    fireEvent.click(screen.getByTestId('trigger-bard'));
    await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());
    expect(screen.queryByText(/Leading Evasion — Choose Allies/i)).not.toBeInTheDocument();

    rollSubmit('bard');
    await waitFor(() => expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument());
    submit('bard');

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].evasionActive).toBe(true);
  });
});
