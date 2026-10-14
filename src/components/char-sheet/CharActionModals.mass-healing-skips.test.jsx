// @maintained-by-ai
// Skip lanes for the mass-healing modals rendered by HealingModals through
// CharActionModals. Each case asserts the observable skip behavior: clicking
// the mounted modal's skip clears exactly its own modalState key and never
// invokes the confirm handler (skip ≠ apply).
//
// Owned elsewhere (not duplicated here):
//   - confirm wiring: CharActionModals.healing-handlers.test.jsx (5 healing
//     modals) and CharActionModals.clockwork-handlers.test.jsx (cavalcade
//     heal/dispel sub-modals + parent routing)
//   - handler internals: useCharActionsModalHandlers.healing.test.js and
//     .areaEffects.test.js
//   - rendering / props mapping: CharActionModals.rendering.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — skip buttons only ──

vi.mock('./modals/MassHealModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return <button data-testid="mass-heal-skip" onClick={onSkip}>Skip</button>;
  },
}));

vi.mock('./modals/MassCureWoundsModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return <button data-testid="mass-cure-skip" onClick={onSkip}>Skip</button>;
  },
}));

vi.mock('./modals/PrayerOfHealingModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return <button data-testid="prayer-skip" onClick={onSkip}>Skip</button>;
  },
}));

vi.mock('./modals/PowerWordFortifyModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return <button data-testid="fortify-skip" onClick={onSkip}>Skip</button>;
  },
}));

vi.mock('./modals/MassHealingWordModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return <button data-testid="healing-word-skip" onClick={onSkip}>Skip</button>;
  },
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return <button data-testid="creature-skip" onClick={onSkip}>Skip</button>;
  },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ creatures: [] }),
}));

// ── Tests ──

describe('CharActionModals — mass healing modal skip handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Each case pins one distinct onSkip wiring line in HealingModals.jsx:
  // modalKey + modal component (via its skip testId) → setModalState clear.
  const skipCases = [
    { modalKey: 'massHealModal', modalData: { creatureTargets: ['Goblin'], totalPool: 50, campaignName: 'test-campaign', combatSummary: {} }, handlerProp: 'handleMassHealConfirm', skipTestId: 'mass-heal-skip' },
    { modalKey: 'massCureWoundsModal', modalData: { creatureTargets: ['Goblin'], maxTargets: 5 }, handlerProp: 'handleMassCureWoundsConfirm', skipTestId: 'mass-cure-skip' },
    { modalKey: 'prayerOfHealingModal', modalData: { creatureTargets: ['Goblin'], maxTargets: 5 }, handlerProp: 'handlePrayerOfHealingConfirm', skipTestId: 'prayer-skip' },
    { modalKey: 'powerWordFortifyModal', modalData: { creatureTargets: ['Goblin'], totalTempHp: 10 }, handlerProp: 'handlePowerWordFortifyConfirm', skipTestId: 'fortify-skip' },
    { modalKey: 'massHealingWordModal', modalData: { creatureTargets: ['Goblin'], maxTargets: 5 }, handlerProp: 'handleMassHealingWordConfirm', skipTestId: 'healing-word-skip' },
    { modalKey: 'clockworkCavalcadeHealModal', modalData: { creatureTargets: ['Goblin'], maxHeal: 100, campaignName: 'test-campaign', combatSummary: {} }, handlerProp: 'handleClockworkCavalcadeHealConfirm', skipTestId: 'mass-heal-skip' },
    { modalKey: 'clockworkCavalcadeDispelModal', modalData: { creatureTargets: [{ name: 'Goblin' }] }, handlerProp: 'handleClockworkCavalcadeDispelConfirm', skipTestId: 'creature-skip' },
    { modalKey: 'naturesSanctuaryCreaturesModal', modalData: { creatureTargets: [{ name: 'Goblin' }], isMove: false }, handlerProp: 'handleNaturesSanctuaryConfirm', skipTestId: 'creature-skip' },
  ];

  for (const { modalKey, modalData, handlerProp, skipTestId } of skipCases) {
    it(`skip closes ${modalKey} without invoking ${handlerProp}`, () => {
      const setModalState = vi.fn();
      const confirmHandler = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({ [handlerProp]: confirmHandler })}
          modalState={{ [modalKey]: modalData }}
          setModalState={setModalState}
        />,
      );
      fireEvent.click(screen.getByTestId(skipTestId));
      expect(setModalState).toHaveBeenCalledWith({ [modalKey]: null });
      expect(confirmHandler).not.toHaveBeenCalled();
    });
  }
});
