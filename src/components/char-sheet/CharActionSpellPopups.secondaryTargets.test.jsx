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
  default: () => <div data-testid="metamagic-popup" />,
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: () => <div data-testid="spell-detail-popup" />,
}));

vi.mock('./popups/MagicMissileTargetPopup.jsx', () => ({
  default: () => <div data-testid="magic-missile-popup" />,
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestCreatureSelectionModal({ title, targets, onConfirm, onSkip }) {
    return (
      <div data-testid={`creature-selection-${title}`}>
        {(targets || []).map((t, i) => (
          <span key={i} data-testid={`target-${i}`}>{typeof t === 'string' ? t : t.name}</span>
        ))}
        <button data-testid="confirm" onClick={() => onConfirm((targets || []).map(t => (typeof t === 'string' ? t : t.name)))}>Confirm</button>
        <button data-testid="skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

// Touch-target specs always pass { name, type } objects; Greater Restoration's
// value/label effect step is owned by the greaterRestoration sibling file.
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestSecondaryTargetModal({ title, targets, onTargetSelected, onSkip, description, confirmLabel }) {
    return (
      <div data-testid={`secondary-modal-${title}`}>
        <span data-testid="title">{title}</span>
        <span data-testid="description">{description}</span>
        <span data-testid="confirm-label">{confirmLabel}</span>
        {(targets || []).map((t, i) => (
          <span key={i} data-testid={`target-${i}`} onClick={() => onTargetSelected(t.name)}>{t.name}</span>
        ))}
        <button data-testid="skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

const runtimeStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((key, prop) => runtimeStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn(),
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
    actionPendingHaste: null,
    actionHandleHasteConfirm: vi.fn(),
    actionHandleHasteSkip: vi.fn(),
    actionPendingBarkskin: null,
    actionHandleBarkskinConfirm: vi.fn(),
    actionHandleBarkskinSkip: vi.fn(),
    actionPendingHeal: null,
    actionHandleHealConfirm: vi.fn(),
    actionHandleHealSkip: vi.fn(),
    actionPendingGreaterRestoration: null,
    actionHandleGreaterRestorationConfirm: vi.fn(),
    actionHandleGreaterRestorationSkip: vi.fn(),
    actionHandleGreaterRestorationNoEffects: vi.fn(),
    actionPendingRemoveCurse: null,
    actionHandleRemoveCurseConfirm: vi.fn(),
    actionHandleRemoveCurseSkip: vi.fn(),
    actionPendingMagicMissile: null,
    actionHandleMagicMissileConfirm: vi.fn(),
    actionHandleMagicMissileSkip: vi.fn(),
    actionPendingMageArmor: null,
    actionHandleMageArmorConfirm: vi.fn(),
    actionHandleMageArmorSkip: vi.fn(),
    actionPendingCureWounds: null,
    actionHandleCureWoundsConfirm: vi.fn(),
    actionHandleCureWoundsSkip: vi.fn(),
    actionPendingRevivify: null,
    actionHandleRevivifyConfirm: vi.fn(),
    actionHandleRevivifySkip: vi.fn(),
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    ...overrides,
  };
}

// Haste and Remove Curse confirm/skip wiring is covered by CharActionSpellPopups.test.jsx;
// these rows complete touch-target-modal coverage for the remaining specs, including the
// per-spell payload shape (pick: 'array' sends [name], pick: 'object' sends { targetName }).
const TOUCH_TARGET_SPELLS = [
  { name: 'Barkskin', pending: 'actionPendingBarkskin', confirm: 'actionHandleBarkskinConfirm', skip: 'actionHandleBarkskinSkip', pick: 'array', description: 'AC becomes 17' },
  { name: 'Mage Armor', pending: 'actionPendingMageArmor', confirm: 'actionHandleMageArmorConfirm', skip: 'actionHandleMageArmorSkip', pick: 'array', description: '13 + Dexterity modifier' },
  { name: 'Heal', pending: 'actionPendingHeal', confirm: 'actionHandleHealConfirm', skip: 'actionHandleHealSkip', pick: 'object', description: '70 hit points' },
  { name: 'Cure Wounds', pending: 'actionPendingCureWounds', confirm: 'actionHandleCureWoundsConfirm', skip: 'actionHandleCureWoundsSkip', pick: 'object', description: 'touch range' },
  { name: 'Revivify', pending: 'actionPendingRevivify', confirm: 'actionHandleRevivifyConfirm', skip: 'actionHandleRevivifySkip', pick: 'object', description: '0 Hit Points' },
];

function visibleTargetNames() {
  return screen.queryAllByTestId(/^target-\d+$/).map(el => el.textContent);
}

describe('CharActionSpellPopups - SecondaryTargetModal Spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeStore.clear();
  });

  it.each(TOUCH_TARGET_SPELLS)(
    'runs $name target flow: metadata, $pick confirm payload, skip cancels',
    ({ name, pending, confirm, skip, pick, description }) => {
      const confirmFn = vi.fn();
      const skipFn = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ [confirm]: confirmFn, [skip]: skipFn })}
          {...{ [pending]: { creatureTargets: ['Ally1'] } }}
        />
      );

      expect(screen.getByTestId(`secondary-modal-${name}`)).toBeInTheDocument();
      expect(screen.getByTestId('title')).toHaveTextContent(name);
      expect(screen.getByTestId('confirm-label')).toHaveTextContent(`Cast ${name}`);
      expect(screen.getByTestId('description')).toHaveTextContent(description);
      expect(screen.getByTestId('target-0')).toHaveTextContent('Ally1');

      screen.getByTestId('target-0').click();
      expect(confirmFn).toHaveBeenCalledTimes(1);
      expect(confirmFn).toHaveBeenCalledWith(pick === 'array' ? ['Ally1'] : { targetName: 'Ally1' });

      screen.getByTestId('skip').click();
      expect(skipFn).toHaveBeenCalledTimes(1);
    }
  );

  it('still opens Haste when every creature target is empty so the cast can be cancelled', () => {
    const skipFn = vi.fn();
    render(
      <CharActionSpellPopups
        {...createBaseProps({ actionPendingHaste: { creatureTargets: [] }, actionHandleHasteSkip: skipFn })}
      />
    );
    expect(screen.getByTestId('secondary-modal-Haste')).toBeInTheDocument();
    expect(visibleTargetNames()).toHaveLength(0);
    screen.getByTestId('skip').click();
    expect(skipFn).toHaveBeenCalledTimes(1);
  });
});

