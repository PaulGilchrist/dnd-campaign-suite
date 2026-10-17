// @maintained-by-ai
// CharSpecialActions sheet-side elemental seam only: executeHandler and the modals are
// mocked via CharSpecialActions.modalMocks.jsx. Handler internals live in
// automation/handlers tests; modal internals in modals/*.test.jsx; chip-click→modal-open
// routing in CharSpecialActions.modals.test.jsx and open/close in
// CharSpecialActions.modalOnClose.elemental.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const STRIDE = {
  action: { name: 'Stride of the Elements', description: 'Choose a stride option.', automation: { type: 'stride_of_the_elements' } },
  modalName: 'strideOfTheElements',
  testId: 'stride-of-the-elements-modal',
};

const EPITOME = {
  action: { name: 'Elemental Epitome', description: 'Gain elemental resistance.', automation: { type: 'elemental_epitome' } },
  modalName: 'elementalEpitome',
  testId: 'elemental-epitome-modal',
};

// Renders the sheet with one special action, clicks its chip, waits for the modal
// to mount, and returns the captured setPopupHtml spy.
async function renderAndOpenModal({ action, modalName, testId }, payloadExtra = {}) {
  executeHandler.mockResolvedValue({
    type: 'modal',
    modalName,
    payload: { action, playerStats: { name: 'TestCharacter' }, campaignName: 'test', ...payloadExtra },
  });
  const setPopupHtml = vi.fn();
  vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml });

  const playerStats = {
    name: 'TestCharacter',
    specialActions: [action],
    class: { fightingStyles: [] },
    actions: [],
    bonusActions: [],
    reactions: [],
    characterAdvancement: [],
    proficiency: 2,
  };

  render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
  fireEvent.click(screen.getByText(new RegExp(action.name)));
  await waitFor(() => {
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });
  return setPopupHtml;
}

function strideBuffs() {
  return (mockRuntimeStore.activeBuffs || []).filter(b => b.name === 'Stride of the Elements');
}

describe('CharSpecialActions - Stride of the Elements: handleStrideConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  // Fresh-buff lane: choosing each stride option writes exactly one Stride buff
  // with the option's effect, logs the choice, pops the option's rules text,
  // and closes the modal.
  it.each([
    { button: 'Confirm Ice Walk', option: 'Ice Walk', effect: 'ice_walk', popupFragment: 'walk across and climb icy' },
    { button: 'Confirm Speed', option: '+10 Speed', effect: 'speed_boost', popupFragment: 'increases by 10 feet' },
    { button: 'Confirm Fly', option: 'Fly Speed', effect: 'fly_speed', popupFragment: 'Fly Speed equal to your Speed' },
    { button: 'Confirm Teleport', option: 'Teleport 30 ft', effect: 'teleport', popupFragment: 'teleport up to 30 ft' },
  ])('choosing $option writes the $effect buff, logs, and pops rules text', async ({ button, option, effect, popupFragment }) => {
    const setPopupHtml = await renderAndOpenModal(STRIDE);

    fireEvent.click(screen.getByText(button));

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.any(Array), 'test');
    });
    expect(strideBuffs()).toEqual([{ name: 'Stride of the Elements', effect }]);

    expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestCharacter',
      abilityName: 'Stride of the Elements',
      description: expect.stringContaining(`Chose ${option}`),
    }));

    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalled();
    });
    const popup = setPopupHtml.mock.calls[0][0];
    expect(popup).toContain('Stride of the Elements');
    expect(popup).toContain(option);
    expect(popup).toContain(popupFragment);
    expect(screen.queryByTestId(STRIDE.testId)).not.toBeInTheDocument();
  });

  // Update lane: an active stride is replaced in place (no duplicate, no stale
  // effect) and unrelated buffs keep their position.
  it('replaces an existing Stride buff in place, preserving other buffs', async () => {
    mockRuntimeStore.activeBuffs = [
      { name: 'Bless', effect: 'bless' },
      { name: 'Stride of the Elements', effect: 'ice_walk' },
    ];
    const setPopupHtml = await renderAndOpenModal(STRIDE);

    fireEvent.click(screen.getByText('Confirm Speed'));

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', [
        { name: 'Bless', effect: 'bless' },
        { name: 'Stride of the Elements', effect: 'speed_boost' },
      ], 'test');
    });
    expect(mockRuntimeStore.activeBuffs).toEqual([
      { name: 'Bless', effect: 'bless' },
      { name: 'Stride of the Elements', effect: 'speed_boost' },
    ]);
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('+10 Speed'));
    });
  });

  // "cannotAct blocks the action" removed: parametrized guard coverage lives in
  // modals.test.jsx — no behavioral gap here.
});

describe('CharSpecialActions - Elemental Epitome: handleEpitomeConfirm / handleEpitomeClose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  // Sheet-side contract: the real modal self-applies applyResistanceChoice
  // (ElementalEpitomeModal.test.jsx); the host confirm is popup-only — it must
  // not re-write activeBuffs or re-log (double-apply guard, CLA-113 pattern).
  it('Confirm shows the activation popup and closes without runtime writes or logging', async () => {
    const setPopupHtml = await renderAndOpenModal(EPITOME, { currentResistance: 'fire' });

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalled();
    });
    const popup = setPopupHtml.mock.calls[0][0];
    expect(popup).toContain('Elemental Epitome');
    expect(popup).toContain('Elemental Epitome activated.');
    expect(screen.queryByTestId(EPITOME.testId)).not.toBeInTheDocument();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('Close dismisses the modal without a popup', async () => {
    const setPopupHtml = await renderAndOpenModal(EPITOME, { currentResistance: 'lightning' });

    fireEvent.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByTestId(EPITOME.testId)).not.toBeInTheDocument();
    });
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
