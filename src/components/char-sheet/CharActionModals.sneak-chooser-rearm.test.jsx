// @maintained-by-ai
// Regression ledger — bug-sheet-nick-mastery-hit-drops-damage-stage: the
// second+ Devious Strikes cycle within one tab load silently dropped the
// chooser AND the damage stage. Machine cause: the cycle-1 close forwarded
// { attackRiderModal: null } into the spell-modal mirror (spellModalState),
// which merges last; the cycle-2 pipeline opens the chooser only in
// modalState, so the merge produced null, the chooser never mounted, and the
// pipeline stayed paused at cunningStrike (✓ HIT, zero damage, zero feedback,
// sneak latch unconsumed). Only a page reload (fresh mirror) recovered.
//
// Lane map (do not duplicate here):
// - Open-collision precedence for NON-null payloads → CharActionModals.rendering.test.jsx
// - Merge rule itself → modalStateMerge.test.js
// - Close → resume pipeline once → CharActionModals.cunningStrike-resume.test.jsx
// - Pipeline pause/resume damage math + latch stamps → useAttackDamageResolution.cunningStrikeResume.test.js
// - Cycle-1 → cycle-2 chooser re-offer + sneak latch honesty at the pipeline seam →
//   useAttackDamageResolution.sneak-cycle-rearm.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// Minimal mock set — mirrors CharActionModals.cunningStrike-resume.test.jsx.
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

const chooserProps = (targetName) => ({
  action: { name: 'Devious Strikes' },
  playerStats: { name: 'EvasiveFighter' },
  campaignName: 'test-campaign',
  targetName,
});

describe('CharActionModals — cycle-2 Devious Strikes chooser re-arms past a leaked close (sneak-cycle degradation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts the chooser when only modalState carries it and the spell mirror holds the stale cycle-1 close-null', () => {
    render(<CharActionModals
      {...createBaseProps({ resumeAttackPipeline: vi.fn(), rollDamage: vi.fn() })}
      modalState={{ attackRiderModal: chooserProps('ElderPaladin') }}
      spellModalState={{ attackRiderModal: null }}
    />);

    expect(screen.getByTestId('attack-rider-modal')).toBeInTheDocument();
  });

  it('closing that re-armed chooser resumes the pipeline exactly once so the queued damage stage dispatches', () => {
    const props = createBaseProps({ resumeAttackPipeline: vi.fn(), rollDamage: vi.fn() });
    render(<CharActionModals
      {...props}
      modalState={{ attackRiderModal: chooserProps('ElderPaladin') }}
      spellModalState={{ attackRiderModal: null }}
    />);

    fireEvent.click(screen.getByTestId('attack-rider-close'));
    // Resume is fire-and-forget — synchronous assertions are deterministic.
    expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1);
    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    // The close must not roll damage itself; proceedToDamage lands via resume.
    expect(props.rollDamage).not.toHaveBeenCalled();
  });

  it('renders nothing when the chooser is genuinely closed in both channels (no phantom re-open)', () => {
    const { container } = render(<CharActionModals
      {...createBaseProps()}
      modalState={{ attackRiderModal: null }}
      spellModalState={{ attackRiderModal: null }}
    />);

    expect(container).toBeEmptyDOMElement();
  });
});
