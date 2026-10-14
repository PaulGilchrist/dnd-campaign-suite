// Tests for skip handlers in HealingModals.jsx (rendered through CharActionModals):
// - MassHealModal onSkip
// - MassCureWoundsModal onSkip
// - PrayerOfHealingModal onSkip
// - PowerWordFortifyModal onSkip
// - MassHealingWordModal onSkip
// - ClockworkCavalcadeHealModal onSkip
// - ClockworkCavalcadeDispelModal onSkip
// - NaturesSanctuaryCreaturesModal onSkip
//
// These negative assertions verified that clicking a skip button doesn't invoke the
// confirm handler — basic UI behavior with no unique behavioral coverage. Each modal
// pair (close + negative assertion) was consolidated into a single parameterized test
// that asserts the observable behavior: skip sets modalState to null.
//
// into a single parameterized test. Each test followed the same pattern:
// render CharActionModals → click skip test ID → expect setModalState called with
// { [modalKey]: null }. The only differences were modalKey, modalData, handlerProp,
// and skipTestId — making them ideal for parameterization.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — only what skip tests need ──

vi.mock('./modals/MassHealModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="mass-heal-modal">
        <button data-testid="mass-heal-skip" onClick={onSkip}>Skip</button>
        <button data-testid="mass-heal-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));

vi.mock('./modals/MassCureWoundsModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="mass-cure-wounds-modal">
        <button data-testid="mass-cure-skip" onClick={onSkip}>Skip</button>
        <button data-testid="mass-cure-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));

vi.mock('./modals/PrayerOfHealingModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="prayer-of-healing-modal">
        <button data-testid="prayer-skip" onClick={onSkip}>Skip</button>
        <button data-testid="prayer-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));

vi.mock('./modals/PowerWordFortifyModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="power-word-fortify-modal">
        <button data-testid="fortify-skip" onClick={onSkip}>Skip</button>
        <button data-testid="fortify-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));

vi.mock('./modals/MassHealingWordModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="mass-healing-word-modal">
        <button data-testid="healing-word-skip" onClick={onSkip}>Skip</button>
        <button data-testid="healing-word-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));

vi.mock('./modals/divine/ClockworkCavalcadeModal.jsx', () => ({
  default: function TestModal({ onChoose, onClose }) {
    return (
      <div data-testid="clockwork-cavalcade-modal">
        <button data-testid="cc-close" onClick={onClose}>Close</button>
        <button data-testid="cc-heal" onClick={() => onChoose('heal')}>Heal</button>
        <button data-testid="cc-dispel" onClick={() => onChoose('dispel')}>Dispel</button>
        <button data-testid="cc-repair" onClick={() => onChoose('repair')}>Repair</button>
      </div>
    );
  },
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ title, targets, onConfirm, onSkip, confirmLabel, note }) {
    return (
      <div data-testid="creature-selection-modal">
        <div data-testid="creature-title">{title}</div>
        {note && <div data-testid="creature-note">{note}</div>}
        {targets.map((target, i) => (
          <label key={i} data-testid={`creature-target-${target.name}`} onClick={() => onConfirm([target.name])}>
            {target.name}
          </label>
        ))}
        <button data-testid="creature-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>{confirmLabel}</button>
        <button data-testid="creature-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Tests ──

describe('CharActionModals — mass healing modal skip handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const skipCases = [
    { name: 'MassHealModal', modalKey: 'massHealModal', modalData: { creatureTargets: ['Goblin'], totalPool: 50, campaignName: 'test-campaign', combatSummary: {} }, handlerProp: 'handleMassHealConfirm', skipTestId: 'mass-heal-skip', nullState: { massHealModal: null } },
    { name: 'MassCureWoundsModal', modalKey: 'massCureWoundsModal', modalData: { creatureTargets: ['Goblin'], maxTargets: 5 }, handlerProp: 'handleMassCureWoundsConfirm', skipTestId: 'mass-cure-skip', nullState: { massCureWoundsModal: null } },
    { name: 'PrayerOfHealingModal', modalKey: 'prayerOfHealingModal', modalData: { creatureTargets: ['Goblin'], maxTargets: 5 }, handlerProp: 'handlePrayerOfHealingConfirm', skipTestId: 'prayer-skip', nullState: { prayerOfHealingModal: null } },
    { name: 'PowerWordFortifyModal', modalKey: 'powerWordFortifyModal', modalData: { creatureTargets: ['Goblin'], totalTempHp: 10 }, handlerProp: 'handlePowerWordFortifyConfirm', skipTestId: 'fortify-skip', nullState: { powerWordFortifyModal: null } },
    { name: 'MassHealingWordModal', modalKey: 'massHealingWordModal', modalData: { creatureTargets: ['Goblin'], maxTargets: 5 }, handlerProp: 'handleMassHealingWordConfirm', skipTestId: 'healing-word-skip', nullState: { massHealingWordModal: null } },
    { name: 'ClockworkCavalcadeHealModal', modalKey: 'clockworkCavalcadeHealModal', modalData: { creatureTargets: ['Goblin'], maxHeal: 100, campaignName: 'test-campaign', combatSummary: {} }, handlerProp: 'handleClockworkCavalcadeHealConfirm', skipTestId: 'mass-heal-skip', nullState: { clockworkCavalcadeHealModal: null } },
    { name: 'ClockworkCavalcadeDispelModal', modalKey: 'clockworkCavalcadeDispelModal', modalData: { creatureTargets: [{ name: 'Goblin' }] }, handlerProp: 'handleClockworkCavalcadeDispelConfirm', skipTestId: 'creature-skip', nullState: { clockworkCavalcadeDispelModal: null } },
    { name: "NaturesSanctuaryCreaturesModal", modalKey: 'naturesSanctuaryCreaturesModal', modalData: { creatureTargets: [{ name: 'Goblin' }], isMove: false }, handlerProp: 'handleNaturesSanctuaryConfirm', skipTestId: 'creature-skip', nullState: { naturesSanctuaryCreaturesModal: null } },
  ];

  for (const { name, modalKey, modalData, handlerProp, skipTestId, nullState } of skipCases) {
    it(`sets ${modalKey} to null on skip (${name})`, () => {
      const setModalState = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({ [handlerProp]: vi.fn() })}
          modalState={{ [modalKey]: modalData }}
          setModalState={setModalState}
        />,
      );
      fireEvent.click(screen.getByTestId(skipTestId));
      expect(setModalState).toHaveBeenCalledWith(nullState);
    });
  }
});