// Canonical lane for filterForcecageBlockedTargets / isForcecageBlocked: one row per
// trapped-combination branch of the inside/outside-the-cage targeting rule.
describe('CharActionSpellPopups - Forcecage blocking filter', () => {
  const forcecage = (target, source) => ({ effect: 'forcecage', target, source });

  const blockedCases = [
    { name: 'allows all targets when no targetEffects exist', effects: null, expected: ['Ally1', 'Ally2'] },
    { name: 'ignores non-forcecage target effects', effects: [{ effect: 'bless', target: 'Ally1', source: 'Cleric' }], expected: ['Ally1', 'Ally2'] },
    { name: 'blocks a target trapped in another caster\'s cage', effects: [forcecage('Ally1', 'Cage1')], expected: ['Ally2'] },
    { name: 'blocks free targets when the caster is trapped', effects: [forcecage('Test Character', 'Cage1')], expected: [] },
    { name: 'allows a co-trapped ally in the same cage but not free outsiders', effects: [forcecage('Test Character', 'Cage1'), forcecage('Ally1', 'Cage1')], expected: ['Ally1'] },
    { name: 'blocks targets trapped in a different cage than the caster', effects: [forcecage('Test Character', 'Cage1'), forcecage('Ally1', 'Cage2')], expected: [] },
  ];

  it.each(blockedCases)('Haste target list: $name', ({ effects, expected }) => {
    if (effects) runtimeStore.set('campaign:targetEffects', effects);
    render(
      <CharActionSpellPopups
        {...createBaseProps({ actionPendingHaste: { creatureTargets: ['Ally1', 'Ally2'] } })}
      />
    );
    expect(visibleTargetNames()).toEqual(expected);
  });

  it('applies the same filter to the CreatureSelectionModal lane and its confirm payload', () => {
    const confirmFn = vi.fn();
    runtimeStore.set('campaign:targetEffects', [forcecage('Ally1', 'Cage1')]);
    render(
      <CharActionSpellPopups
        {...createBaseProps({
          actionPendingBless: { creatureTargets: ['Ally1', 'Ally2'], maxTargets: 3 },
          actionHandleBlessConfirm: confirmFn,
        })}
      />
    );
    expect(visibleTargetNames()).toEqual(['Ally2']);
    screen.getByTestId('confirm').click();
    expect(confirmFn).toHaveBeenCalledWith(['Ally2']);
  });
});
