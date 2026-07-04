// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js';
import { hasSaveModifier } from '../../../services/combat/conditions/conditionEffects.js';
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js';

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
    hasSaveModifier.mockReturnValue(false);
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: vi.fn() }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders the death saves title', () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Death Saves')).toBeInTheDocument();
    });

    it('renders empty circles for successes and failures when no saves recorded', () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      const successTrack = screen.getByText(/Successes:/).parentElement;
      const failureTrack = screen.getByText(/Failures:/).parentElement;
      expect(successTrack.textContent).toContain('◯◯◯');
      expect(failureTrack.textContent).toContain('◯◯◯');
    });

    it('renders filled circles for recorded successes', () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'deathSaves') return [true, true, false];
        if (prop === 'deathFailures') return [false, false, false];
        return null;
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      const successTrack = screen.getByText(/Successes:/).parentElement;
      expect(successTrack.textContent).toContain('⬤⬤◯');
    });

    it('renders filled circles for recorded failures', () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'deathSaves') return [false, false, false];
        if (prop === 'deathFailures') return [true, true, true];
        return null;
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      const failureTrack = screen.getByText(/Failures:/).parentElement;
      expect(failureTrack.textContent).toContain('⬤⬤⬤');
    });

    it('renders Stable indicator when three successes', () => {
      deathSaveRules.isStable.mockReturnValue(true);
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Stable')).toBeInTheDocument();
    });

    it('renders Dead indicator when three failures', () => {
      deathSaveRules.isStable.mockReturnValue(false);
      deathSaveRules.isDead.mockReturnValue(true);
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Dead')).toBeInTheDocument();
    });

    it('hides the roll button when the character is stable or dead', () => {
      deathSaveRules.isStable.mockReturnValue(true);
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    });

    it('shows the roll button when active', () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      expect(screen.getByRole('button', { name: /roll/i })).toBeInTheDocument();
    });
  });

  describe('rolling death saves', () => {
    it('calls rollDeathSave with correct arguments on roll button click', () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith(
        [false, false, false],
        [false, false, false],
        false
      );
    });

    it('calls rollDeathSaveWithAdvantage when player has death save advantage', () => {
      hasSaveModifier.mockReturnValue(true);
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      expect(hasSaveModifier).toHaveBeenCalledWith(mockPlayerStats.saveModifiers, 'death_saving_throws');
      expect(deathSaveRules.rollDeathSaveWithAdvantage).toHaveBeenCalled();
    });

    it('passes treat18AsNat20=true when automation has death_save_nat18_as_20 passive', () => {
      mockPlayerStats.automation = {
        passives: [{ type: 'passive_rule', effect: 'death_save_nat18_as_20' }],
      };
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith(
        [false, false, false],
        [false, false, false],
        true
      );
    });

    it('updates the save circles after a successful roll', async () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        const successTrack = screen.getByText(/Successes:/).parentElement;
        expect(successTrack.textContent).toContain('⬤◯◯');
      });
    });

    it('updates the failure circles after a failed roll', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        ...defaultRollResult,
        result: 'failure',
        newSaves: [false, false, false],
        newFailures: [true, false, false],
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        const failureTrack = screen.getByText(/Failures:/).parentElement;
        expect(failureTrack.textContent).toContain('⬤◯◯');
      });
    });

    it('shows a success result label after a successful roll', async () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
      });
    });

    it('shows a failure result label after a failed roll', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        ...defaultRollResult,
        result: 'failure',
        isNat20: false,
        isNat1: false,
        newSaves: [false, false, false],
        newFailures: [true, false, false],
        restoredToHp: null,
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(screen.getByText('Failure')).toBeInTheDocument();
      });
    });

    it('shows NAT 20 indicator on a natural 20 roll', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        ...defaultRollResult,
        roll: 20,
        result: 'nat20',
        isNat20: true,
        restoredToHp: 1,
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(screen.getByText('NAT 20')).toBeInTheDocument();
      });
    });

    it('shows NAT 1 indicator on a natural 1 roll', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        ...defaultRollResult,
        roll: 1,
        result: 'failure',
        isNat1: true,
        newFailures: [true, true, false],
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(screen.getByText('NAT 1')).toBeInTheDocument();
      });
    });
  });

  describe('state persistence', () => {
    it('saves death saves, failures, and HP to runtime state after a roll', async () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'deathSaves',
          [true, false, false],
          mockCampaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'deathFailures',
          [false, false, false],
          mockCampaignName
        );
      });
    });

    it('restores HP to currentHitPoints on natural 20', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        ...defaultRollResult,
        roll: 20,
        result: 'nat20',
        isNat20: true,
        restoredToHp: 1,
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'currentHitPoints',
          1,
          mockCampaignName
        );
      });
    });

    it('clears the death save prompt after a roll', async () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(clearDeathSavePrompt).toHaveBeenCalledWith(mockCampaignName, 'Test Character');
      });
    });
  });

  describe('campaign logging', () => {
    it('posts a death_save log entry to the campaign log endpoint', async () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/campaigns/${encodeURIComponent(mockCampaignName)}/log`,
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('includes character name, roll value, and success in the log entry', async () => {
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        const logCall = global.fetch.mock.calls.find((call) => call[0].includes('/log'));
        expect(logCall).toBeDefined();
        const body = JSON.parse(logCall[1].body);
        expect(body.type).toBe('death_save');
        expect(body.characterName).toBe('Test Character');
        expect(body.roll).toBe(15);
        expect(body.success).toBe(true);
      });
    });

    it('marks the log entry as natural 1 or natural 20 accordingly', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        ...defaultRollResult,
        roll: 1,
        result: 'failure',
        isNat1: true,
        newFailures: [true, true, false],
      });
      render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        const logCall = global.fetch.mock.calls.find((call) => call[0].includes('/log'));
        const body = JSON.parse(logCall[1].body);
        expect(body.isNatural1).toBe(true);
        expect(body.isNatural20).toBe(false);
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
