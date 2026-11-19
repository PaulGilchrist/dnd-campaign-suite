// @maintained-by-ai
// Regression (bug-death-save-terminal-roll-chip-never-renders): the per-roll
// death-save result chip must mount on EVERY roll — including the life-ending
// ones. It used to live inside DeathSavingThrows, where the terminal isDead /
// currentHitPoints writes batched into the same React commit as the chip
// state: the fatal roll rendered the DEAD-badge branch (no chip) and the
// NAT 20's HP restore unmounted the whole block behind CharHitPoints'
// `currentHitPoints <= 0` gate, so the chip node was never created. The chip
// host now lives in CharHitPoints itself, outside both swaps.
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharHitPoints from './CharHitPoints.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

// Stand-in capturing the onRollResult callback the host passes down (the real
// DeathSavingThrows reports every sheet roll through it — chip rendering is
// the host's job and is what these pins lock).
let capturedOnRollResult;
vi.mock('./DeathSavingThrows.jsx', () => ({
  default: vi.fn(({ onRollResult }) => {
    capturedOnRollResult = onRollResult;
    return <div>Death Saving Throws for dying state</div>;
  }),
}));

import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const NAME = 'TestCharacter';
const CAMPAIGN = 'test-campaign';

function mockRuntimeValues(values = {}) {
  useRuntimeValue.mockImplementation((_, prop) => values[prop] ?? null);
}

function renderCharHitPoints() {
  return render(
    <CharHitPoints playerStats={{ name: NAME, hitPoints: 112 }} campaignName={CAMPAIGN} />
  );
}

function chip() {
  return document.querySelector('.death-saves-result');
}

describe('CharHitPoints — death-save result chip host', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    capturedOnRollResult = undefined;
    mockRuntimeValues({ currentHitPoints: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('paints the NAT 20 chip on a terminal restore and keeps it through the block unmount', () => {
    const { rerender } = renderCharHitPoints();
    expect(screen.getByText(/Death Saving Throws/)).toBeInTheDocument();

    // Sheet-roll lane: DeathSavingThrows reports the nat20 face, then the
    // currentHitPoints:1 mirror write re-renders the SAME commit's host with
    // the `currentHitPoints <= 0` gate closed (block unmounts).
    act(() => {
      capturedOnRollResult({ roll: 20, success: true, isNat20: true, isNat1: false });
    });
    mockRuntimeValues({ currentHitPoints: 1 });
    act(() => {
      rerender(
        <CharHitPoints playerStats={{ name: NAME, hitPoints: 112 }} campaignName={CAMPAIGN} />
      );
    });

    expect(screen.queryByText(/Death Saving Throws/)).not.toBeInTheDocument();
    expect(chip()).not.toBeNull();
    expect(chip()).toHaveTextContent('(20)');
    expect(chip()).toHaveTextContent('NAT 20');
    expect(chip()).toHaveTextContent('Success');
  });

  it('paints the failure chip alongside the isDead branch swap on the fatal third failure', () => {
    const { rerender } = renderCharHitPoints();

    act(() => {
      capturedOnRollResult({ roll: 7, success: false, isNat20: false, isNat1: false });
    });
    mockRuntimeValues({ currentHitPoints: 0, isDead: 1 });
    act(() => {
      rerender(
        <CharHitPoints playerStats={{ name: NAME, hitPoints: 112 }} campaignName={CAMPAIGN} />
      );
    });

    // Chip lives outside DeathSavingThrows entirely, so whatever branch the
    // block takes (DEAD badge), the result face still dwells.
    expect(chip()).not.toBeNull();
    expect(chip()).toHaveTextContent('(7)');
    expect(chip()).toHaveTextContent('Failure');
    expect(chip().className).toContain('death-saves-result--failure');
  });

  it('renders a non-terminal chip too and hides it after the 2 s dwell (benign UI timer only)', () => {
    vi.useFakeTimers();
    renderCharHitPoints();

    act(() => {
      capturedOnRollResult({ roll: 14, success: true, isNat20: false, isNat1: false });
    });
    expect(chip()).toHaveTextContent('(14)');
    expect(chip().className).toContain('death-saves-result--success');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(chip()).toBeNull();
  });

  it('paints the chip from a death-save-result window event (modal-driven rolls)', () => {
    renderCharHitPoints();

    act(() => {
      window.dispatchEvent(new CustomEvent('death-save-result', {
        detail: { targetName: NAME, roll: 20, success: true, isNat20: true, isNat1: false, restoredToHp: 1 },
      }));
    });

    expect(chip()).toHaveTextContent('(20)');
    expect(chip()).toHaveTextContent('NAT 20');
    // The HP-restore leg of the listener is unchanged.
    expect(setRuntimeValue).toHaveBeenCalledWith(NAME, 'currentHitPoints', 1, CAMPAIGN);
  });

  it('skips the chip for a bare restore event with no roll', () => {
    renderCharHitPoints();

    act(() => {
      window.dispatchEvent(new CustomEvent('death-save-result', {
        detail: { targetName: NAME, restoredToHp: 8 },
      }));
    });

    expect(chip()).toBeNull();
    expect(setRuntimeValue).toHaveBeenCalledWith(NAME, 'currentHitPoints', 8, CAMPAIGN);
  });

  it('ignores a death-save-result event for a different character', () => {
    renderCharHitPoints();

    act(() => {
      window.dispatchEvent(new CustomEvent('death-save-result', {
        detail: { targetName: 'OtherCharacter', roll: 20, success: true, isNat20: true },
      }));
    });

    expect(chip()).toBeNull();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
