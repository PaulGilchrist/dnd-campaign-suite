// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VitalityOfTheTreeModal from './VitalityOfTheTreeModal.jsx';

// Thin-wrapper lane only: this component's entire behavior is forwarding
// exact copy, targets, and callbacks to CreatureSelectionModal. All
// selection, target-formatting, empty-state, and confirm/skip behavior is
// covered by shared/CreatureSelectionModal.test.jsx — the mock stays
// inert so this file never verifies mock internals.
vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: vi.fn(() => null),
}));

import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

const MockedModal = vi.mocked(CreatureSelectionModal);

const objectTargets = [
  { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
  { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
  { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 40 },
];

describe('VitalityOfTheTreeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the exact vitality copy, targets, and callbacks to CreatureSelectionModal', () => {
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    render(
      <VitalityOfTheTreeModal
        creatureTargets={objectTargets}
        tempHp={7}
        maxTargets={3}
        onConfirm={onConfirm}
        onSkip={onSkip}
      />
    );

    expect(MockedModal).toHaveBeenCalledTimes(1);
    expect(MockedModal.mock.calls[0][0]).toEqual({
      title: 'Vitality of the Tree',
      icon: 'fa-tree',
      targets: objectTargets,
      maxTargets: 3,
      description: 'Choose up to 3 creatures to grant temporary hit points',
      note: "Each target gains 7 temp HP from the World Tree's life force.",
      confirmLabel: 'Grant Vitality',
      confirmIcon: 'fa-tree',
      onConfirm,
      onSkip,
    });
  });

  it('interpolates maxTargets and tempHp into description and note, including tempHp of 0', () => {
    render(
      <VitalityOfTheTreeModal
        creatureTargets={[]}
        tempHp={0}
        maxTargets={1}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(MockedModal).toHaveBeenCalledTimes(1);
    const { description, note } = MockedModal.mock.calls[0][0];
    expect(description).toBe('Choose up to 1 creatures to grant temporary hit points');
    expect(note).toBe("Each target gains 0 temp HP from the World Tree's life force.");
  });
});
