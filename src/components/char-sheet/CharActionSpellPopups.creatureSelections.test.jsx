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

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestCreatureSelectionModal({ title, icon, targets, maxTargets, description, confirmLabel, confirmIcon: _, onConfirm, onSkip }) {
    return (
      <div data-testid={`creature-selection-${title}`}>
        <span data-testid="title">{title}</span>
        <span data-testid="icon">{icon}</span>
        <span data-testid="description">{description}</span>
        <span data-testid="creature-count">{targets?.length}</span>
        <span data-testid="max-targets">{maxTargets}</span>
        <span data-testid="confirm-label">{confirmLabel}</span>
        {onConfirm && <button data-testid="confirm" onClick={() => onConfirm(targets?.map(t => t.name || t))}>Confirm</button>}
        {onSkip && <button data-testid="skip" onClick={onSkip}>Skip</button>}
        {targets?.map((t, i) => (
          <span key={i} data-testid={`target-${i}`}>{typeof t === 'string' ? t : t.name}</span>
        ))}
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

describe('CharActionSpellPopups - CreatureSelectionModal Spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const creatureSelectionSpells = [
    { name: 'Aid', key: 'actionPendingAid', handleConfirm: 'actionHandleAidConfirm', handleSkip: 'actionHandleAidSkip', props: { creatureTargets: ['Ally1', 'Ally2'], maxTargets: 3 } },
    { name: 'Bane', key: 'actionPendingBane', handleConfirm: 'actionHandleBaneConfirm', handleSkip: 'actionHandleBaneSkip', props: { creatureTargets: ['Goblin1', 'Goblin2'], maxTargets: 3 } },
    { name: 'Bless', key: 'actionPendingBless', handleConfirm: 'actionHandleBlessConfirm', handleSkip: 'actionHandleBlessSkip', props: { creatureTargets: ['Ally1', 'Ally2'], maxTargets: 3 } },
    { name: 'Faerie Fire', key: 'actionPendingFaerieFire', handleConfirm: 'actionHandleFaerieFireConfirm', handleSkip: 'actionHandleFaerieFireSkip', props: { creatureTargets: ['Goblin1', 'Goblin2'] } },
    { name: 'Beacon of Hope', key: 'actionPendingBeaconOfHope', handleConfirm: 'actionHandleBeaconOfHopeConfirm', handleSkip: 'actionHandleBeaconOfHopeSkip', props: { creatureTargets: ['Ally1', 'Ally2'] } },
    { name: 'Pass Without Trace', key: 'actionPendingPassWithoutTrace', handleConfirm: 'actionHandlePassWithoutTraceConfirm', handleSkip: 'actionHandlePassWithoutTraceSkip', props: { creatureTargets: ['Ally1', 'Ally2'] } },
  ];

  it.each(creatureSelectionSpells)('renders CreatureSelectionModal for $name', ({ name, key, props }) => {
    const propsWithSpell = { ...createBaseProps(), [key]: { ...props } };
    render(<CharActionSpellPopups {...propsWithSpell} />);
    expect(screen.getByTestId(`creature-selection-${name}`)).toBeInTheDocument();
  });

  it.each(creatureSelectionSpells)('calls the confirm handler for $name with target names', ({ key, handleConfirm, props }) => {
    const handleConfirmFn = vi.fn();
    const propsWithSpell = { ...createBaseProps({ [handleConfirm]: handleConfirmFn }), [key]: { ...props } };
    render(<CharActionSpellPopups {...propsWithSpell} />);
    screen.getByTestId('confirm').click();
    expect(handleConfirmFn).toHaveBeenCalledWith(props.creatureTargets);
  });

  it.each(creatureSelectionSpells)('calls the skip handler for $name', ({ key, handleSkip, props }) => {
    const handleSkipFn = vi.fn();
    const propsWithSpell = { ...createBaseProps({ [handleSkip]: handleSkipFn }), [key]: { ...props } };
    render(<CharActionSpellPopups {...propsWithSpell} />);
    screen.getByTestId('skip').click();
    expect(handleSkipFn).toHaveBeenCalled();
  });
});
