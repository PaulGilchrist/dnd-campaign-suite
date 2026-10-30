// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState, useEffect, useRef } from 'react';

// Minimal in-memory stand-in for the runtime store so tests can seed state
// and observe writes without a server or SSE connection.
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

const CAMPAIGN = 'test-campaign';
const CHARACTER = 'Test Character';
const EMPTY_TRACK = [false, false, false];

function rollResult(overrides = {}) {
  return {
    roll: 15,
    result: 'success',
    isNat20: false,
    isNat1: false,
    newSaves: [true, false, false],
    newFailures: EMPTY_TRACK,
    restoredToHp: null,
    ...overrides,
  };
}

function renderComponent({ playerStats, ...props } = {}) {
  return render(
    <DeathSavingThrows
      playerStats={{ name: CHARACTER, ...playerStats }}
      campaignName={CAMPAIGN}
      {...props}
    />
  );
}

function getTracks(container) {
  const [success, failure] = container.querySelectorAll('.death-saves-track');
  return { success, failure };
}

function clickRollButton() {
  fireEvent.click(screen.getByRole('button', { name: /roll/i }));
}

function loggedEntries() {
  return vi.mocked(addEntry).mock.calls.map(([, entry]) => entry);
}

describe('DeathSavingThrows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    runtimeStore.clear();
    runtimeListeners.clear();
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue(rollResult());
    deathSaveRules.rollDeathSaveWithAdvantage.mockReturnValue(rollResult());
    conditionEffects.hasSaveModifier.mockReturnValue(false);
    conditionEffects.hasBeaconOfHope.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the title, an active Roll button, and circles filled from the runtime state', () => {
    runtimeStore.set(`${CHARACTER}:deathSaves`, [true, true, false]);
    runtimeStore.set(`${CHARACTER}:deathFailures`, [true, false, false]);
    const { container } = renderComponent();

    expect(screen.getByText('Death Saves')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roll/i })).toBeInTheDocument();
    const tracks = getTracks(container);
    expect(tracks.success).toHaveTextContent('Successes: ⬤⬤◯');
    expect(tracks.failure).toHaveTextContent('Failures: ⬤◯◯');
  });

  it('shows "Stable" and hides the roll button once the rules report stability', () => {
    runtimeStore.set(`${CHARACTER}:deathSaves`, [true, true, true]);
    deathSaveRules.isStable.mockReturnValue(true);
    const { container } = renderComponent();

    expect(screen.getByText('Stable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    // Tracks stay visible so the stable state shows its full history.
    expect(getTracks(container).success).toHaveTextContent('Successes: ⬤⬤⬤');
  });

  it('shows "Dead" and hides the roll button once the rules report death', () => {
    runtimeStore.set(`${CHARACTER}:deathFailures`, [true, true, true]);
    deathSaveRules.isDead.mockReturnValue(true);
    renderComponent();

    expect(screen.getByText('Dead')).toBeInTheDocument();
    expect(screen.queryByText('Stable')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
  });

  describe('DEAD badge (tracked isDead resource)', () => {
    it.each([
      [true, true],
      [false, false],
    ])('replaces the panel with the DEAD badge and offers the resurrect button on localhost=%s only', (localhost, showsRemove) => {
      runtimeStore.set(`${CHARACTER}:isDead`, 1);
      renderComponent({ isLocalhost: localhost });

      expect(screen.getByText(/DEAD/)).toBeInTheDocument();
      expect(screen.queryByText('Death Saves')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
      if (showsRemove) {
        expect(screen.getByRole('button', { name: /resurrect character/i })).toBeInTheDocument();
      } else {
        expect(screen.queryByRole('button', { name: /resurrect character/i })).not.toBeInTheDocument();
      }
    });
  });

  describe('rolling a death save', () => {
    it.each([
      ['success', rollResult({ roll: 14, newSaves: [true, false, false] }), 'Success', 'Successes: ⬤◯◯', 'Failures: ◯◯◯', true, 1, 0],
      ['failure', rollResult({ roll: 5, result: 'failure', newSaves: EMPTY_TRACK, newFailures: [true, false, false] }), 'Failure', 'Successes: ◯◯◯', 'Failures: ⬤◯◯', false, 0, 1],
    ])('rolls a %s: shows feedback, updates the tracks, persists state, and logs it without touching HP', (_label, result, expectedLabel, expectedSuccess, expectedFailure, expectedSuccessFlag, totalSuccesses, totalFailures) => {
      deathSaveRules.rollDeathSave.mockReturnValue(result);
      const { container } = renderComponent();
      clickRollButton();

      expect(screen.getByText(`(${result.roll})`)).toBeInTheDocument();
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
      const tracks = getTracks(container);
      expect(tracks.success).toHaveTextContent(expectedSuccess);
      expect(tracks.failure).toHaveTextContent(expectedFailure);

      expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'deathSaves', result.newSaves, CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'deathFailures', result.newFailures, CAMPAIGN);
      expect(clearDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, CHARACTER);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(CHARACTER, 'currentHitPoints', expect.anything(), CAMPAIGN);

      expect(loggedEntries()).toContainEqual(expect.objectContaining({
        type: 'death_save',
        characterName: CHARACTER,
        roll: result.roll,
        success: expectedSuccessFlag,
        hasAdvantage: false,
        totalSuccesses,
        totalFailures,
      }));
    });

    it('restores 1 HP and shows NAT 20 on a natural 20', () => {
      deathSaveRules.rollDeathSave.mockReturnValue(rollResult({
        roll: 20,
        result: 'nat20',
        isNat20: true,
        newSaves: EMPTY_TRACK,
        restoredToHp: 1,
      }));
      renderComponent();
      clickRollButton();

      expect(screen.getByText('NAT 20')).toBeInTheDocument();
      expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'currentHitPoints', 1, CAMPAIGN);
    });

    it('shows NAT 1 and applies a double failure on a natural 1', () => {
      deathSaveRules.rollDeathSave.mockReturnValue(rollResult({
        roll: 1,
        result: 'failure',
        isNat1: true,
        newSaves: EMPTY_TRACK,
        newFailures: [true, true, false],
      }));
      const { container } = renderComponent();
      clickRollButton();

      expect(screen.getByText('NAT 1')).toBeInTheDocument();
      expect(getTracks(container).failure).toHaveTextContent('Failures: ⬤⬤◯');
      expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'deathFailures', [true, true, false], CAMPAIGN);
    });

    it('leaves HP at 0 (RAW stabilization) and logs the stable summary row', () => {
      deathSaveRules.rollDeathSave.mockReturnValue(rollResult({
        roll: 12,
        result: 'stable',
        newSaves: [true, true, true],
        newFailures: [true, false, false],
      }));
      renderComponent();
      clickRollButton();

      // Owner decision 2026-10-29: stabilization leaves the creature at 0 HP —
      // the old HP=1 write is removed (modal lane never wrote it). Row stays
      // synchronous — never deferred behind a timer.
      expect(setRuntimeValue).not.toHaveBeenCalledWith(CHARACTER, 'currentHitPoints', expect.anything(), CAMPAIGN);
      expect(loggedEntries()).toContainEqual(expect.objectContaining({
        type: 'death_save',
        result: 'stable',
        totalSuccesses: 3,
        totalFailures: 1,
      }));
    });

    it('marks the character dead and logs it when the third failure lands', () => {
      deathSaveRules.rollDeathSave.mockReturnValue(rollResult({
        roll: 5,
        result: 'dead',
        newSaves: EMPTY_TRACK,
        newFailures: [true, true, true],
      }));
      renderComponent();
      clickRollButton();

      expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'isDead', 1, CAMPAIGN);
      // A dead outcome never writes HP (unchanged contract).
      expect(setRuntimeValue).not.toHaveBeenCalledWith(CHARACTER, 'currentHitPoints', expect.anything(), CAMPAIGN);
      expect(loggedEntries()).toContainEqual(expect.objectContaining({
        type: 'death_save',
        result: 'dead',
        characterName: CHARACTER,
        totalSuccesses: 0,
        totalFailures: 3,
      }));
    });

    it.each([
      ['save modifier plus the nat18-as-20 passive', { saveModifiers: ['death_saving_throws'], automation: { passives: [{ type: 'passive_rule', effect: 'death_save_nat18_as_20' }] } }, true, false, true, true],
      ['Beacon of Hope', {}, false, true, true, false],
      ['no bonus', {}, false, false, false, false],
    ])('routes the roll through the %s entry point with the synced tracks', (_source, extraStats, modifier, beacon, usesAdvantage, treat18AsNat20) => {
      conditionEffects.hasSaveModifier.mockReturnValue(modifier);
      conditionEffects.hasBeaconOfHope.mockReturnValue(beacon);
      deathSaveRules.rollDeathSaveWithAdvantage.mockReturnValue(rollResult({ roll: 17, rolls: [17, 8] }));
      runtimeStore.set(`${CHARACTER}:deathSaves`, [true, false, false]);
      runtimeStore.set(`${CHARACTER}:deathFailures`, [false, true, false]);
      renderComponent({ playerStats: extraStats });
      clickRollButton();

      const saves = [true, false, false];
      const failures = [false, true, false];
      if (usesAdvantage) {
        expect(screen.getByText('ADVANTAGE')).toBeInTheDocument();
        expect(deathSaveRules.rollDeathSaveWithAdvantage).toHaveBeenCalledWith(saves, failures, treat18AsNat20);
        expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
        expect(loggedEntries()).toContainEqual(expect.objectContaining({
          type: 'death_save',
          roll: 17,
          rolls: [17, 8],
          hasAdvantage: true,
          success: true,
        }));
      } else {
        expect(screen.queryByText('ADVANTAGE')).not.toBeInTheDocument();
        expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith(saves, failures, false);
        expect(deathSaveRules.rollDeathSaveWithAdvantage).not.toHaveBeenCalled();
      }
    });
  });

  describe('resurrecting a dead character', () => {
    beforeEach(() => {
      runtimeStore.set(`${CHARACTER}:isDead`, 1);
    });

    it('clears isDead, resets both tracks, restores the panel, and logs the resurrection', async () => {
      const { container } = renderComponent({ isLocalhost: true });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /resurrect character/i }));
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'isDead', 0, CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'deathSaves', EMPTY_TRACK, CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'deathFailures', EMPTY_TRACK, CAMPAIGN);

      expect(screen.queryByText(/DEAD/)).not.toBeInTheDocument();
      expect(screen.getByText('Death Saves')).toBeInTheDocument();
      expect(getTracks(container).success).toHaveTextContent('Successes: ◯◯◯');

      expect(loggedEntries()).toContainEqual(expect.objectContaining({
        type: 'death_save',
        characterName: CHARACTER,
        result: 'removed',
        totalSuccesses: 0,
        totalFailures: 0,
      }));
    });
  });

  describe('death-save-result events (rolls driven elsewhere)', () => {
    it('shows feedback for an event targeting this character without mutating the synced tracks', () => {
      const { container } = renderComponent();

      act(() => {
        window.dispatchEvent(new CustomEvent('death-save-result', {
          detail: { targetName: CHARACTER, roll: 18, success: true, isNat20: false, isNat1: false },
        }));
      });

      expect(screen.getByText('(18)')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      // The event only drives feedback — tracks come from synced state.
      expect(getTracks(container).success).toHaveTextContent('Successes: ◯◯◯');
    });

    it('ignores a death-save-result for a different character', () => {
      renderComponent();

      act(() => {
        window.dispatchEvent(new CustomEvent('death-save-result', {
          detail: { targetName: 'Other Character', roll: 20, success: true, isNat20: true, isNat1: false },
        }));
      });

      expect(screen.queryByText('Success')).not.toBeInTheDocument();
      expect(screen.queryByText('NAT 20')).not.toBeInTheDocument();
    });

    it('auto-hides the roll feedback after a moment (benign UI timer only)', () => {
      vi.useFakeTimers();
      renderComponent();
      clickRollButton();

      expect(screen.getByText('Success')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    });
  });
});
