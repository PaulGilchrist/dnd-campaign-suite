// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionSpellPopups from './CharActionSpellPopups.jsx';

vi.mock('../common/popup.jsx', () => ({
  default: function TestPopup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: function TestMetamagicPopup() {
    return <div data-testid="metamagic-popup" />;
  },
}));

// Stub that surfaces how the component wires each ally-selection spell:
// title identifies the modal, targets/maxTargets verify data pass-through,
// and confirm/skip buttons let tests verify the pending→handler dispatch.
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestCreatureSelectionModal({ title, targets, maxTargets, onConfirm, onSkip }) {
    return (
      <div data-testid={`creature-selection-${title}`}>
        <span data-testid="targets">{(targets || []).map(t => (typeof t === 'string' ? t : t.name)).join(',')}</span>
        {maxTargets !== undefined && <span data-testid="max-targets">{String(maxTargets)}</span>}
        <button data-testid="confirm" onClick={() => onConfirm((targets || []).map(t => (typeof t === 'string' ? t : t.name)))}>Confirm</button>
        <button data-testid="skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: function TestSpellDetailPopup() {
    return <div data-testid="spell-detail-popup" />;
  },
}));

vi.mock('./popups/MagicMissileTargetPopup.jsx', () => ({
  default: function TestMagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup" />;
  },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

function createBaseProps(overrides) {
  return {
    playerStats: { name: 'Test Character', level: 5 },
    campaignName: 'test-campaign',
    selectedActionSpell: null,
    setSelectedActionSpell: vi.fn(),
    buildUpcastLevels: vi.fn(() => []),
    handleActionSpellCast: vi.fn(),
    actionPendingMetamagic: null,
    actionHandleConfirm: vi.fn(),
    actionHandleSkip: vi.fn(),
    actionPendingAid: null,
    actionHandleAidConfirm: vi.fn(),
    actionHandleAidSkip: vi.fn(),
    actionPendingBane: null,
    actionHandleBaneConfirm: vi.fn(),
    actionHandleBaneSkip: vi.fn(),
    actionPendingBless: null,
    actionHandleBlessConfirm: vi.fn(),
    actionHandleBlessSkip: vi.fn(),
    actionPendingFaerieFire: null,
    actionHandleFaerieFireConfirm: vi.fn(),
    actionHandleFaerieFireSkip: vi.fn(),
    actionPendingBeaconOfHope: null,
    actionHandleBeaconOfHopeConfirm: vi.fn(),
    actionHandleBeaconOfHopeSkip: vi.fn(),
    actionPendingPassWithoutTrace: null,
    actionHandlePassWithoutTraceConfirm: vi.fn(),
    actionHandlePassWithoutTraceSkip: vi.fn(),
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    ...overrides,
  };
}

// One row per spell in ALLY_SELECTION_MODAL_SPECS: exercises the full
// pending→modal→handler wiring for that spell in a single render.
const allySelectionSpells = [
  { name: 'Aid', pending: 'actionPendingAid', confirm: 'actionHandleAidConfirm', skip: 'actionHandleAidSkip', targets: ['Ally1', 'Ally2'], maxTargets: 3 },
  { name: 'Bane', pending: 'actionPendingBane', confirm: 'actionHandleBaneConfirm', skip: 'actionHandleBaneSkip', targets: ['Goblin1', 'Goblin2'], maxTargets: 3 },
  { name: 'Bless', pending: 'actionPendingBless', confirm: 'actionHandleBlessConfirm', skip: 'actionHandleBlessSkip', targets: ['Ally1', 'Ally2'], maxTargets: 3 },
  { name: 'Faerie Fire', pending: 'actionPendingFaerieFire', confirm: 'actionHandleFaerieFireConfirm', skip: 'actionHandleFaerieFireSkip', targets: ['Goblin1', 'Goblin2'] },
  { name: 'Beacon of Hope', pending: 'actionPendingBeaconOfHope', confirm: 'actionHandleBeaconOfHopeConfirm', skip: 'actionHandleBeaconOfHopeSkip', targets: ['Ally1', 'Ally2'] },
  { name: 'Pass Without Trace', pending: 'actionPendingPassWithoutTrace', confirm: 'actionHandlePassWithoutTraceConfirm', skip: 'actionHandlePassWithoutTraceSkip', targets: ['Ally1', 'Ally2'] },
];

describe('CharActionSpellPopups - CreatureSelectionModal Spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(allySelectionSpells)(
    'wires $name: shows pending targets, casts through $confirm, cancels through $skip',
    ({ name, pending, confirm, skip, targets, maxTargets }) => {
      const confirmFn = vi.fn();
      const skipFn = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ [confirm]: confirmFn, [skip]: skipFn })}
          {...{ [pending]: { creatureTargets: targets, maxTargets } }}
        />
      );

      const modal = screen.getByTestId(`creature-selection-${name}`);
      expect(modal).toBeInTheDocument();
      expect(screen.getByTestId('targets')).toHaveTextContent(targets.join(','));
      if (maxTargets !== undefined) {
        expect(screen.getByTestId('max-targets')).toHaveTextContent(String(maxTargets));
      } else {
        expect(screen.queryByTestId('max-targets')).not.toBeInTheDocument();
      }

      screen.getByTestId('confirm').click();
      expect(confirmFn).toHaveBeenCalledWith(targets);

      screen.getByTestId('skip').click();
      expect(skipFn).toHaveBeenCalled();
    }
  );

  it('renders no creature-selection modal when no spell is pending', () => {
    const { container } = render(<CharActionSpellPopups {...createBaseProps()} />);
    expect(container.querySelectorAll('[data-testid^="creature-selection-"]')).toHaveLength(0);
  });
});
