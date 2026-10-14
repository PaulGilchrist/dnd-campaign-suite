//   CreatureSelectionModal.test.jsx (598 lines). MantleOfInspirationModal is a
//   26-line thin wrapper — testing its rendered output was re-testing the
//   underlying component. The remaining tests verify the wrapper's specific
//   prop configuration via mocking (the correct pattern for thin wrappers).
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

const mockCreatureTargets = [
  { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
  { name: 'Ally2', type: 'player', currentHp: 15, maxHp: 25 },
];

function makeProps(overrides) {
  return {
    creatureTargets: mockCreatureTargets,
    tempHp: 5,
    dieRoll: 4,
    bardicDieSize: 6,
    maxTargets: 2,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('MantleOfInspirationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prop passthrough', () => {
    it('passes fixed title and icon to CreatureSelectionModal', () => {
      render(<MantleOfInspirationModal {...makeProps()} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.title).toBe('Mantle of Inspiration');
      expect(props.icon).toBe('fa-feather');
    });

    it('passes creatureTargets as targets', () => {
      render(<MantleOfInspirationModal {...makeProps()} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.targets).toEqual(mockCreatureTargets);
    });

    it('passes maxTargets through', () => {
      render(<MantleOfInspirationModal {...makeProps({ maxTargets: 5 })} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.maxTargets).toBe(5);
    });

    it('passes onConfirm and onSkip callbacks', () => {
      render(<MantleOfInspirationModal {...makeProps()} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.onConfirm).toBe(mockOnConfirm);
      expect(props.onSkip).toBe(mockOnSkip);
    });

    it('passes string targets as targets', () => {
      const stringTargets = ['AllyA', 'AllyB'];
      render(<MantleOfInspirationModal {...makeProps({ creatureTargets: stringTargets })} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.targets).toEqual(stringTargets);
    });

    it('passes empty creatureTargets as empty targets', () => {
      render(<MantleOfInspirationModal {...makeProps({ creatureTargets: [] })} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.targets).toEqual([]);
    });

    it('constructs description with "up to N" when maxTargets is truthy', () => {
      render(<MantleOfInspirationModal {...makeProps({ maxTargets: 3 })} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.description).toBe('Choose up to 3 allies to grant temporary hit points');
    });

    it('constructs description without "up to" when maxTargets is falsy', () => {
      render(<MantleOfInspirationModal {...makeProps({ maxTargets: 0 })} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.description).toBe('Choose allies to grant temporary hit points');
    });

    it('constructs note with die roll, bardic die size, temp HP, and reaction info', () => {
      render(<MantleOfInspirationModal {...makeProps({ tempHp: 10, dieRoll: 7, bardicDieSize: 8 })} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.note).toBe('Rolled 7 on 1d8: Each target gains 10 temp HP and can use their Reaction to move up to their Speed without provoking Opportunity Attacks.');
    });

    it('passes confirmLabel and confirmIcon for the button', () => {
      render(<MantleOfInspirationModal {...makeProps()} />);
      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.confirmLabel).toBe('Inspire');
      expect(props.confirmIcon).toBe('fa-feather');
    });
  });
});
