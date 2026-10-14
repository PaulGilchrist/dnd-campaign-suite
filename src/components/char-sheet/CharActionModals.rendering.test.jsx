// @maintained-by-ai
// Rendering tests for CharActionModals.jsx — the host that merges two modal
// state sources (modalState + spellModalState) and wires derived props into
// the modals it mounts.
//
// Scope — behaviors unique to this file:
// - Empty fragment when no modals are active (host smoke test).
// - mergedModalState: modals supplied only via spellModalState must mount,
//   and spellModalState must win collisions with modalState. Nothing else in
//   the suite seeds spellModalState (modal-closes-3.test.jsx closes a modal
//   seeded via modalState), so without these tests the merge line
//   `{ ...modalState, ...spellModalState }` could drop spellModalState
//   entirely and every sibling test would still pass.
// - isMoonlightStepTeleport derivation on the TeleportModal host wiring
//   (TeleportModal.test.jsx covers the flag inside the modal, not this
//   host's derivation from the action payload; the positive case rides on
//   the collision test below since the winning spell-side payload is the
//   moonlight one).
//
// Close, handler, selection, and resume behaviors are covered by the other
// CharActionModals.*.test.jsx files (see their headers for the coverage map).
//
// NOTE: vi.mock() is hoisted to the top of the file by Vitest, so all mock
// factories must be defined inline (no references to top-level variables).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks (only components mounted by these tests + infrastructure) ──

vi.mock('./modals/WildMagicSurgeModal.jsx', () => ({
  default: function TestModal() {
    return <div data-testid="wild-magic-surge-modal" />;
  },
}));
vi.mock('./modals/TeleportModal.jsx', () => ({
  default: function TestModal({ isMoonlightStep }) {
    return <div data-testid="teleport-modal">isMoonlightStep={String(isMoonlightStep)}</div>;
  },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

// ── Fixtures ──

const plainTeleport = { action: { name: 'Teleport', automation: { type: 'teleport' } } };
const moonlightTeleport = {
  action: { name: 'Moonlight Step', automation: { type: 'teleport', effect: 'moonlight_step_teleport' } },
};
const surgePayload = { surgeTable: [], mode: 'roll' };

// ── Tests ──

describe('CharActionModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty fragment when no modal props are set', () => {
    const { container } = render(<CharActionModals {...createBaseProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mounts modals supplied only via spellModalState, and spell state wins collisions with modalState', () => {
    render(<CharActionModals
      {...createBaseProps()}
      modalState={{ teleportModal: plainTeleport }}
      spellModalState={{ teleportModal: moonlightTeleport, wildMagicSurgeModal: surgePayload }}
      setSpellModalState={vi.fn()}
    />);

    // spell-only modal mounts via the merge
    expect(screen.getByTestId('wild-magic-surge-modal')).toBeInTheDocument();
    // collision: spell-side payload wins (moonlight flag proves it is the
    // spellModalState teleport, not the plain modalState one), mounted once
    const teleports = screen.getAllByTestId('teleport-modal');
    expect(teleports).toHaveLength(1);
    expect(teleports[0]).toHaveTextContent('isMoonlightStep=true');
  });

  it('renders a plain modalState teleport without the moonlight flag', () => {
    render(<CharActionModals
      {...createBaseProps()}
      modalState={{ teleportModal: plainTeleport }}
    />);

    expect(screen.getByTestId('teleport-modal')).toHaveTextContent('isMoonlightStep=false');
  });
});
