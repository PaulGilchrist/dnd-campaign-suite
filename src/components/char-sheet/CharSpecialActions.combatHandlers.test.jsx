// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { applyPortentChoice } from '../../services/automation/handlers/class-wizard/portentHandler.js';
import { applyTargetChoice } from '../../services/automation/handlers/combat/destructiveStrideHandler.js';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';

const basePlayerStats = {
  name: 'TestCharacter',
  specialActions: [],
  class: {
    fightingStyles: [],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 2,
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function createSpecialAction(name, automation) {
  return { name, description: `${name} description.`, automation };
}

describe('CharSpecialActions - Destructive Stride', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe('handleDestructiveStrideConfirm', () => {
    it('opens destructive stride target modal when result is modal', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'destructiveStride',
        payload: {
          action: { name: 'Destructive Stride' },
          playerStats: createPlayerStats(),
          campaignName: 'test',
          chosenType: 'bludgeoning',
          martialArtsDie: '1d6',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Destructive Stride', { type: 'destructive_stride' }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      expect(executeHandler).not.toHaveBeenCalled();

      fireEvent.click(screen.getAllByText(/Destructive Stride/)[0]);

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getByTestId('destructive-stride-modal')).toBeInTheDocument();
      });

      expect(within(screen.getByTestId('destructive-stride-modal')).getByText('Destructive Stride')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Confirm Target'));

      await waitFor(() => {
        expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument();
      });
    });

    it('shows popup when result is popup', async () => {
      const mockSetPopupHtml = vi.fn();
      vi.mocked((await import('../../hooks/combat/DiceRollContext.js')).useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'destructiveStride',
        payload: {
          action: { name: 'Destructive Stride' },
          playerStats: createPlayerStats(),
          campaignName: 'test',
          chosenType: 'piercing',
          martialArtsDie: '1d4',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Destructive Stride', { type: 'destructive_stride' }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Destructive Stride/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('destructive-stride-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm Popup'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Destructive Stride');
      expect(popupCall).toContain('Struck target.');
      expect(screen.queryByTestId('destructive-stride-modal')).not.toBeInTheDocument();
    });
  });

  describe('handleDestructiveStrideTargetConfirm', () => {
    it('calls applyTargetChoice and shows popup on result', async () => {
      const mockSetPopupHtml = vi.fn();
      vi.mocked((await import('../../hooks/combat/DiceRollContext.js')).useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'destructiveStride',
        payload: {
          action: { name: 'Destructive Stride' },
          playerStats: createPlayerStats(),
          campaignName: 'test',
          chosenType: 'bludgeoning',
          martialArtsDie: '1d6',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Destructive Stride', { type: 'destructive_stride' }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Destructive Stride/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('destructive-stride-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm Target'));

      await waitFor(() => {
        expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Strike'));

      await waitFor(() => {
        expect(applyTargetChoice).toHaveBeenCalledOnce();
      });

      expect(mockSetPopupHtml).toHaveBeenCalled();
      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Destructive Stride');
      expect(popupCall).toContain('Struck target.');
    });
  });
});

describe('CharSpecialActions - Moonlight Step Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe('handleMoonlightStepFallbackConfirm', () => {
    it('renders the moonlight step fallback modal with correct slot level and handles user choice', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'moonlightStepFallback',
        payload: {
          action: { name: 'Moonlight Step' },
          playerStats: createPlayerStats(),
          campaignName: 'test',
          slotLevel: 3,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Moonlight Step', { type: 'teleport', effect: 'moonlight_step_teleport' }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Moonlight Step/)[0]);

      await waitFor(() => {
        expect(screen.getByText(/Consume a level 3 spell slot to use Moonlight Step/)).toBeInTheDocument();
        expect(screen.getByText('Yes, Consume Slot')).toBeInTheDocument();
        expect(screen.getByText('No')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('No'));

      await waitFor(() => {
        expect(screen.queryByText(/Consume a level 3 spell slot to use Moonlight Step/)).not.toBeInTheDocument();
      });
    });
  });
});

describe('CharSpecialActions - Portent Die Choice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe('handlePortentDieChoice', () => {
    it('calls applyPortentChoice and shows popup on result', async () => {
      const mockSetPopupHtml = vi.fn();
      vi.mocked((await import('../../hooks/combat/DiceRollContext.js')).useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'portentDiceChoice',
        payload: {
          action: { name: 'Portent' },
          playerStats: createPlayerStats(),
          campaignName: 'test',
          targetName: 'Orc',
          eventType: 'save',
          eventData: { d20: 10, bonus: 2, saveType: 'Dexterity' },
          context: {},
          diceOptions: [5, 15],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Portent', { type: 'portent' }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Portent/)[0]);

      await waitFor(() => {
        expect(screen.getByText('Orc')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('5'));

      await waitFor(() => {
        expect(applyPortentChoice).toHaveBeenCalledOnce();
      });

      expect(applyPortentChoice).toHaveBeenCalledWith({
        action: expect.objectContaining({ name: 'Portent' }),
        playerStats: expect.any(Object),
        campaignName: 'test',
        targetName: 'Orc',
        eventType: 'save',
        eventData: expect.objectContaining({ d20: 10, bonus: 2, saveType: 'Dexterity' }),
        context: expect.any(Object),
        chosenDie: 5,
      });

      expect(mockSetPopupHtml).toHaveBeenCalled();
      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Portent');
      expect(popupCall).toContain('Die applied');
    });

    it('handles error in applyPortentChoice by closing modal', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Portent', { type: 'portent' }),
        ],
      });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'portentDiceChoice',
        payload: {
          action: { name: 'Portent' },
          playerStats: createPlayerStats(),
          campaignName: 'test',
          targetName: 'Troll',
          eventType: 'attack',
          eventData: { d20: 18, bonus: 5, targetName: 'Troll', hit: true },
          context: {},
          diceOptions: [3, 8],
        },
      });

      applyPortentChoice.mockRejectedValue(new Error('Portent failed'));

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Portent/)[0]);

      await waitFor(() => {
        expect(screen.getByText('Troll')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('3'));

      await waitFor(() => {
        expect(screen.queryByText('Troll')).not.toBeInTheDocument();
      });
    });
  });
});

// @cleaned-by-ai
// Stride of the Elements, Elemental Epitome, and cannotAct guard tests
// removed: fully covered by elementalEffects.test.jsx (more thorough assertions)
// and modals.test.jsx (parametrized cannotAct test). No behavioral gap.
