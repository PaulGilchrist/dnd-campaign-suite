// @maintained-by-ai
// Regression tests for FT-074: closing the Shield Bash choice modal in
// CharActionModals must resume the attack pipeline paused at featureRiders,
// so the triggering attack's weapon damage always resolves (Apply and Skip
// paths both close through this handler).
//
// Lane map (already covered, NOT duplicated here):
// - Close clears modalState + dispatches refresh events → CharActionModals.modal-closes-2.test.jsx
//   (that lane renders without a resumeAttackPipeline prop, so it also guards
//   the missing-prop tolerance of onClose — no separate test needed here)
// - attackRider / charger / stalker's flurry close-resume → sibling *-resume tests
// - Shield Bash apply/skip effect logic → modals/ShieldBashChoiceModal.test.jsx,
//   services/combat/steps/features/shieldBash.test.js
//
// Mocks mirror CharActionModals.modal-closes-2.test.jsx: only the modules this
// lane touches, plus ones with load-time side effects. Unopened modals render
// nothing and load safely unmocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

vi.mock('./modals/ShieldBashChoiceModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="shield-bash-modal"><button data-testid="shield-bash-close" onClick={onClose}>Done</button></div>;
  },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
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

describe('CharActionModals — Shield Bash modal close resumes pipeline (FT-074)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resumes the attack pipeline exactly once when the shield bash modal closes', () => {
    const props = createBaseProps({ resumeAttackPipeline: vi.fn() });
    props.modalState.shieldBashModal = {
      action: { name: 'Shield Bash' },
      playerStats: props.playerStats,
      campaignName: 'test-campaign',
      targetName: 'Zombie 1',
      saveDc: 15,
    };
    render(<CharActionModals {...props} />);
    fireEvent.click(screen.getByTestId('shield-bash-close'));

    // If resume is silently dropped, the triggering attack's weapon damage
    // never resolves — exactly the FT-074 regression this lane guards.
    expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1);
  });
});
