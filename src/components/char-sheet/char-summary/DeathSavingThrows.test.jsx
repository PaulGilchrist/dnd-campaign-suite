// @maintained-by-ai 2026-11-26
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState, useEffect, useRef } from 'react';

// Minimal in-memory stand-in for the runtime store so tests can seed state
// and observe writes without a server or SSE connection. The wire shape
// (one whole-bucket POST per lane) is pinned against the REAL store module in
// DeathSavingThrows.roll-single-write.test.jsx / .clear-single-write.test.jsx;
// here we assert the component-level contract only.
const runtimeStore = new Map();
const runtimeListeners = new Set();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, prop) => runtimeStore.get(`${name}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((name, prop, value) => {
    runtimeStore.set(`${name}:${prop}`, value);
    runtimeListeners.forEach((fn) => fn());
  }),
  setRuntimeBatch: vi.fn((name, properties) => {
    Object.entries(properties).forEach(([prop, value]) => runtimeStore.set(`${name}:${prop}`, value));
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
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
  getActiveTargetEffect: vi.fn(() => null),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import DeathSavingThrows from './DeathSavingThrows.jsx';
import { setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js';
import * as conditionEffects from '../../../services/combat/conditions/conditionEffects.js';
import { getActiveTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CHARACTER = 'Test Character';
const EMPTY_TRACK = [false, false, false];

// The result chip now lives in CharHitPoints (outside the DEAD-branch swap and
// the HP<=0 unmount gate); this lane only reports through the callback.
let onRollResult;

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
      onRollResult={onRollResult}
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
    onRollResult = vi.fn();
    vi.useRealTimers();
    runtimeStore.clear();
    runtimeListeners.clear();
    deathSaveRules.isStable.mockReturnValue(false);
    deathSaveRules.isDead.mockReturnValue(false);
    deathSaveRules.rollDeathSave.mockReturnValue(rollResult());
    deathSaveRules.rollDeathSaveWithAdvantage.mockReturnValue(rollResult());
    conditionEffects.hasSaveModifier.mockReturnValue(false);
    vi.mocked(getActiveTargetEffect).mockReturnValue(null);
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

  it.each([
    {
      rule: 'isStable', shown: 'Stable', hidden: 'Dead',
      track: 'deathSaves', filled: [true, true, true],
      successText: 'Successes: ⬤⬤⬤', failureText: 'Failures: ◯◯◯',
    },
    {
      rule: 'isDead', shown: 'Dead', hidden: 'Stable',
      track: 'deathFailures', filled: [true, true, true],
      successText: 'Successes: ◯◯◯', failureText: 'Failures: ⬤⬤⬤',
    },
  ])('locks the roll button and shows "$shown" once the rules report $rule, keeping the track history visible', (tc) => {
    runtimeStore.set(`${CHARACTER}:${tc.track}`, tc.filled);
    deathSaveRules[tc.rule].mockReturnValue(true);
    const { container } = renderComponent();

    expect(screen.getByText(tc.shown)).toBeInTheDocument();
    expect(screen.queryByText(tc.hidden)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
    const tracks = getTracks(container);
    expect(tracks.success).toHaveTextContent(tc.successText);
    expect(tracks.failure).toHaveTextContent(tc.failureText);
  });

  describe('DEAD badge (tracked isDead resource)', () => {
    it.each([
      [true, true],
      [false, false],
    ])('replaces the panel with the DEAD badge and offers the clear-death-state button on localhost=%s only', (localhost, showsRemove) => {
      runtimeStore.set(`${CHARACTER}:isDead`, 1);
      renderComponent({ isLocalhost: localhost });

      expect(screen.getByText(/DEAD/)).toBeInTheDocument();
      expect(screen.queryByText('Death Saves')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /roll/i })).not.toBeInTheDocument();
      if (showsRemove) {
        // Verbatim title pin: the button only clears the death state (isDead +
        // tracks) at 0 HP — it never resurrects, so the copy must not claim it.
        const removeBtn = screen.getByRole('button', { name: 'Clear death state', exact: true });
        expect(removeBtn).toBeInTheDocument();
        expect(removeBtn).toHaveAttribute('title', 'Clear death state');
      } else {
        expect(screen.queryByRole('button', { name: 'Clear death state', exact: true })).not.toBeInTheDocument();
      }
    });
  });

  describe('rolling a death save', () => {
    it.each([
      {
        label: 'success',
        result: rollResult({ roll: 14, newSaves: [true, false, false] }),
        report: { roll: 14, success: true, isNat20: false, isNat1: false },
        successText: 'Successes: ⬤◯◯', failureText: 'Failures: ◯◯◯',
        writes: { deathSaves: [true, false, false], deathFailures: EMPTY_TRACK },
        log: expect.objectContaining({
          type: 'death_save', characterName: CHARACTER, roll: 14,
          success: true, hasAdvantage: false, isNatural20: false, isNatural1: false,
          totalSuccesses: 1, totalFailures: 0,
        }),
      },
      {
        label: 'failure',
        result: rollResult({ roll: 5, result: 'failure', newSaves: EMPTY_TRACK, newFailures: [true, false, false] }),
        report: { roll: 5, success: false, isNat20: false, isNat1: false },
        successText: 'Successes: ◯◯◯', failureText: 'Failures: ⬤◯◯',
        writes: { deathSaves: EMPTY_TRACK, deathFailures: [true, false, false] },
        log: expect.objectContaining({
          type: 'death_save', characterName: CHARACTER, roll: 5,
          success: false, hasAdvantage: false, isNatural20: false, isNatural1: false,
          totalSuccesses: 0, totalFailures: 1,
        }),
      },
      {
        label: 'natural 1 (double failure)',
        result: rollResult({ roll: 1, result: 'failure', isNat1: true, newSaves: EMPTY_TRACK, newFailures: [true, true, false] }),
        report: { roll: 1, success: false, isNat20: false, isNat1: true },
        successText: 'Successes: ◯◯◯', failureText: 'Failures: ⬤⬤◯',
        writes: { deathSaves: EMPTY_TRACK, deathFailures: [true, true, false] },
        log: expect.objectContaining({
          type: 'death_save', characterName: CHARACTER, roll: 1,
          success: false, hasAdvantage: false, isNatural20: false, isNatural1: true,
          totalSuccesses: 0, totalFailures: 2,
        }),
      },
      {
        label: 'natural 20 (restores 1 HP)',
        result: rollResult({ roll: 20, result: 'nat20', isNat20: true, newSaves: EMPTY_TRACK, restoredToHp: 1 }),
        report: { roll: 20, success: true, isNat20: true, isNat1: false },
        successText: 'Successes: ◯◯◯', failureText: 'Failures: ◯◯◯',
        // Restored HP AND both reset tracks ride in ONE batch — a split
        // (HP first, tracks later) is exactly what could interleave into a
        // standing creature still carrying pre-roll failures.
        writes: { deathSaves: EMPTY_TRACK, deathFailures: EMPTY_TRACK, currentHitPoints: 1 },
        log: expect.objectContaining({
          type: 'death_save', characterName: CHARACTER, roll: 20,
          success: true, hasAdvantage: false, isNatural20: true, isNatural1: false,
          totalSuccesses: 0, totalFailures: 0,
        }),
      },
    ])('rolls a $label: reports feedback, updates the tracks, persists one merged write, and logs it', (tc) => {
      deathSaveRules.rollDeathSave.mockReturnValue(tc.result);
      const { container } = renderComponent();
      clickRollButton();

      expect(onRollResult).toHaveBeenCalledWith(tc.report);
      const tracks = getTracks(container);
      expect(tracks.success).toHaveTextContent(tc.successText);
      expect(tracks.failure).toHaveTextContent(tc.failureText);

      // Exactly ONE write carrying the full post-roll shape (no extra HP key on
      // non-restore rolls — exact-match + call count precludes any second body).
      expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
      expect(setRuntimeBatch).toHaveBeenCalledWith(CHARACTER, tc.writes, CAMPAIGN);
      expect(clearDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, CHARACTER);

      expect(loggedEntries()).toContainEqual(tc.log);
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
      expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
      expect(setRuntimeBatch).toHaveBeenCalledWith(CHARACTER, {
        deathSaves: [true, true, true],
        deathFailures: [true, false, false],
      }, CAMPAIGN);
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

      // The fatal roll reports its face before (and independent of) the isDead
      // write that swaps the panel to the DEAD badge.
      expect(onRollResult).toHaveBeenCalledWith({ roll: 5, success: false, isNat20: false, isNat1: false });
      // ONE merged write carries isDead together with both final tracks — no
      // intermediate can pair DEAD with a stale 2/3 track. A dead outcome
      // never writes HP (unchanged contract): exact payload + count pins both.
      expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
      expect(setRuntimeBatch).toHaveBeenCalledWith(CHARACTER, {
        deathSaves: EMPTY_TRACK,
        deathFailures: [true, true, true],
        isDead: 1,
      }, CAMPAIGN);
      expect(loggedEntries()).toContainEqual(expect.objectContaining({
        type: 'death_save',
        result: 'dead',
        characterName: CHARACTER,
        totalSuccesses: 0,
        totalFailures: 3,
      }));
    });

    it.each([
      ['save modifier plus the nat18-as-20 passive', { saveModifiers: ['death_saving_throws'], automation: { passives: [{ type: 'passive_rule', effect: 'death_save_nat18_as_20' }] } }, true, null, true, true],
      ['Beacon of Hope', {}, false, { target: CHARACTER, effect: 'beacon_of_hope', source: 'Cleric' }, true, false],
      ['no bonus', {}, false, null, false, false],
    ])('routes the roll through the %s entry point with the synced tracks', (_source, extraStats, modifier, beacon, usesAdvantage, treat18AsNat20) => {
      conditionEffects.hasSaveModifier.mockReturnValue(modifier);
      vi.mocked(getActiveTargetEffect).mockReturnValue(beacon);
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

  describe('ADVANTAGE chip tooltip attribution', () => {
    it.each([
      {
        name: 'a save-modifier source',
        modifier: true,
        beacon: null,
        playerStats: { saveModifiers: [{ source: 'Bardic Inspiration', target: 'death_saving_throws', effect: 'advantage' }] },
        title: 'Advantage from: Bardic Inspiration',
      },
      {
        name: 'the Beacon of Hope caster',
        modifier: false,
        beacon: { target: CHARACTER, effect: 'beacon_of_hope', source: 'Cleric' },
        playerStats: {},
        title: 'Advantage from: Beacon of Hope (Cleric)',
      },
      {
        name: 'every stacked source, deduped and filtered to death-save advantage',
        modifier: true,
        beacon: { target: CHARACTER, effect: 'beacon_of_hope', source: 'Cleric' },
        playerStats: {
          saveModifiers: [
            { source: 'Bardic Inspiration', target: 'death_saving_throws', effect: 'advantage' },
            { source: 'Bardic Inspiration', target: 'death_saving_throws', effect: 'advantage' },
            { source: 'Aura', target: 'death_saving_throws', effect: 'advantage' },
            { source: 'Not This', target: 'saving_throw', effect: 'advantage' },
            { source: 'Not That', target: 'death_saving_throws', effect: 'reroll' },
          ],
        },
        title: 'Advantage from: Bardic Inspiration, Aura, Beacon of Hope (Cleric)',
      },
      {
        name: 'unattributable advantage distinctly instead of a phantom source',
        modifier: true,
        beacon: null,
        // Bare DM-flag mod with no source field, plus an ability-scoped mod
        // that hasSaveModifier-without-abilityName would never credit.
        playerStats: {
          saveModifiers: [
            { target: 'death_saving_throws', effect: 'advantage' },
            { source: 'Wrong Scope', target: 'death_saving_throws', effect: 'advantage', abilities: ['CON'] },
          ],
        },
        title: 'Advantage — no source recorded',
      },
    ])('names $name in the tooltip', (tc) => {
      conditionEffects.hasSaveModifier.mockReturnValue(tc.modifier);
      vi.mocked(getActiveTargetEffect).mockReturnValue(tc.beacon);
      renderComponent({ playerStats: tc.playerStats });
      expect(screen.getByText('ADVANTAGE')).toHaveAttribute('title', tc.title);
    });

    it('shows no chip on a plain dying track', () => {
      renderComponent();
      expect(screen.queryByText('ADVANTAGE')).not.toBeInTheDocument();
    });
  });

  describe('clearing the death state of a dead character', () => {
    beforeEach(() => {
      runtimeStore.set(`${CHARACTER}:isDead`, 1);
      runtimeStore.set(`${CHARACTER}:deathFailures`, [true, true, true]);
    });

    it('clears isDead + both tracks in ONE batched write, restores the panel, and logs the removal exactly once', async () => {
      const { container } = renderComponent({ isLocalhost: true });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Clear death state', exact: true }));
      });

      // Single-write pin (improve-run 2026-11-19 whole-bucket write race): the
      // clear is ONE setRuntimeBatch carrying all three fields — the wire shape
      // (one whole-bucket POST) is pinned against the real store module in
      // DeathSavingThrows.clear-single-write.test.jsx.
      expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
      expect(setRuntimeBatch).toHaveBeenCalledWith(CHARACTER, {
        isDead: 0,
        deathSaves: EMPTY_TRACK,
        deathFailures: EMPTY_TRACK,
      }, CAMPAIGN);

      expect(screen.queryByText(/DEAD/)).not.toBeInTheDocument();
      expect(screen.getByText('Death Saves')).toBeInTheDocument();
      expect(getTracks(container).success).toHaveTextContent('Successes: ◯◯◯');
      // HP is NOT restored — the clear only touches the dying track.
      expect(runtimeStore.get(`${CHARACTER}:currentHitPoints`)).toBeUndefined();

      const removedRows = loggedEntries().filter((entry) => entry.result === 'removed');
      expect(removedRows).toHaveLength(1);
      expect(removedRows[0]).toEqual(expect.objectContaining({
        type: 'death_save',
        characterName: CHARACTER,
        result: 'removed',
        totalSuccesses: 0,
        totalFailures: 0,
      }));
    });
  });
});
