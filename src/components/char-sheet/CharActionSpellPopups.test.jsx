// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionSpellPopups from './CharActionSpellPopups.jsx';

vi.mock('../common/popup.jsx', () => ({
  default: function TestPopup({ children, onClickOrKeyDown }) {
    return (
      <div data-testid="popup" onClick={onClickOrKeyDown}>
        {children}
      </div>
    );
  },
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: function TestMetamagicPopup({ spell, onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <span data-testid="metamagic-spell-name">{spell?.name}</span>
        <span data-testid="metamagic-spell-level">{spell?.level}</span>
        {onConfirm && <button data-testid="metamagic-confirm" onClick={onConfirm}>Confirm</button>}
        {onSkip && <button data-testid="metamagic-skip" onClick={onSkip}>Skip</button>}
      </div>
    );
  },
}));

vi.mock('./popups/MultiTargetCountPopup.jsx', () => ({
  default: function TestMultiTargetCountPopup({ spell, range, rangeFt, creatureTargets, maxTargets, attackerPos, onConfirm, onSkip }) {
    return (
      <div data-testid="aid-target-popup">
        <span data-testid="aid-spell-name">{spell?.name}</span>
        <span data-testid="aid-spell-level">{spell?.level}</span>
        <span data-testid="aid-range">{range}</span>
        <span data-testid="aid-range-ft">{rangeFt}</span>
        <span data-testid="aid-creature-count">{creatureTargets?.length}</span>
        <span data-testid="aid-max-targets">{maxTargets}</span>
        <span data-testid="aid-attacker-pos">{attackerPos ? `${attackerPos.gridX},${attackerPos.gridY}` : 'none'}</span>
        {onConfirm && <button data-testid="aid-confirm" onClick={onConfirm}>Confirm</button>}
        {onSkip && <button data-testid="aid-skip" onClick={onSkip}>Skip</button>}
      </div>
    );
  },
}));

vi.mock('./popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TestTargetWithCheckboxesPopup({ spell, creatureTargets, range, onConfirm, onSkip }) {
    return (
      <div data-testid="checkbox-popup">
        <span data-testid="checkbox-spell-name">{spell?.name}</span>
        <span data-testid="checkbox-spell-level">{spell?.level}</span>
        <span data-testid="checkbox-creature-count">{creatureTargets?.length}</span>
        <span data-testid="checkbox-range">{range}</span>
        {onConfirm && <button data-testid="checkbox-confirm" onClick={onConfirm}>Confirm</button>}
        {onSkip && <button data-testid="checkbox-skip" onClick={onSkip}>Skip</button>}
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
    actionPendingGreaterRestoration: null,
    actionHandleGreaterRestorationConfirm: vi.fn(),
    actionHandleGreaterRestorationSkip: vi.fn(),
    actionPendingRemoveCurse: null,
    actionHandleRemoveCurseConfirm: vi.fn(),
    actionHandleRemoveCurseSkip: vi.fn(),
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    actionPendingMagicMissile: null,
    actionHandleMagicMissileConfirm: vi.fn(),
    actionHandleMagicMissileSkip: vi.fn(),
    ...overrides,
  };
}

describe('CharActionSpellPopups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no popups visible', () => {
    it('renders an empty fragment when no popup flags are set', () => {
      const { container } = render(<CharActionSpellPopups {...createBaseProps()} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('SpellDetailPopup', () => {
    it('renders when selectedActionSpell is truthy', () => {
      render(<CharActionSpellPopups {...createBaseProps()} selectedActionSpell={{ name: 'Fireball', level: 3 }} />);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('passes playerStats to SpellDetailPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({ playerStats: { name: 'Grog', level: 12 } })}
          selectedActionSpell={{ name: 'Gnashing Teeth', level: 0 }}
        />
      );
      expect(screen.getByTestId('detail-player-name')).toHaveTextContent('Grog');
      expect(screen.getByTestId('detail-player-level')).toHaveTextContent('12');
    });

    it('calls buildUpcastLevels with the selected spell and passes the result as upcastLevels', () => {
      const buildUpcastLevels = vi.fn(() => [3, 4, 5]);
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          selectedActionSpell={{ name: 'Fireball', level: 3 }}
          buildUpcastLevels={buildUpcastLevels}
        />
      );
      expect(buildUpcastLevels).toHaveBeenCalledWith({ name: 'Fireball', level: 3 });
      expect(screen.getByTestId('detail-upcast-count')).toHaveTextContent('3');
    });

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
    it('renders when actionPendingMetamagic is truthy', () => {
      render(<CharActionSpellPopups {...createBaseProps()} actionPendingMetamagic={{ spellName: 'Empowered Spell', spellLevel: 3 }} />);
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

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
  });

  describe('MetamagicPopup (pendingActionMetamagic)', () => {
    it('renders when pendingActionMetamagic is truthy', () => {
      render(<CharActionSpellPopups {...createBaseProps()} pendingActionMetamagic={{ spellName: 'Sorcery Surge', spellLevel: 1 }} />);
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

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
  });

  describe('MultiTargetCountPopup (Aid)', () => {
    it('calls actionHandleAidConfirm on confirm', () => {
      const actionHandleAidConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleAidConfirm })}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2 }}
        />
      );
      screen.getByTestId('aid-confirm').click();
      expect(actionHandleAidConfirm).toHaveBeenCalled();
    });

    it('calls actionHandleAidSkip on skip', () => {
      const actionHandleAidSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleAidSkip })}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2 }}
        />
      );
      screen.getByTestId('aid-skip').click();
      expect(actionHandleAidSkip).toHaveBeenCalled();
    });
  });

  describe('TargetWithCheckboxesPopup', () => {
    it('renders when actionPendingGreaterRestoration is truthy', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingGreaterRestoration={{ spellName: 'Greater Restoration', spellLevel: 5, creatureTargets: ['Ally'] }}
        />
      );
      expect(screen.getByTestId('checkbox-popup')).toBeInTheDocument();
    });

    it('renders when actionPendingRemoveCurse is truthy', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingRemoveCurse={{ spellName: 'Remove Curse', spellLevel: 3, creatureTargets: ['Ally'] }}
        />
      );
      expect(screen.getByTestId('checkbox-popup')).toBeInTheDocument();
    });
  });

  describe('MagicMissileTargetPopup', () => {
    it('renders when actionPendingMagicMissile is truthy', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingMagicMissile={{
            spell: { name: 'Magic Missile', level: 1 },
            totalMissiles: 3,
            missileDamage: '1d4+1',
            creatureTargets: ['Goblin', 'Skeleton'],
          }}
        />
      );
      expect(screen.getByTestId('magic-missile-popup')).toBeInTheDocument();
    });

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

  describe('multiple popups simultaneously', () => {
    it('renders all popup types simultaneously', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          selectedActionSpell={{ name: 'Fireball', level: 3 }}
          actionPendingMetamagic={{ spellName: 'Empowered Spell', spellLevel: 0 }}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2, creatureTargets: ['Ally'] }}
        />
      );
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
      expect(screen.getByTestId('aid-target-popup')).toBeInTheDocument();
    });

    it('renders both MetamagicPopup variants simultaneously', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingMetamagic={{ spellName: 'Empowered Spell', spellLevel: 0 }}
          pendingActionMetamagic={{ spellName: 'Quickened Spell', spellLevel: 0 }}
        />
      );
      const popups = screen.getAllByTestId('metamagic-popup');
      expect(popups).toHaveLength(2);
    });
  });
});
