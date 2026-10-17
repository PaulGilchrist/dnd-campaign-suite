// @maintained-by-ai
// MantleOfInspirationModal is a 26-line thin wrapper around CreatureSelectionModal
// (tested exhaustively in shared/CreatureSelectionModal.test.jsx). These tests pin
// only the wrapper's own contract: fixed labels, derived description/note strings,
// and verbatim passthrough of targets and callbacks. Unlike Inspiring Smite there is
// NO per-target HP pool split here — each target gains the same tempHp flat.
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MantleOfInspirationModal from './MantleOfInspirationModal.jsx';

// ── Mock CreatureSelectionModal ──

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: vi.fn(() => null),
}));

import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

// ── Test helpers ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
  return {
    creatureTargets: [
      { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
      { name: 'Ally2', type: 'player', currentHp: 15, maxHp: 25 },
    ],
    tempHp: 5,
    dieRoll: 4,
    bardicDieSize: 6,
    maxTargets: 2,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    ...(overrides || {}),
  };
}

function lastProps() {
  const calls = vi.mocked(CreatureSelectionModal).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls.at(-1)[0];
}

// ── Tests ──

describe('MantleOfInspirationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CreatureSelectionModal with fixed labels, passthrough targets and identity-preserved callbacks', () => {
    const props = makeProps();
    render(<MantleOfInspirationModal {...props} />);

    const sent = lastProps();
    expect(sent.title).toBe('Mantle of Inspiration');
    expect(sent.icon).toBe('fa-feather');
    expect(sent.confirmLabel).toBe('Inspire');
    expect(sent.confirmIcon).toBe('fa-feather');
    // targets and callbacks must reach the inner modal untouched
    expect(sent.targets).toBe(props.creatureTargets);
    expect(sent.maxTargets).toBe(2);
    expect(sent.onConfirm).toBe(mockOnConfirm);
    expect(sent.onSkip).toBe(mockOnSkip);
  });

  it('derives description from maxTargets: "up to N" when set, unbounded otherwise', () => {
    render(<MantleOfInspirationModal {...makeProps({ maxTargets: 3 })} />);
    expect(lastProps().description).toBe('Choose up to 3 allies to grant temporary hit points');

    render(<MantleOfInspirationModal {...makeProps({ maxTargets: 0 })} />);
    expect(lastProps().description).toBe('Choose allies to grant temporary hit points');
  });

  it('interpolates die roll, die size, and flat per-target temp HP into the note', () => {
    render(<MantleOfInspirationModal {...makeProps({ tempHp: 10, dieRoll: 7, bardicDieSize: 8 })} />);

    expect(lastProps().note).toBe(
      'Rolled 7 on 1d8: Each target gains 10 temp HP and can use their Reaction to move up to their Speed without provoking Opportunity Attacks.'
    );
  });
});
