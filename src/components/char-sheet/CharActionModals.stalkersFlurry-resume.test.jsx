// @maintained-by-ai
// Regression tests for CLA-326: closing the Stalker's Flurry choice modal in
// CharActionModals must resume the attack pipeline paused at featureRiders, so
// the triggering attack's weapon damage always resolves. Cancel (no option chosen)
// stamps the once-per-round skip flag and awaits resume first; Apply (option
// chosen via the runtime store) resumes without stamping the skip flag.
//
// Lane map (already covered, NOT duplicated here):
// - Generic attackRiderModal close + refresh events → CharActionModals.modal-closes.test.jsx
//   (missing-resume-prop tolerance is not tested here on purpose: setModalState runs
//   before the resume call site, so such a test passes even if the ?.() guard were
//   removed — zero signal; CharActions.jsx always passes the prop)
// - Charger skip latch → charger-resume · Cunning Strike resume → cunningStrike-resume
//   · Shield Bash → shieldBash-resume
// - Secondary-target flow after apply → modals/shared/AttackRiderModal.test.jsx
//
// Mocks mirror CharActionModals.modal-closes.test.jsx: only the modules this lane
// touches, plus ones with load-time side effects. Unopened modals render nothing
// and load safely unmocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

vi.mock('./modals/shared/AttackRiderModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="attack-rider-modal"><button data-testid="attack-rider-close" onClick={onClose}>Done</button></div>;
  },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
  setSkipFlag: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setSkipFlag } from '../../services/automation/common/oncePerTurn.js';

// Opens the Stalker's Flurry rider modal, renders CharActionModals, clicks the
// stub modal's close button, and returns the props for close-behavior assertions.
// `runtimeOptions` maps runtime-store keys to the values getRuntimeValue should
// return (empty = player chose Cancel without applying an option).
function renderAndCloseFlurryModal(runtimeOptions = {}) {
  getRuntimeValue.mockImplementation((_name, key) => runtimeOptions[key] ?? null);
  const props = createBaseProps({
    resumeAttackPipeline: vi.fn(() => Promise.resolve()),
    rollDamage: vi.fn(),
  });
  props.modalState.attackRiderModal = {
    action: {
      name: "Stalker's Flurry",
      type: 'attack_rider',
      options: [
        { name: 'Sudden Strike', effect: 'sudden_strike' },
        { name: 'Mass Fear', effect: 'mass_fear' },
      ],
    },
    playerStats: props.playerStats,
    campaignName: 'test-campaign',
    targetName: 'Thug 1',
  };
  render(<CharActionModals {...props} />);
  fireEvent.click(screen.getByTestId('attack-rider-close'));
  return props;
}

describe('CharActionModals — Stalker\'s Flurry modal close resumes pipeline (CLA-326)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Cancel: stamps the skip flag, closes the modal, and resumes without rolling damage', async () => {
    const props = renderAndCloseFlurryModal();

    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    expect(setSkipFlag).toHaveBeenCalledWith("_Stalker's_Flurry_skippedRound", props.playerStats, 'test-campaign');
    // resume follows the awaited skip-flag write — flush the async close handler
    await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
    // The close handler must not short-circuit the pipeline by rolling damage
    // itself — the weapon damage lands downstream via resume (CLA-326).
    expect(props.rollDamage).not.toHaveBeenCalled();
  });

  it('Apply: closes the modal and resumes without stamping the skip flag', async () => {
    const props = renderAndCloseFlurryModal({ "_Stalker's_Flurry_option": 'Mass Fear' });

    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    expect(setSkipFlag).not.toHaveBeenCalled();
    await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
    expect(props.rollDamage).not.toHaveBeenCalled();
  });
});
