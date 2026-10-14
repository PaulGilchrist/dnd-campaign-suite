import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionSpellPopups from './CharActionSpellPopups.jsx';

vi.mock('../common/popup.jsx', () => ({
  default: function TestPopup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: function TestMetamagicPopup({ spell, playerStats, onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <span data-testid="metamagic-spell-name">{spell?.name}</span>
        <span data-testid="metamagic-spell-level">{spell?.level}</span>
        <span data-testid="metamagic-is-psionic">{String(playerStats?._isPsionicSpell)}</span>
        <span data-testid="metamagic-psionic-cost">{String(playerStats?._psionicCost)}</span>
        {onConfirm && <button data-testid="metamagic-confirm" onClick={onConfirm}>Confirm</button>}
        {onSkip && <button data-testid="metamagic-skip" onClick={onSkip}>Skip</button>}
      </div>
    );
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
  default: function TestSpellDetailPopup({ spell, playerStats, campaignName, playerLevel, upcastLevels, onClose, onCast }) {
    return (
      <div data-testid="spell-detail-popup">
        <span data-testid="detail-spell-name">{spell?.name}</span>
        <span data-testid="detail-spell-level">{spell?.level}</span>
        <span data-testid="detail-player-name">{playerStats?.name}</span>
        <span data-testid="detail-player-level">{playerLevel}</span>
        <span data-testid="detail-campaign">{campaignName}</span>
        <span data-testid="detail-upcast-count">{upcastLevels?.length}</span>
        {onClose && <button data-testid="detail-close" onClick={onClose}>Close</button>}
        {onCast && <button data-testid="detail-cast" onClick={onCast}>Cast</button>}
      </div>
    );
  },
}));

vi.mock('./popups/MagicMissileTargetPopup.jsx', () => ({
  default: function TestMagicMissileTargetPopup({ spell, totalMissiles, missileDamage, creatureTargets, currentTargetName, onConfirm, onSkip }) {
    return (
      <div data-testid="magic-missile-popup">
        <span data-testid="mm-spell-name">{spell?.name}</span>
        <span data-testid="mm-spell-level">{spell?.level}</span>
        <span data-testid="mm-total-missiles">{totalMissiles}</span>
        <span data-testid="mm-missile-damage">{missileDamage}</span>
        <span data-testid="mm-creature-count">{creatureTargets?.length}</span>
        <span data-testid="mm-current-target">{currentTargetName || 'none'}</span>
        {creatureTargets?.map(name => (
          <span key={name} data-testid="mm-creature-name">{name}</span>
        ))}
        {onConfirm && <button data-testid="mm-confirm" onClick={() => onConfirm({ distribution: {} })}>Confirm</button>}
        {onSkip && <button data-testid="mm-skip" onClick={onSkip}>Skip</button>}
      </div>
    );
  },
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestSecondaryTargetModal({ title, targets, onTargetSelected, onSkip, description, confirmLabel }) {
    return (
      <div data-testid={`secondary-modal-${title}`}>
        <span data-testid="title">{title}</span>
        <span data-testid="description">{description}</span>
        <span data-testid="confirm-label">{confirmLabel}</span>
        {targets?.map((t, i) => (
          <span key={i} data-testid={`target-${i}`} onClick={() => onTargetSelected(t.value !== undefined ? t.value : t.name)}>
            {t.value !== undefined ? t.label : t.name}
          </span>
        ))}
        <button data-testid="skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

const mockedDamageUtils = vi.hoisted(() => ({
  getTargetFromAttacker: vi.fn(() => null),
}));

const mockedCombatData = vi.hoisted(() => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => mockedDamageUtils);

vi.mock('../../services/encounters/combatData.js', () => mockedCombatData);

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

describe('CharActionSpellPopups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SpellDetailPopup', () => {
    it('calls setSelectedActionSpell(null) when closing', () => {
      const setSelectedActionSpell = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ setSelectedActionSpell })}
          selectedActionSpell={{ name: 'Fireball', level: 3 }}
        />
      );
      screen.getByTestId('detail-close').click();
      expect(setSelectedActionSpell).toHaveBeenCalledWith(null);
    });
  });

  describe('MetamagicPopup (actionPendingMetamagic)', () => {
    it('calls actionHandleConfirm on confirm', () => {
      const actionHandleConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleConfirm })}
          actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }}
        />
      );
      screen.getByTestId('metamagic-confirm').click();
      expect(actionHandleConfirm).toHaveBeenCalled();
    });

    it('calls actionHandleSkip on skip', () => {
      const actionHandleSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleSkip })}
          actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }}
        />
      );
      screen.getByTestId('metamagic-skip').click();
      expect(actionHandleSkip).toHaveBeenCalled();
    });

    it('forwards _isPsionicSpell/_psionicCost so the Psionic Sorcery option renders (CLA-271)', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingMetamagic={{ spellName: 'Dissonant Whispers', spellLevel: 1, isPsionic: true, psionicCost: 1 }}
        />
      );
      expect(screen.getByTestId('metamagic-is-psionic')).toHaveTextContent('true');
      expect(screen.getByTestId('metamagic-psionic-cost')).toHaveTextContent('1');
    });
  });

  describe('MetamagicPopup (pendingActionMetamagic)', () => {
    it('calls handleActionMetamagicConfirm on confirm', () => {
      const handleActionMetamagicConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ handleActionMetamagicConfirm })}
          pendingActionMetamagic={{ spellName: 'Empowered Spell', spellLevel: 0 }}
        />
      );
      screen.getByTestId('metamagic-confirm').click();
      expect(handleActionMetamagicConfirm).toHaveBeenCalled();
    });

    it('calls handleActionMetamagicSkip on skip', () => {
      const handleActionMetamagicSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ handleActionMetamagicSkip })}
          pendingActionMetamagic={{ spellName: 'Empowered Spell', spellLevel: 0 }}
        />
      );
      screen.getByTestId('metamagic-skip').click();
      expect(handleActionMetamagicSkip).toHaveBeenCalled();
    });

    it('forwards _isPsionicSpell/_psionicCost so the Psionic Sorcery option renders (CLA-271)', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          pendingActionMetamagic={{ spellName: 'Dissonant Whispers', spellLevel: 1, isPsionic: true, psionicCost: 1 }}
        />
      );
      expect(screen.getByTestId('metamagic-is-psionic')).toHaveTextContent('true');
      expect(screen.getByTestId('metamagic-psionic-cost')).toHaveTextContent('1');
    });
  });

  describe('CreatureSelectionModal (Aid)', () => {
    it('calls actionHandleAidConfirm on confirm with target names', () => {
      const actionHandleAidConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleAidConfirm })}
          actionPendingAid={{ creatureTargets: ['Ally1', 'Ally2'], maxTargets: 3 }}
        />
      );
      screen.getByTestId('confirm').click();
      expect(actionHandleAidConfirm).toHaveBeenCalledWith(['Ally1', 'Ally2']);
    });

    it('calls actionHandleAidSkip on skip', () => {
      const actionHandleAidSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleAidSkip })}
          actionPendingAid={{ creatureTargets: ['Ally'], maxTargets: 3 }}
        />
      );
      screen.getByTestId('skip').click();
      expect(actionHandleAidSkip).toHaveBeenCalled();
    });
  });

  describe('SecondaryTargetModal (Haste)', () => {
    it('calls actionHandleHasteConfirm with single-element array on target select', () => {
      const actionHandleHasteConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleHasteConfirm })}
          actionPendingHaste={{ creatureTargets: ['Ally1'] }}
        />
      );
      screen.getByTestId('target-0').click();
      expect(actionHandleHasteConfirm).toHaveBeenCalledWith(['Ally1']);
    });

    it('calls actionHandleHasteSkip on skip', () => {
      const actionHandleHasteSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleHasteSkip })}
          actionPendingHaste={{ creatureTargets: ['Ally1'] }}
        />
      );
      screen.getByTestId('skip').click();
      expect(actionHandleHasteSkip).toHaveBeenCalled();
    });
  });

  describe('SecondaryTargetModal (Remove Curse)', () => {
    it('calls actionHandleRemoveCurseSkip when skip is clicked', () => {
      const actionHandleRemoveCurseSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleRemoveCurseSkip })}
          actionPendingRemoveCurse={{ creatureTargets: ['Ally1'], range: 'Touch' }}
        />
      );
      screen.getByTestId('skip').click();
      expect(actionHandleRemoveCurseSkip).toHaveBeenCalled();
    });

    it('calls actionHandleRemoveCurseConfirm with target name on target select', () => {
      const actionHandleRemoveCurseConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleRemoveCurseConfirm })}
          actionPendingRemoveCurse={{ creatureTargets: ['Ally1'], range: 'Touch' }}
        />
      );
      screen.getByTestId('target-0').click();
      expect(actionHandleRemoveCurseConfirm).toHaveBeenCalledWith({ targetName: 'Ally1' });
    });
  });

  describe('MagicMissileTargetPopup', () => {
    it('calls actionHandleMagicMissileConfirm on confirm', () => {
      const actionHandleMagicMissileConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleMagicMissileConfirm })}
          actionPendingMagicMissile={{
            spell: { name: 'Magic Missile', level: 1 },
            totalMissiles: 3,
            missileDamage: '1d4+1',
            creatureTargets: ['Goblin'],
          }}
        />
      );
      screen.getByTestId('mm-confirm').click();
      expect(actionHandleMagicMissileConfirm).toHaveBeenCalled();
    });

    it('calls actionHandleMagicMissileSkip on skip', () => {
      const actionHandleMagicMissileSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleMagicMissileSkip })}
          actionPendingMagicMissile={{
            spell: { name: 'Magic Missile', level: 1 },
            totalMissiles: 3,
            missileDamage: '1d4+1',
            creatureTargets: ['Goblin'],
          }}
        />
      );
      screen.getByTestId('mm-skip').click();
      expect(actionHandleMagicMissileSkip).toHaveBeenCalled();
    });
  });
});
