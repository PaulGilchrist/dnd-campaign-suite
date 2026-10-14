import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

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

describe('CharSpecialActions - Stride of the Elements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe('handleStrideConfirm', () => {
    it('sets activeBuffs with Ice Walk option and logs the action', async () => {
      mockRuntimeStore.activeBuffs = [];
      const mockSetPopupHtml = vi.fn();
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Stride of the Elements', description: 'Choose a stride option.', automation: { type: 'stride_of_the_elements' } },
        ],
      });

      vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'strideOfTheElements',
        payload: {
          action: { name: 'Stride of the Elements', automation: { type: 'stride_of_the_elements' } },
          playerStats: basePlayerStats,
          campaignName: 'test',
        },
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Stride of the Elements/));

      await waitFor(() => {
        expect(screen.getByTestId('stride-of-the-elements-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm Ice Walk'));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.arrayContaining([
          expect.objectContaining({ name: 'Stride of the Elements', effect: 'ice_walk' })
        ]), 'test');
      });

      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
        abilityName: 'Stride of the Elements',
        description: expect.stringContaining('Ice Walk'),
      }));

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Ice Walk');
      expect(popupCall).toContain('walk across and climb icy');
      expect(screen.queryByTestId('stride-of-the-elements-modal')).not.toBeInTheDocument();
    });

    it('sets activeBuffs with Fly Speed option', async () => {
      mockRuntimeStore.activeBuffs = [];
      const mockSetPopupHtml = vi.fn();
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Stride of the Elements', description: 'Choose a stride option.', automation: { type: 'stride_of_the_elements' } },
        ],
      });

      vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'strideOfTheElements',
        payload: {
          action: { name: 'Stride of the Elements' },
          playerStats: basePlayerStats,
          campaignName: 'test',
        },
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Stride of the Elements/));

      await waitFor(() => {
        expect(screen.getByTestId('stride-of-the-elements-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm Fly'));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.arrayContaining([
          expect.objectContaining({ name: 'Stride of the Elements', effect: 'fly_speed' })
        ]), 'test');
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Fly Speed');
      expect(popupCall).toContain('Fly Speed equal to your Speed');
    });

    it('updates existing Stride of the Elements buff when one already exists', async () => {
      mockRuntimeStore.activeBuffs = [
        { name: 'Stride of the Elements', effect: 'ice_walk' }
      ];
      const mockSetPopupHtml = vi.fn();
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Stride of the Elements', description: 'Choose a stride option.', automation: { type: 'stride_of_the_elements' } },
        ],
      });

      vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'strideOfTheElements',
        payload: {
          action: { name: 'Stride of the Elements' },
          playerStats: basePlayerStats,
          campaignName: 'test',
        },
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Stride of the Elements/));

      await waitFor(() => {
        expect(screen.getByTestId('stride-of-the-elements-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm Speed'));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.arrayContaining([
          expect.objectContaining({ name: 'Stride of the Elements', effect: 'speed_boost' })
        ]), 'test');
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('+10 Speed');
    });

    // "does not trigger action when cannotAct is true" removed: redundant with
    // modals.test.jsx which has a parametrized cannotAct guard test covering
    // all interactive automation types. No behavioral gap.
  });
});

describe('CharSpecialActions - Elemental Epitome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe('handleEpitomeConfirm', () => {
    it('shows popup with action name and payload description', async () => {
      const mockSetPopupHtml = vi.fn();
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Elemental Epitome', description: 'Gain elemental resistance.', automation: { type: 'elemental_epitome' } },
        ],
      });

      vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'elementalEpitome',
        payload: {
          action: { name: 'Elemental Epitome' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          currentResistance: 'fire',
        },
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Elemental Epitome/));

      await waitFor(() => {
        expect(screen.getByTestId('elemental-epitome-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Elemental Epitome');
      expect(popupCall).toContain('Elemental Epitome activated.');
      expect(screen.queryByTestId('elemental-epitome-modal')).not.toBeInTheDocument();
    });
  });

  describe('handleEpitomeClose', () => {
    it('closes the epitome modal without showing popup', async () => {
      const mockSetPopupHtml = vi.fn();
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Elemental Epitome', description: 'Gain elemental resistance.', automation: { type: 'elemental_epitome' } },
        ],
      });

      vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'elementalEpitome',
        payload: {
          action: { name: 'Elemental Epitome' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          currentResistance: 'lightning',
        },
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Elemental Epitome/));

      await waitFor(() => {
        expect(screen.getByTestId('elemental-epitome-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('elemental-epitome-modal')).not.toBeInTheDocument();
      });

      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });
  });
});
