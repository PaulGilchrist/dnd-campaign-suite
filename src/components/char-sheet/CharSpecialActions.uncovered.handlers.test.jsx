//
// CLEANING SUMMARY:
//
// Removed:
//   - "shows popup when no targets selected" — redundant with
//     CharSpecialActions.handlers.test.jsx (Encouraging Song skip popup test
//     uses identical skip→popup assertion pattern) and
//     CharSpecialActions.modalsInline.test.jsx (Celestial Resilience skip
//     modal-close test). No unique behavioral gap.
//
//   - "shows popup and closes modal when skip is clicked" — exact duplicate of
//     CharSpecialActions.modalsInline.test.jsx Celestial Resilience skip test
//     (same setup: executeHandler mock → click skip → assert popup + modal
//     closed). No behavioral gap.
//
//   - "does not call setTempHp or addEntry when no targets selected" —
//     negative assertion duplicate consolidated into the skip test below.
//
//   - "does not call setTempHp or addEntry on skip" — negative assertion
//     duplicate consolidated into the skip test below.
//
// Consolidated:
//   - The two skip tests (popup + close + negative assertions) merged into a
//     single "skipping selects no allies" test covering: popup shown, modal
//     closed, setTempHp not called, addEntry not called.
//
// Kept:
//   - "grants temp HP to selected targets and shows popup" — full happy-path
//     coverage (modal open → confirm → setTempHp calls → log entry → popup).
//     Critical behavioral coverage.
//
//   - "cannotAct guard" — unique behavioral coverage for the cannotAct early
//     return path. No other test verifies this guard.
//
//   - "shows popup with single target name" — tests specific popup content
//     variation (single target, different HP amount). Validates the popup
//     formatting path with different parameters.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js';
import { addEntry } from '../../services/ui/logService.js';
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

describe('CharSpecialActions - Celestial Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
  });

  describe('handleCelestialResilienceConfirm', () => {
    it('grants temp HP to selected targets and shows popup', async () => {
      let capturedPopup = null;
      vi.mocked(useDiceRollPopup).mockReturnValue({
        setPopupHtml: (html) => { capturedPopup = html; },
      });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'celestialResilienceModal',
        payload: {
          action: { name: 'Celestial Resilience' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }],
          maxTargets: 5,
          selfTempHp: 5,
          allyTempHp: 3,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Celestial Resilience', description: 'Gain temp HP and grant to allies.', automation: { type: 'generic' } },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Celestial Resilience/));

      await waitFor(() => {
        expect(screen.getByTestId('creature-selection-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Grant Resilience'));

      await waitFor(() => {
        expect(setTempHp).toHaveBeenCalledWith('Ally1', 3, 'test');
        expect(setTempHp).toHaveBeenCalledWith('Ally2', 3, 'test');
      });

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCharacter',
          abilityName: 'Celestial Resilience',
          description: expect.stringContaining('grants 3 temporary hit points to Ally1, Ally2'),
        }));
      });

      expect(capturedPopup).toContain('Celestial Resilience');
      expect(capturedPopup).toContain('3 temporary hit points');
      expect(capturedPopup).toContain('Ally1');
      expect(capturedPopup).toContain('Ally2');
    });

    it('shows popup with single target name', async () => {
      let capturedPopup = null;
      vi.mocked(useDiceRollPopup).mockReturnValue({
        setPopupHtml: (html) => { capturedPopup = html; },
      });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'celestialResilienceModal',
        payload: {
          action: { name: 'Celestial Resilience' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          creatureTargets: [{ name: 'SoloAlly' }],
          maxTargets: 5,
          selfTempHp: 5,
          allyTempHp: 7,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Celestial Resilience', description: 'Gain temp HP.', automation: { type: 'generic' } },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Celestial Resilience/));

      await waitFor(() => {
        expect(screen.getByTestId('creature-selection-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Grant Resilience'));

      await waitFor(() => {
        expect(setTempHp).toHaveBeenCalledWith('SoloAlly', 7, 'test');
      });

      expect(capturedPopup).toContain('SoloAlly');
      expect(capturedPopup).toContain('7 temporary hit points');
    });
  });

  describe('handleCelestialResilienceSkip', () => {
    it('skipping selects no allies shows popup, closes modal, and calls no side effects', async () => {
      let capturedPopup = null;
      vi.mocked(useDiceRollPopup).mockReturnValue({
        setPopupHtml: (html) => { capturedPopup = html; },
      });

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'celestialResilienceModal',
        payload: {
          action: { name: 'Celestial Resilience' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          creatureTargets: [{ name: 'Ally1' }],
          maxTargets: 5,
          selfTempHp: 5,
          allyTempHp: 3,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Celestial Resilience', description: 'Gain temp HP.', automation: { type: 'generic' } },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Celestial Resilience/));

      await waitFor(() => {
        expect(screen.getByTestId('creature-selection-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Skip'));

      await waitFor(() => {
        expect(capturedPopup).toContain('No allies selected');
        expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        expect(setTempHp).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });
    });
  });

  describe('cannotAct guard for Celestial Resilience', () => {
    it('does not open celestial resilience modal when cannotAct is true', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'celestialResilienceModal',
        payload: {
          action: { name: 'Celestial Resilience' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          creatureTargets: [{ name: 'Ally1' }],
          maxTargets: 5,
          selfTempHp: 5,
          allyTempHp: 3,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Celestial Resilience', description: 'Gain temp HP.', automation: { type: 'generic' } },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Celestial Resilience/));

      await waitFor(() => {
        expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
      });

      expect(setTempHp).not.toHaveBeenCalled();
    });
  });
});
