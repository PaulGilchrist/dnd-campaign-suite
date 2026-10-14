// @maintained-by-ai
// Real (unmocked) modal-render lane for CharActionModals host slots: the
// Healing Illusion target picker (SecondaryTargetModal), the
// SecondaryTargetModals mapping entries for Starry Form: Chalice and
// Destructive Stride — Choose Target, and host-mount + action forwarding for
// Elemental Epitome and Destructive Stride. Other CharActionModals test
// files mock these modals, so all REAL rendering assertions live here.
//
// Deliberately NOT covered here (stronger versions live elsewhere):
// - Host props into mocked pickers (title/desc/showHp/merge + dedup,
//   incl. characters/combatSummary merge): CharActionModals.helper-modals.test.jsx
// - Confirm/skip side effects (heals, buff removal, logging):
//   CharActionModals.handlers2.test.jsx
// - Starry Chalice confirm heal + popup and skip-close:
//   CharActionModals.handler-callbacks.test.jsx, CharActionModals.helper-modals.test.jsx
// - CLA-113 epitome/stride confirm + target confirm/skip wiring:
//   CharActionModals.async-confirm-handlers.test.jsx
// - Epitome/stride modal internal content (fallback titles, resistance lists):
//   ElementalEpitomeModal.test.jsx, DestructiveStrideModal.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';

// ── Mocks — services touched at mount. Modals stay REAL: rendering
// assertions are this file's lane. ──

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));
// Target rows poll map status; keep deterministic with no distance badges.
vi.mock('../../services/maps/spellOverlayService.js', () => ({
  getTargetMapStatuses: vi.fn().mockResolvedValue(null),
  distanceBadgeText: vi.fn(() => ''),
}));

// ── Tests ──

describe('CharActionModals — real modal rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders the Healing Illusion target picker with null characters and combatSummary', () => {
    render(<CharActionModals
      {...createBaseProps({ characters: null, combatSummary: null })}
      modalState={{ healingIllusionModal: {} }}
      setModalState={vi.fn()}
    />);

    expect(screen.getByText('Healing Illusion')).toBeInTheDocument();
  });

  it('shows the heal amount from player level (defaulting to 1) with targets merged from characters and combat context', async () => {
    getCombatContext.mockResolvedValueOnce({
      creatures: [{ name: 'Borbbury', type: 'humanoid', currentHp: 10, maxHp: 25 }],
    });

    render(<CharActionModals
      {...createBaseProps({
        playerStats: { name: 'Caster', level: 5 },
        characters: [{ name: 'Alric', type: 'player', size: 'Medium', currentHp: 20, maxHp: 30 }],
      })}
      modalState={{ healingIllusionModal: { action: { name: 'Healing Illusion' }, playerStats: { name: 'Caster', level: 5 } } }}
      setModalState={vi.fn()}
    />);

    // Host builds the description from playerStats.level...
    expect(screen.getByText(/regain 5 HP/)).toBeInTheDocument();
    // ...and buildHealingIllusionTargets merges characters with the fetched
    // combat-context creatures, with HP shown on each row (showHp=true).
    expect(screen.getByText('Alric')).toBeInTheDocument();
    expect(screen.getByText(/20\/30 HP/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Borbbury')).toBeInTheDocument());
    expect(screen.getByText(/10\/25 HP/)).toBeInTheDocument();

    cleanup();
    render(<CharActionModals
      {...createBaseProps({ playerStats: { name: 'Caster' } })}
      modalState={{ healingIllusionModal: {} }}
      setModalState={vi.fn()}
    />);

    // ...defaulting to 1 HP when level is unset.
    expect(screen.getByText(/regain 1 HP/)).toBeInTheDocument();
  });

  it('mounts SecondaryTargetModals entries for Starry Chalice and Destructive Stride target with mapped titles and targets', () => {
    render(<CharActionModals
      {...createBaseProps()}
      modalState={{
        starryChaliceHealModal: { targetNames: ['Ally1'], amount: 10 },
        destructiveStrideTargetModal: { targets: [{ name: 'Goblin' }] },
      }}
      setModalState={vi.fn()}
    />);

    expect(screen.getByText('Starry Form: Chalice')).toBeInTheDocument();
    // Payload targetNames are mapped into picker rows.
    expect(screen.getByText('Ally1')).toBeInTheDocument();
    expect(screen.getByText(/Chalice constellation/)).toBeInTheDocument();

    expect(screen.getByText('Destructive Stride — Choose Target')).toBeInTheDocument();
    // Payload targets are mapped into picker rows.
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText(/Choose a creature only if the monk comes within 5 ft/)).toBeInTheDocument();
  });

  it('mounts the Elemental Epitome and Destructive Stride modals forwarding the payload action', () => {
    render(<CharActionModals
      {...createBaseProps()}
      modalState={{
        epitomeModal: { action: { name: 'Epitome of the Flame' }, playerStats: {}, campaignName: 'test-campaign', currentResistance: 'fire' },
        destructiveStrideModal: { action: { name: 'Stride of Thunder' }, playerStats: {}, campaignName: 'test-campaign' },
      }}
      setModalState={vi.fn()}
    />);

    // Distinctive action names prove the host forwards payload.action
    // (not just the modals' hardcoded fallback titles).
    expect(screen.getByText('Epitome of the Flame')).toBeInTheDocument();
    expect(screen.getByText(/Choose your damage resistance type/)).toBeInTheDocument();
    expect(screen.getByText('Stride of Thunder')).toBeInTheDocument();
    expect(screen.getByText(/Choose the damage type/)).toBeInTheDocument();
  });
});
