// @maintained-by-ai
// Confirm wiring for the mass-healing modals rendered through CharActionModals:
// clicking a modal's confirm button invokes its handler prop with the modal's
// selected targets (payload flows modalState → modal → handler prop).
//
// Covered elsewhere (not duplicated here):
//   - skip handlers: CharActionModals.mass-healing-skips.test.jsx
//   - clockwork cavalcade routing + heal/dispel confirm wiring:
//     CharActionModals.clockwork-handlers.test.jsx
//   - rendering / props mapping: CharActionModals.rendering.test.jsx
//   - handler internals: useCharActionsModalHandlers.healing.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — only the modals that actually mount, plus infrastructure ──

// Each mock emits its creatureTargets' names on confirm, proving the payload
// flows from modalState through the modal to the handler prop.
function confirmTargetsMock(testId) {
  return {
    default: function TestModal({ creatureTargets, onConfirm }) {
      return (
        <div data-testid={testId}>
          <button data-testid={`${testId}-confirm`} onClick={() => onConfirm(creatureTargets.map(t => t.name))}>Confirm</button>
        </div>
      );
    },
  };
}

vi.mock('./modals/MassHealModal.jsx', () => confirmTargetsMock('mass-heal-modal'));
vi.mock('./modals/MassCureWoundsModal.jsx', () => confirmTargetsMock('mass-cure-wounds-modal'));
vi.mock('./modals/PrayerOfHealingModal.jsx', () => confirmTargetsMock('prayer-of-healing-modal'));
vi.mock('./modals/PowerWordFortifyModal.jsx', () => confirmTargetsMock('power-word-fortify-modal'));
vi.mock('./modals/MassHealingWordModal.jsx', () => confirmTargetsMock('mass-healing-word-modal'));

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

// ── Tests ──

describe('CharActionModals — mass healing modal confirm wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Each case verifies a distinct modalKey → handlerProp mapping.
  const cases = [
    { name: 'Mass Heal', modalKey: 'massHealModal', modalTestId: 'mass-heal-modal', handlerProp: 'handleMassHealConfirm', modalData: { totalPool: 50, maxTargets: 5, campaignName: 'test-campaign', combatSummary: {} } },
    { name: 'Mass Cure Wounds', modalKey: 'massCureWoundsModal', modalTestId: 'mass-cure-wounds-modal', handlerProp: 'handleMassCureWoundsConfirm', modalData: { maxTargets: 5 } },
    { name: 'Prayer of Healing', modalKey: 'prayerOfHealingModal', modalTestId: 'prayer-of-healing-modal', handlerProp: 'handlePrayerOfHealingConfirm', modalData: { maxTargets: 5 } },
    { name: 'Power Word Fortify', modalKey: 'powerWordFortifyModal', modalTestId: 'power-word-fortify-modal', handlerProp: 'handlePowerWordFortifyConfirm', modalData: { totalTempHp: 10 } },
    { name: 'Mass Healing Word', modalKey: 'massHealingWordModal', modalTestId: 'mass-healing-word-modal', handlerProp: 'handleMassHealingWordConfirm', modalData: { maxTargets: 5 } },
  ];

  const creatureTargets = [{ name: 'Ally1' }, { name: 'Ally2' }];

  for (const { name, modalKey, modalTestId, handlerProp, modalData } of cases) {
    it(`invokes ${handlerProp} once with the selected targets for ${name}`, () => {
      const handler = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({ [handlerProp]: handler })}
          modalState={{ [modalKey]: { ...modalData, creatureTargets } }}
          setModalState={vi.fn()}
        />
      );
      // Only this case's modal should be mounted — no cross-modal leakage.
      expect(screen.queryAllByTestId(modalTestId)).toHaveLength(1);
      fireEvent.click(screen.getByTestId(`${modalTestId}-confirm`));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(['Ally1', 'Ally2']);
    });
  }
});
