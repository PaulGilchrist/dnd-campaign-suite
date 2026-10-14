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
  default: function TestCreatureSelectionModal() {
    return <div data-testid="creature-selection-modal" />;
  },
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestSecondaryTargetModal({ title, targets, onTargetSelected, onSkip, description, confirmLabel, hideConfirm }) {
    return (
      <div data-testid={`secondary-modal-${title}`}>
        <span data-testid="title">{title}</span>
        <span data-testid="description">{description}</span>
        <span data-testid="confirm-label">{confirmLabel}</span>
        {targets?.map((t, i) => (
          <span
            key={i}
            data-testid={`target-${i}`}
            data-target-value={t.value !== undefined ? t.value : t.name}
            onClick={() => onTargetSelected(t.value !== undefined ? t.value : t.name)}
          >
            {t.value !== undefined ? t.label : t.name}
          </span>
        ))}
        {!hideConfirm && targets?.length > 0 ? (
          <button data-testid="confirm" onClick={() => onTargetSelected(targets[0].value !== undefined ? targets[0].value : targets[0].name)}>Confirm</button>
        ) : null}
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

const runtimeStore = new Map();

function buildRuntimeKey(k, p) {
  return `${k}:${p}`;
}

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((key, prop) => {
    return runtimeStore.get(buildRuntimeKey(key, prop)) ?? null;
  }),
  setRuntimeValue: vi.fn(),
}));

function setTargetEffects(effects) {
  runtimeStore.set(buildRuntimeKey('campaign', 'targetEffects'), effects);
}

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

describe('CharActionSpellPopups - SecondaryTargetModal Spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeStore.clear();
    setTargetEffects(null);
  });

  const secondaryTargetSpells = [
    { name: 'Barkskin', key: 'actionPendingBarkskin', confirmHandler: 'actionHandleBarkskinConfirm', skipHandler: 'actionHandleBarkskinSkip', payload: { creatureTargets: ['Ally1'] }, description: 'AC becomes 17' },
    { name: 'Mage Armor', key: 'actionPendingMageArmor', confirmHandler: 'actionHandleMageArmorConfirm', skipHandler: 'actionHandleMageArmorSkip', payload: { creatureTargets: ['Ally1'] }, description: '13 + Dexterity modifier' },
    { name: 'Heal', key: 'actionPendingHeal', confirmHandler: 'actionHandleHealConfirm', skipHandler: 'actionHandleHealSkip', payload: { creatureTargets: ['Ally1'] }, description: '70 hit points' },
    { name: 'Cure Wounds', key: 'actionPendingCureWounds', confirmHandler: 'actionHandleCureWoundsConfirm', skipHandler: 'actionHandleCureWoundsSkip', payload: { creatureTargets: ['Ally1'] }, description: 'touch range' },
    { name: 'Revivify', key: 'actionPendingRevivify', confirmHandler: 'actionHandleRevivifyConfirm', skipHandler: 'actionHandleRevivifySkip', payload: { creatureTargets: ['Ally1'] }, description: '0 Hit Points' },
  ];

  describe('renders correct metadata', () => {
    it.each(secondaryTargetSpells)('renders $name with correct title, description, and confirm label', ({ name, key, payload, description }) => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({ [key]: payload })}
        />
      );
      expect(screen.getByTestId('title')).toHaveTextContent(name);
      expect(screen.getByTestId('description')).toHaveTextContent(description);
      expect(screen.getByTestId('confirm-label')).toHaveTextContent(`Cast ${name}`);
    });
  });

  describe('Empty targets', () => {
    it('renders no targets when creatureTargets is empty', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingHaste: { creatureTargets: [] },
          })}
        />
      );
      expect(screen.getByTestId('title')).toHaveTextContent('Haste');
      expect(screen.queryByTestId('target-0')).not.toBeInTheDocument();
    });
  });

  describe('Forcecage filtering', () => {
    it('filters out forcecage-trapped targets', () => {
      setTargetEffects([{ effect: 'forcecage', target: 'Ally1', source: 'Cage1' }]);
      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingHaste: { creatureTargets: ['Ally1', 'Ally2'] },
          })}
        />
      );
      expect(screen.getByTestId('target-0')).toHaveTextContent('Ally2');
      expect(screen.queryByTestId('target-1')).not.toBeInTheDocument();
    });

    it('allows all targets when no targetEffects exist', () => {
      setTargetEffects(null);
      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingHaste: { creatureTargets: ['Ally1', 'Ally2'] },
          })}
        />
      );
      expect(screen.getByTestId('target-0')).toHaveTextContent('Ally1');
      expect(screen.getByTestId('target-1')).toHaveTextContent('Ally2');
    });
  });
});
