// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeathSavingThrows from './DeathSavingThrows.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
  clearDeathSavePrompt: vi.fn(),
  sendDeathSavePrompt: vi.fn(),
  sendDeathSaveResult: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/deathSaveRules.js', () => ({
  isStable: vi.fn(() => false),
  isDead: vi.fn(() => false),
  rollDeathSave: vi.fn(),
  rollDeathSaveWithAdvantage: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(() => false),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js';

describe('DeathSavingThrows', () => {
  const mockPlayerStats = {
    name: 'Test Character',
  };

  const mockCampaignName = 'test-campaign';

  const defaultRollResult = {
    roll: 15,
    result: 'success',
    isNat20: false,
    isNat1: false,
    newSaves: [true, false, false],
    newFailures: [false, false, false],
    restoredToHp: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult);
    deathSaveRules.rollDeathSaveWithAdvantage.mockReturnValue(defaultRollResult);
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: vi.fn() }));
  });

  describe('rendering', () => {
    it('renders the death saves title', () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Death Saves')).toBeInTheDocument();
    });

    it('renders filled circles for recorded successes and failures', () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'deathSaves') return [true, true, false];
        if (prop === 'deathFailures') return [true, true, true];
        return null;
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      const successTrack = screen.getByText(/Successes:/).parentElement;
      const failureTrack = screen.getByText(/Failures:/).parentElement;
      expect(successTrack.textContent).toContain('⬤⬤◯');
      expect(failureTrack.textContent).toContain('⬤⬤⬤');
    });

    it('renders Stable or Dead indicator and hides roll button when stable or dead', () => {
      deathSaveRules.isStable.mockReturnValue(true);
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Stable')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();

      deathSaveRules.isStable.mockReturnValue(false);
      deathSaveRules.isDead.mockReturnValue(true);
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Dead')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();

      deathSaveRules.isStable.mockReturnValue(false);
      deathSaveRules.isDead.mockReturnValue(false);
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.queryByRole('button', { name: /roll/i })).toBeInTheDocument();
    });
  });

  describe('rolling death saves', () => {
    it.each([
      ['success', 'Success', { result: 'success', newSaves: [true, false, false], newFailures: [false, false, false] }],
      ['failure', 'Failure', { result: 'failure', newSaves: [false, false, false], newFailures: [true, false, false] }],
    ])('updates %s circles and result label after a roll', async (_label, resultLabel, rollOverride) => {
      deathSaveRules.rollDeathSave.mockReturnValue({ ...defaultRollResult, ...rollOverride });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        const successTrack = screen.getByText(/Successes:/).parentElement;
        const failureTrack = screen.getByText(/Failures:/).parentElement;
        expect(rollOverride.newSaves[0] ? successTrack.textContent : failureTrack.textContent).toContain('⬤◯◯');
        expect(screen.getByText(resultLabel)).toBeInTheDocument();
      });
    });

    it.each([
      ['NAT 20', { roll: 20, result: 'nat20', isNat20: true, restoredToHp: 1 }],
      ['NAT 1', { roll: 1, result: 'failure', isNat1: true, newFailures: [true, true, false] }],
    ])('shows %s indicator on a natural %s roll', async (_label, _nat) => {
      deathSaveRules.rollDeathSave.mockReturnValue({ ...defaultRollResult, ..._nat });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(screen.getByText(_label)).toBeInTheDocument();
      });
    });
  });

  describe('custom event handling', () => {
    it('updates saves and failures from a death-save-result event for this character', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'deathSaves') return [false, false, false];
        if (prop === 'deathFailures') return [false, false, false];
        return null;
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent('death-save-result', {
            detail: {
              targetName: 'Test Character',
              roll: 18,
              success: true,
              isNat20: false,
              isNat1: false,
              newSaves: [true, true, false],
              newFailures: [false, false, false],
            },
          })
        );
      });

      const successTrack = screen.getByText(/Successes:/).parentElement;
      expect(successTrack.textContent).toContain('⬤⬤◯');
    });

    it('ignores a death-save-result event for a different character', () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'deathSaves') return [true, false, false];
        if (prop === 'deathFailures') return [false, false, false];
        return null;
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);

      window.dispatchEvent(
        new CustomEvent('death-save-result', {
          detail: {
            targetName: 'Other Character',
            roll: 20,
            success: true,
            isNat20: true,
            isNat1: false,
            newSaves: [true, true, true],
            newFailures: [true, true, true],
          },
        })
      );

      const successTrack = screen.getByText(/Successes:/).parentElement;
      expect(successTrack.textContent).toContain('⬤◯◯');
    });
  });
});
