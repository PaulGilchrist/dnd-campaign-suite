import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState, useEffect, useRef } from 'react';

const runtimeStore = new Map();
const runtimeListeners = new Set();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, prop) => runtimeStore.get(`${name}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((name, prop, value) => {
    runtimeStore.set(`${name}:${prop}`, value);
    runtimeListeners.forEach((fn) => fn());
  }),
  useRuntimeValue: vi.fn((name, prop) => {
    const key = `${name}:${prop}`;
    const [value, setValue] = useState(() => runtimeStore.get(key) ?? null);
    // eslint-disable-next-line server-first/no-local-game-state
    const currentValueRef = useRef(value);
    useEffect(() => {
      const listener = () => {
        const next = runtimeStore.get(key) ?? null;
        if (Object.is(currentValueRef.current, next)) return;
        currentValueRef.current = next;
        setValue(next);
      };
      runtimeListeners.add(listener);
      listener();
      return () => runtimeListeners.delete(listener);
    }, [key]);
    return value;
  }),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/deathSaveRules.js', () => ({
  isStable: vi.fn(() => false),
  isDead: vi.fn(() => false),
  rollDeathSave: vi.fn(),
  rollDeathSaveWithAdvantage: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(() => false),
  hasBeaconOfHope: vi.fn(() => false),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import DeathSavingThrows from './DeathSavingThrows.jsx';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js';
import * as conditionEffects from '../../../services/combat/conditions/conditionEffects.js';
import { addEntry } from '../../../services/ui/logService.js';

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
    runtimeStore.clear();
    runtimeListeners.clear();
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult);
    deathSaveRules.rollDeathSaveWithAdvantage.mockReturnValue(defaultRollResult);
    conditionEffects.hasSaveModifier.mockReturnValue(false);
    conditionEffects.hasBeaconOfHope.mockReturnValue(false);
  });

  function renderComponent(props = {}) {
    return render(
      <DeathSavingThrows playerStats={mockPlayerStats} campaignName={mockCampaignName} {...props} />
    );
  }

  describe('rendering', () => {
    it('renders the death saves title', () => {
      renderComponent();
      expect(screen.getByText('Death Saves')).toBeInTheDocument();
    });

    it('renders three empty circles for initial saves and failures', () => {
      renderComponent();
      const successTrack = screen.getByText(/Successes:/).parentElement;
      const failureTrack = screen.getByText(/Failures:/).parentElement;
      expect(successTrack.textContent).toContain('◯◯◯');
      expect(failureTrack.textContent).toContain('◯◯◯');
    });

    it('renders fills for saves stored in the runtime state', () => {
      runtimeStore.set('Test Character:deathSaves', [true, true, false]);
      runtimeStore.set('Test Character:deathFailures', [false, false, false]);
      renderComponent();

      const successTrack = screen.getByText(/Successes:/).parentElement;
      const failureTrack = screen.getByText(/Failures:/).parentElement;
      expect(successTrack.textContent).toContain('⬤⬤◯');
      expect(failureTrack.textContent).toContain('◯◯◯');
    });

    it('shows "Stable" text and hides roll button when stable', () => {
      deathSaveRules.isStable.mockReturnValue(true);
      renderComponent();
      expect(screen.getByText('Stable')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    });

    it('shows "Dead" text and hides roll button when 3 failures reached', () => {
      deathSaveRules.isStable.mockReturnValue(false);
      deathSaveRules.isDead.mockReturnValue(true);
      renderComponent();
      expect(screen.getByText('Dead')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    });

    it('shows "DEAD" badge when isDead tracked resource is set', () => {
      runtimeStore.set('Test Character:isDead', 1);
      renderComponent();
      expect(screen.getByText('DEAD')).toBeInTheDocument();
      expect(screen.queryByText('Death Saves')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    });

    it.each([
      [true, true],
      [false, false],
    ])('shows DEAD badge%s remove button when isLocalhost is %s', async (localhost, showsRemove) => {
      runtimeStore.set('Test Character:isDead', 1);
      renderComponent({ isLocalhost: localhost });
      expect(screen.getByText('DEAD')).toBeInTheDocument();
      if (showsRemove) {
        expect(screen.getByTitle('Resurrect character')).toBeInTheDocument();
      } else {
        expect(screen.queryByTitle('Resurrect character')).not.toBeInTheDocument();
      }
    });

    it('shows "ADVANTAGE" text when player has death save advantage', () => {
      deathSaveRules.isStable.mockReturnValue(false);
      deathSaveRules.isDead.mockReturnValue(false);
      conditionEffects.hasSaveModifier.mockReturnValue(true);

      renderComponent();

      expect(screen.getByText('ADVANTAGE')).toBeInTheDocument();
    });

  });

  describe('rolling death saves', () => {
    it.each([
      ['success', 'Success', { result: 'success', newSaves: [true, false, false], newFailures: [false, false, false] }],
      ['failure', 'Failure', { result: 'failure', newSaves: [false, false, false], newFailures: [true, false, false] }],
    ])('updates %s circles and result label after a roll', async (_label, resultLabel, rollOverride) => {
      deathSaveRules.rollDeathSave.mockReturnValue({ ...defaultRollResult, ...rollOverride });
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        const successTrack = screen.getByText(/Successes:/).parentElement;
        const failureTrack = screen.getByText(/Failures:/).parentElement;
        expect(rollOverride.newSaves[0] ? successTrack.textContent : failureTrack.textContent).toContain('⬤◯◯');
        expect(screen.getByText(resultLabel)).toBeInTheDocument();
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
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(screen.getByText('NAT 20')).toBeInTheDocument();
      });
    });

    it('restores to 1 HP on natural 20', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        roll: 20,
        result: 'nat20',
        isNat20: true,
        isNat1: false,
        newSaves: [false, false, false],
        newFailures: [false, false, false],
        restoredToHp: 1,
      });
      renderComponent();
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

    it('shows NAT 1 indicator and applies double failure on a natural 1 roll', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        roll: 1,
        result: 'failure',
        isNat20: false,
        isNat1: true,
        newSaves: [false, false, false],
        newFailures: [true, true, false],
        restoredToHp: null,
      });
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(screen.getByText('NAT 1')).toBeInTheDocument();
        const failureTrack = screen.getByText(/Failures:/).parentElement;
        expect(failureTrack.textContent).toContain('⬤⬤◯');
      });
    });

    it('logs totalSuccesses and totalFailures with each roll', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        ...defaultRollResult,
        result: 'success',
        newSaves: [true, true, false],
        newFailures: [true, false, false],
      });
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
          type: 'death_save',
          totalSuccesses: 2,
          totalFailures: 1,
        }));
      });
    });

    it('logs stable result when 3 successes reached', async () => {
      deathSaveRules.rollDeathSave.mockReturnValue({
        roll: 12,
        result: 'stable',
        isNat20: false,
        isNat1: false,
        newSaves: [true, true, true],
        newFailures: [true, false, false],
        restoredToHp: null,
      });
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
          type: 'death_save',
          result: 'stable',
          totalSuccesses: 3,
        }));
      });
    });

    it('logs dead result and sets isDead tracked resource when 3 failures reached', async () => {
      deathSaveRules.isDead.mockReturnValue(false);
      deathSaveRules.rollDeathSave.mockReturnValue({
        roll: 5,
        result: 'dead',
        isNat20: false,
        isNat1: false,
        newSaves: [false, false, false],
        newFailures: [true, true, true],
        restoredToHp: null,
      });
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
          type: 'death_save',
          result: 'dead',
          totalFailures: 3,
        }));
      });

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'isDead', 1, mockCampaignName);
    });

    it.each([
      [true, true],
      [false, false],
    ])('rolls with advantage when hasAdvantage is %s', (hasAdvantage, expectWithAdvantage) => {
      conditionEffects.hasSaveModifier.mockReturnValue(hasAdvantage);

      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      if (expectWithAdvantage) {
        expect(deathSaveRules.rollDeathSaveWithAdvantage).toHaveBeenCalled();
        expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
      } else {
        expect(deathSaveRules.rollDeathSave).toHaveBeenCalled();
        expect(deathSaveRules.rollDeathSaveWithAdvantage).not.toHaveBeenCalled();
      }
    });

    it('does not roll when isDead state is already set', () => {
      runtimeStore.set('Test Character:isDead', 1);
      renderComponent();

      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    });

    it('rolls using saves and failures from the runtime state', () => {
      runtimeStore.set('Test Character:deathSaves', [true, false, false]);
      runtimeStore.set('Test Character:deathFailures', [false, true, false]);
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith(
        [true, false, false],
        [false, true, false],
        false
      );
    });

    it('uses default empty arrays when no saves/failures are stored', () => {
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith(
        [false, false, false],
        [false, false, false],
        false
      );
    });

    it('passes treat18AsNat20 option when player has the automation passive', () => {
      const playerStatsWithPassive = {
        ...mockPlayerStats,
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'death_save_nat18_as_20' },
          ],
        },
      };
      renderComponent({ playerStats: playerStatsWithPassive });
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith(
        [false, false, false],
        [false, false, false],
        true
      );
    });

    it('clears death save prompt after rolling', () => {
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /roll/i }));

      expect(clearDeathSavePrompt).toHaveBeenCalledWith(mockCampaignName, 'Test Character');
    });
  });

  describe('DEAD badge removal', () => {
    it('removes isDead and resets death saves when GM clicks remove button', async () => {
      runtimeStore.set('Test Character:isDead', 1);
      renderComponent({ isLocalhost: true });

      await act(async () => {
        fireEvent.click(screen.getByTitle('Resurrect character'));
      });

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'isDead', 0, mockCampaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'deathSaves', [false, false, false], mockCampaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'deathFailures', [false, false, false], mockCampaignName);

      expect(screen.queryByText('DEAD')).not.toBeInTheDocument();
      expect(screen.getByText('Death Saves')).toBeInTheDocument();
    });

    it('logs the death save removal', async () => {
      runtimeStore.set('Test Character:isDead', 1);
      renderComponent({ isLocalhost: true });

      await act(async () => {
        fireEvent.click(screen.getByTitle('Resurrect character'));
      });

      expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
        type: 'death_save',
        result: 'removed',
        totalSuccesses: 0,
        totalFailures: 0,
      }));
    });
  });

  describe('custom event handling', () => {
    it('shows the latest roll result from a death-save-result event for this character', async () => {
      renderComponent();

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent('death-save-result', {
            detail: {
              targetName: 'Test Character',
              roll: 18,
              success: true,
              isNat20: false,
              isNat1: false,
            },
          })
        );
      });

      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('ignores a death-save-result event for a different character', () => {
      renderComponent();

      window.dispatchEvent(
        new CustomEvent('death-save-result', {
          detail: {
            targetName: 'Other Character',
            roll: 20,
            success: true,
            isNat20: true,
            isNat1: false,
          },
        })
      );

      expect(screen.queryByText('Success')).not.toBeInTheDocument();
      expect(screen.queryByText('Failure')).not.toBeInTheDocument();
    });

  });
});
