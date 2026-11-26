// @maintained-by-ai 2026-11-24
// Regression: the Evasion note's SHARED branch must answer the SAME CLA-211
// per-target predicate the adjudication answers — the leadingEvasionSelections
// promptId stamp — never the retired blanket "a shareable holder exists in the
// roster" presence test. Live bug (filed 2026-11-24): after the GM Skipped the
// Leading Evasion chooser (log: leading_evasion_declined, "every unselected
// target pays normal save damage"), the armed prompt STILL read
// "Evasion: No damage on success, half damage on failure" while the Results
// face honestly paid the half. Pins, on the note itself:
//   1. Skip → plain "Half damage on successful save" (no Evasion note), and
//      the save dispatches evasionActive:false — note and payment agree.
//   2. A target stamped as SELECTED for its prompt keeps the Evasion note.
//   3. A stamp for ANOTHER prompt never lights this prompt's note.
//   4. The holder's own-Evasion branch is untouched (no chooser, no stamp).
//   5. An incapacitated target loses the note even when selected.
// Adjudication-lane folding itself stays pinned in
// saveProcessing.cla211-leading-evasion.test.js and evasionUtils.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { LEADING_EVASION_KEY } from '../../services/rules/combat/evasionUtils.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

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
  useRuntimeValue: vi.fn(() => null),
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

// One DEX DC 16 half-damage prompt per creature, delivered through the real
// handleEvent like production SSE. The stamp routed through the mocked
// getRuntimeValue below stands in for the chooser-confirm write (the real
// setRuntimeValue store is mocked out in this lane).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, targetName, promptId) => (
      <button
        data-testid={`trigger-${testId}`}
        onClick={() => handleEvent({
          key: `change-${campaignName}-savePrompt-${targetName}`,
          data: { promptId, targetName, saveType: 'DEX', saveDc: 16, disadvantage: false, dcSuccess: 'half', sourceName: 'Lightning Breath' },
        })}
      >
        {targetName}
      </button>
    );
    return (
      <div data-testid="subscriber">
        {trigger('hex', 'HexWarlock', 'p-hex')}
        {trigger('pal', 'ElderPaladin', 'p-pal')}
        {trigger('bard', 'Bard', 'p-bard')}
      </div>
    );
  }
  return { default: MockSubscriber };
});

// Bard holds the shareable DEX evasion (the chooser TRIGGER still fires on its
// presence — CLA-211 kept that); HexWarlock and ElderPaladin are plain sharees.
const BARD = createCharacter('Bard', [], [{ saveType: 'DEX', shareable: true, shareRange: 5 }]);
const HEX = createCharacter('HexWarlock');
const PAL = createCharacter('ElderPaladin');

function renderModal() {
  return render(<SavePromptModal campaignName="test-campaign" characters={[BARD, HEX, PAL]} activeMapName={null} />);
}

async function openPrompt(testId) {
  fireEvent.click(screen.getByTestId(`trigger-${testId}`));
  await waitFor(() => {
    expect(screen.getByTestId('active-save-prompt')).toBeInTheDocument();
  });
}

function noteText() {
  return within(screen.getByTestId('active-save-prompt'));
}

describe('SavePromptModal — Evasion note gates on the CLA-211 selection stamp', () => {
  let dispatched = [];
  const onSaveResult = (event) => { dispatched.push(event.detail); };

  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    rollD20.mockReturnValue(10); // 10 + 3 vs DC 16 → deterministic FAILURE
    dispatched = [];
    window.addEventListener('save-result', onSaveResult);
  });
  afterEach(() => {
    window.removeEventListener('save-result', onSaveResult);
    cleanupDefaults();
  });

  it('Skip at the chooser: the note drops to the plain half-damage line and the save dispatches evasionActive:false', async () => {
    renderModal();
    await openPrompt('hex');
    await waitFor(() => {
      expect(screen.getByText(/Leading Evasion — Choose Allies/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => {
      expect(screen.queryByText(/Leading Evasion — Choose Allies/i)).not.toBeInTheDocument();
    });

    // The exact broken face: pre-fix the presence test printed the zero here.
    expect(noteText().getByText(/Half damage on successful save/i)).toBeInTheDocument();
    expect(noteText().queryByText(/Evasion:/i)).not.toBeInTheDocument();

    // Note and payment agree: the dispatched save carries no evasion.
    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual(expect.objectContaining({
      promptId: 'p-hex',
      targetName: 'HexWarlock',
      success: false,
      evasionActive: false,
    }));
  });

  it('a target selected for its own prompt keeps the Evasion note', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === LEADING_EVASION_KEY) return { 'p-hex': ['HexWarlock'] };
      return null;
    });

    renderModal();
    await openPrompt('hex');

    expect(noteText().getByText('Evasion: No damage on success, half damage on failure')).toBeInTheDocument();
    expect(noteText().queryByText(/Half damage on successful save/i)).not.toBeInTheDocument();
  });

  it('a stamp for another prompt never lights this target’s note', async () => {
    // HexWarlock was selected for p-hex; ElderPaladin's p-pal is NOT in the
    // stamp — presence of the holder AND of a live share must not promise it
    // a zero it will not get.
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === LEADING_EVASION_KEY) return { 'p-hex': ['HexWarlock'] };
      return null;
    });

    renderModal();
    await openPrompt('pal');

    expect(noteText().getByText(/Half damage on successful save/i)).toBeInTheDocument();
    expect(noteText().queryByText(/Evasion:/i)).not.toBeInTheDocument();
  });

  it('the holder’s own Evasion branch keeps the note with no chooser and no stamp', async () => {
    renderModal();
    await openPrompt('bard');
    expect(screen.queryByText(/Leading Evasion — Choose Allies/i)).not.toBeInTheDocument();

    expect(noteText().getByText('Evasion: No damage on success, half damage on failure')).toBeInTheDocument();
  });

  it('an incapacitated selected target falls back to the plain half-damage note', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === LEADING_EVASION_KEY) return { 'p-hex': ['HexWarlock'] };
      if (name === 'HexWarlock' && key === 'activeConditions') return ['incapacitated'];
      return null;
    });

    renderModal();
    await openPrompt('hex');

    expect(noteText().getByText(/Half damage on successful save/i)).toBeInTheDocument();
    expect(noteText().queryByText(/Evasion:/i)).not.toBeInTheDocument();
  });
});
