import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeathSavingThrows from './DeathSavingThrows.jsx';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/combat/savePromptService.js', () => ({
  clearDeathSavePrompt: vi.fn(),
  sendDeathSavePrompt: vi.fn(),
  sendDeathSaveResult: vi.fn(),
}));

vi.mock('../../../services/combat/deathSaveRules.js', () => ({
  isStable: vi.fn((saves) => saves.filter(Boolean).length >= 3),
  isDead: vi.fn((failures) => failures.filter(Boolean).length >= 3),
  rollDeathSave: vi.fn(),
  rollDeathSaveWithAdvantage: vi.fn(),
}));

vi.mock('../../../services/combat/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import * as deathSaveRules from '../../../services/combat/deathSaveRules.js';
import { hasSaveModifier } from '../../../services/combat/conditionEffects.js';
import { clearDeathSavePrompt } from '../../../services/combat/savePromptService.js';

describe('DeathSavingThrows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  });

  const mockPlayerStats = {
    name: 'Test Character',
  };

  const mockCampaignName = 'test-campaign';

  it('should render death saves title', () => {
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    expect(screen.getByText('Death Saves')).toBeInTheDocument();
  });

  it('should render 3 empty success circles', () => {
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const successTrack = screen.getAllByText(/Successes/)[0].parentElement;
    expect(successTrack.textContent).toContain('◯◯◯');
  });

  it('should render 3 empty failure circles', () => {
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const failureTrack = screen.getAllByText(/Failures/)[0].parentElement;
    expect(failureTrack.textContent).toContain('◯◯◯');
  });

  it('should show Stable when 3 successes', () => {
    deathSaveRules.isStable.mockReturnValue(true);
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('should show Dead when 3 failures', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(true);
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    expect(screen.getByText('Dead')).toBeInTheDocument();
  });

  it('should hide roll button when stable', () => {
    deathSaveRules.isStable.mockReturnValue(true);
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
  });

  it('should hide roll button when dead', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(true);
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
  });

  it('should show roll button when not stable and not dead', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    expect(screen.getByRole('button', { name: /roll/i })).toBeInTheDocument();
  });

  it('should load saved death saves from runtime state on mount', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'deathSaves') return [true, false, false];
      if (prop === 'deathFailures') return [true, true, false];
      return null;
    });
    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const successTrack = screen.getAllByText(/Successes/)[0].parentElement;
    expect(successTrack.textContent).toContain('⬤◯◯');
    const failureTrack = screen.getAllByText(/Failures/)[0].parentElement;
    expect(failureTrack.textContent).toContain('⬤⬤◯');
  });

  it('should call rollDeathSave when roll button is clicked', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    fireEvent.click(rollBtn);

    expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith([false, false, false], [false, false, false]);
  });

  it('should call rollDeathSaveWithAdvantage when player has advantage', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSaveWithAdvantage.mockReturnValue({
      roll: 18,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(true);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    fireEvent.click(rollBtn);

    expect(hasSaveModifier).toHaveBeenCalledWith(mockPlayerStats.saveModifiers, 'death_saving_throws');
    expect(deathSaveRules.rollDeathSaveWithAdvantage).toHaveBeenCalled();
  });

  it('should not roll when stable', () => {
    deathSaveRules.isStable.mockReturnValue(true);
    deathSaveRules.isDead.mockReturnValue(false);
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    // When stable, the roll button should not exist
    expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
  });

  it('should not roll when dead', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(true);
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    // When dead, the roll button should not exist
    expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
  });

  it('should update saves after roll', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    const successTrack = screen.getAllByText(/Successes/)[0].parentElement;
    expect(successTrack.textContent).toContain('⬤◯◯');
  });

  it('should log death save to campaign log', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/campaigns/${encodeURIComponent(mockCampaignName)}/log`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should save death saves to runtime state after roll', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'deathSaves', [true, false, false], mockCampaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'deathFailures', [false, false, false], mockCampaignName);
  });

  it('should clear death save prompt after roll', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    expect(clearDeathSavePrompt).toHaveBeenCalledWith(mockCampaignName, 'Test Character');
  });

  it('should restore HP on nat20', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 20,
      result: 'nat20',
      isNat20: true,
      isNat1: false,
      newSaves: [false, false, false],
      newFailures: [false, false, false],
      restoredToHp: 1,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'currentHitPoints', 1, mockCampaignName);
  });

  it('should show success result indicator after roll', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });

  it('should show failure result indicator after roll', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 5,
      result: 'failure',
      isNat20: false,
      isNat1: false,
      newSaves: [false, false, false],
      newFailures: [true, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    await waitFor(() => {
      expect(screen.getByText('Failure')).toBeInTheDocument();
    });
  });

  it('should show NAT 20 indicator on natural 20', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 20,
      result: 'nat20',
      isNat20: true,
      isNat1: false,
      newSaves: [false, false, false],
      newFailures: [false, false, false],
      restoredToHp: 1,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    await waitFor(() => {
      expect(screen.getByText('NAT 20')).toBeInTheDocument();
    });
  });

  it('should show NAT 1 indicator on natural 1', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 1,
      result: 'failure',
      isNat20: false,
      isNat1: true,
      newSaves: [false, false, false],
      newFailures: [true, true, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    await waitFor(() => {
      expect(screen.getByText('NAT 1')).toBeInTheDocument();
    });
  });

  it('should display roll value in parentheses', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    await waitFor(() => {
      expect(screen.getByText('(15)')).toBeInTheDocument();
    });
  });

  it('should hide result after 2 seconds', async () => {
    vi.useFakeTimers();
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });
    // Flush all pending state updates
    await act(async () => {});
    vi.runOnlyPendingTimers();

    // Result should be visible
    expect(screen.getByText('Success')).toBeInTheDocument();

    // Advance timers past the 2s timeout
    await act(async () => { vi.advanceTimersByTime(2100); });

    // Result should be gone
    expect(screen.queryByText('Success')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('should show success class when roll is successful', async () => {
    vi.useFakeTimers();
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });
    // Flush all pending state updates
    await act(async () => {});
    vi.runOnlyPendingTimers();

    // Result element should be visible with success class
    const resultEl = document.querySelector('.death-saves-result');
    expect(resultEl).toHaveClass('death-saves-result--success');

    vi.useRealTimers();
  });

  it('should show failure class when roll fails', async () => {
    vi.useFakeTimers();
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 5,
      result: 'failure',
      isNat20: false,
      isNat1: false,
      newSaves: [false, false, false],
      newFailures: [true, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });
    // Flush all pending state updates
    await act(async () => {});
    vi.runOnlyPendingTimers();

    // Result element should be visible with failure class
    const resultEl = document.querySelector('.death-saves-result');
    expect(resultEl).toHaveClass('death-saves-result--failure');

    vi.useRealTimers();
  });

  it('should render dice icon inside roll button', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    expect(rollBtn.querySelector('.fa-dice-d20')).toBeInTheDocument();
  });

  it('should have tabIndex on roll button for accessibility', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    expect(rollBtn).toHaveAttribute('tabIndex', '0');
  });

  it('should handle death save result from custom event', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);

    window.dispatchEvent(new CustomEvent('death-save-result', {
      detail: {
        targetName: 'Test Character',
        roll: 18,
        success: true,
        isNat20: false,
        isNat1: false,
        newSaves: [true, true, false],
        newFailures: [false, false, false],
      },
    }));

    await act(async () => {});

    const successTrack = screen.getAllByText(/Successes/)[0].parentElement;
    expect(successTrack.textContent).toContain('⬤⬤◯');
  });

  it('should ignore death save result from different character', () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);

    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'deathSaves') return [true, false, false];
      if (prop === 'deathFailures') return [false, false, false];
      return null;
    });

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);

    window.dispatchEvent(new CustomEvent('death-save-result', {
      detail: {
        targetName: 'Other Character',
        roll: 20,
        success: true,
        isNat20: true,
        isNat1: false,
        newSaves: [true, true, true],
        newFailures: [true, true, true],
      },
    }));

    const successTrack = screen.getAllByText(/Successes/)[0].parentElement;
    expect(successTrack.textContent).toContain('⬤◯◯');
  });

  it('should use stable result as success for display', async () => {
    vi.useFakeTimers();
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 10,
      result: 'stable',
      isNat20: false,
      isNat1: false,
      newSaves: [false, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });
    // Flush state updates from setState calls inside rollDeathSave
    await act(async () => {});
    vi.runOnlyPendingTimers();

    expect(screen.getByText('Success')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('should send correct log entry with character name', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    const logCall = global.fetch.mock.calls.find(
      (call) => call[0].includes('/log')
    );
    expect(logCall).toBeDefined();
    const body = JSON.parse(logCall[1].body);
    expect(body.type).toBe('death_save');
    expect(body.characterName).toBe('Test Character');
    expect(body.roll).toBe(15);
    expect(body.success).toBe(true);
  });

  it('should mark log entry as natural 1 when rolled 1', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 1,
      result: 'failure',
      isNat20: false,
      isNat1: true,
      newSaves: [false, false, false],
      newFailures: [true, true, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    const logCall = global.fetch.mock.calls.find(
      (call) => call[0].includes('/log')
    );
    const body = JSON.parse(logCall[1].body);
    expect(body.isNatural1).toBe(true);
    expect(body.isNatural20).toBe(false);
  });

  it('should mark log entry as natural 20 when rolled 20', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 20,
      result: 'nat20',
      isNat20: true,
      isNat1: false,
      newSaves: [false, false, false],
      newFailures: [false, false, false],
      restoredToHp: 1,
    });
    hasSaveModifier.mockReturnValue(false);

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });
    await act(async () => { fireEvent.click(rollBtn); });

    const logCall = global.fetch.mock.calls.find(
      (call) => call[0].includes('/log')
    );
    const body = JSON.parse(logCall[1].body);
    expect(body.isNatural20).toBe(true);
    expect(body.isNatural1).toBe(false);
    expect(body.success).toBe(true);
  });

  it('should catch fetch errors silently in logEntry', async () => {
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 15,
      result: 'success',
      isNat20: false,
      isNat1: false,
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    hasSaveModifier.mockReturnValue(false);
    global.fetch.mockImplementation(() => Promise.reject(new Error('Network error')));

    render(<DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
    const rollBtn = screen.getByRole('button', { name: /roll/i });

    await act(async () => {
      expect(() => { fireEvent.click(rollBtn); }).not.toThrow();
    });
  });
});
