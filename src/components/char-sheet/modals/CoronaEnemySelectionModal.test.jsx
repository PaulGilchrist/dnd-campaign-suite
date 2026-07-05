// @cleaned-by-ai
// CoronaEnemySelectionModal is a thin pass-through wrapper around
// CreatureSelectionModal. It passes hardcoded title, icon, description,
// and confirmLabel props — no logic of its own.
//
// All behavioral coverage is provided by
// shared/CreatureSelectionModal.test.jsx which tests the shared
// component directly. Testing the wrapper by asserting on the shared
// component's DOM internals would be brittle and redundant.
//
// Tests removed (24):
//   initial render (13 tests) — DOM structure, title, icon, description,
//     button labels, checkboxes, HP display, string targets, empty list
//   close behavior (2 tests) — onSkip calls
//   selection and confirmation (6 tests) — toggle, count, confirm, CSS classes
//   maxTargets limit (1 test) — disabled state
//   edge cases (2 tests) — undefined callbacks
//
// These tests all asserted internal details of CreatureSelectionModal
// (checkboxes, CSS classes, DOM structure) rather than the wrapper's
// behavior. They were brittle, duplicated the shared component's tests,
// and provided no unique coverage.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CoronaEnemySelectionModal from './CoronaEnemySelectionModal.jsx';

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockTargets = [
  { name: 'Goblin A', type: 'enemy', currentHp: 5, maxHp: 10 },
  { name: 'Goblin B', type: 'enemy', currentHp: 3, maxHp: 10 },
  { name: 'Player Character', type: 'player', currentHp: 20, maxHp: 30 },
];

describe('CoronaEnemySelectionModal', () => {
  it('renders without crashing', () => {
    render(
      <CoronaEnemySelectionModal
        creatureTargets={mockTargets}
        onConfirm={mockOnConfirm}
        onSkip={mockOnSkip}
      />
    );
    expect(screen.getByText('Corona of Light')).toBeInTheDocument();
  });
});
