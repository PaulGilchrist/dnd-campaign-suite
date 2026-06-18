// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionSpellPopups from './CharActionSpellPopups.jsx';

vi.mock('../common/Popup.jsx', () => ({
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

vi.mock('./popups/AidTargetPopup.jsx', () => ({
  default: function TestAidTargetPopup({ spell, range, rangeFt, creatureTargets, maxTargets, attackerPos, onConfirm, onSkip }) {
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

vi.mock('./popups/GreaterRestorationPopup.jsx', () => ({
  default: function TestGreaterRestorationPopup({ spell, creatureTargets, range, onConfirm, onSkip }) {
    return (
      <div data-testid="greater-restoration-popup">
        <span data-testid="gr-spell-name">{spell?.name}</span>
        <span data-testid="gr-spell-level">{spell?.level}</span>
        <span data-testid="gr-creature-count">{creatureTargets?.length}</span>
        <span data-testid="gr-range">{range}</span>
        {onConfirm && <button data-testid="gr-confirm" onClick={onConfirm}>Confirm</button>}
        {onSkip && <button data-testid="gr-skip" onClick={onSkip}>Skip</button>}
      </div>
    );
  },
}));

vi.mock('./popups/RemoveCursePopup.jsx', () => ({
  default: function TestRemoveCursePopup({ spell, creatureTargets, range, onConfirm, onSkip }) {
    return (
      <div data-testid="remove-curse-popup">
        <span data-testid="rc-spell-name">{spell?.name}</span>
        <span data-testid="rc-spell-level">{spell?.level}</span>
        <span data-testid="rc-creature-count">{creatureTargets?.length}</span>
        <span data-testid="rc-range">{range}</span>
        {onConfirm && <button data-testid="rc-confirm" onClick={onConfirm}>Confirm</button>}
        {onSkip && <button data-testid="rc-skip" onClick={onSkip}>Skip</button>}
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
    ...overrides,
  };
}

describe('CharActionSpellPopups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no popups visible', () => {
    it('renders an empty fragment when all popup flags are null', () => {
      const { container } = render(<CharActionSpellPopups {...createBaseProps()} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders an empty fragment when all popup flags are undefined', () => {
      const { container } = render(
        <CharActionSpellPopups
          {...createBaseProps()}
          selectedActionSpell={undefined}
          actionPendingMetamagic={undefined}
          pendingActionMetamagic={undefined}
          actionPendingAid={undefined}
          actionPendingGreaterRestoration={undefined}
          actionPendingRemoveCurse={undefined}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders all popups when all popup flags are empty objects (truthy)', () => {
      const { container } = render(
        <CharActionSpellPopups
          {...createBaseProps()}
          selectedActionSpell={{}}
          actionPendingMetamagic={{}}
          pendingActionMetamagic={{}}
          actionPendingAid={{}}
          actionPendingGreaterRestoration={{}}
          actionPendingRemoveCurse={{}}
        />
      );
      expect(container).not.toBeEmptyDOMElement();
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getAllByTestId('metamagic-popup')).toHaveLength(2);
      expect(screen.getByTestId('aid-target-popup')).toBeInTheDocument();
      expect(screen.getByTestId('greater-restoration-popup')).toBeInTheDocument();
      expect(screen.getByTestId('remove-curse-popup')).toBeInTheDocument();
    });
  });

  describe('SpellDetailPopup rendering', () => {
    it('renders SpellDetailPopup when selectedActionSpell is a truthy object', () => {
      render(<CharActionSpellPopups {...createBaseProps()} selectedActionSpell={{ name: 'Fireball', level: 3 }} />);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('does not render SpellDetailPopup when selectedActionSpell is null', () => {
      render(<CharActionSpellPopups {...createBaseProps()} selectedActionSpell={null} />);
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('does not render SpellDetailPopup when selectedActionSpell is undefined', () => {
      render(<CharActionSpellPopups {...createBaseProps()} selectedActionSpell={undefined} />);
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('renders SpellDetailPopup when selectedActionSpell has no level property', () => {
      render(<CharActionSpellPopups {...createBaseProps()} selectedActionSpell={{ name: 'Minor Illusion' }} />);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
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

    it('passes the selected spell name and level to SpellDetailPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          selectedActionSpell={{ name: 'Lightning Bolt', level: 3 }}
        />
      );
      expect(screen.getByTestId('detail-spell-name')).toHaveTextContent('Lightning Bolt');
      expect(screen.getByTestId('detail-spell-level')).toHaveTextContent('3');
    });

    it('passes playerStats.name and playerStats.level to SpellDetailPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({ playerStats: { name: 'Grog', level: 12 } })}
          selectedActionSpell={{ name: 'Gnashing Teeth', level: 0 }}
        />
      );
      expect(screen.getByTestId('detail-player-name')).toHaveTextContent('Grog');
      expect(screen.getByTestId('detail-player-level')).toHaveTextContent('12');
    });

    it('passes campaignName to SpellDetailPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({ campaignName: 'my-campaign' })}
          selectedActionSpell={{ name: 'Fireball', level: 3 }}
        />
      );
      expect(screen.getByTestId('detail-campaign')).toHaveTextContent('my-campaign');
    });

    it('wraps SpellDetailPopup in a Popup component', () => {
      render(<CharActionSpellPopups {...createBaseProps()} selectedActionSpell={{ name: 'Fireball', level: 3 }} />);
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    it('passes onClose handler to Popup that calls setSelectedActionSpell', () => {
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

    it('passes onCast handler to SpellDetailPopup', () => {
      const handleActionSpellCast = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ handleActionSpellCast })}
          selectedActionSpell={{ name: 'Fireball', level: 3 }}
        />
      );
      expect(screen.getByTestId('detail-cast')).toBeInTheDocument();
    });
  });

  describe('MetamagicPopup rendering (actionPendingMetamagic)', () => {
    it('renders MetamagicPopup when actionPendingMetamagic is truthy', () => {
      render(<CharActionSpellPopups {...createBaseProps()} actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }} />);
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('does not render MetamagicPopup when actionPendingMetamagic is null', () => {
      render(<CharActionSpellPopups {...createBaseProps()} actionPendingMetamagic={null} />);
      expect(screen.queryByTestId('metamagic-popup')).not.toBeInTheDocument();
    });

    it('passes spell name and level to MetamagicPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingMetamagic={{ spellName: 'Eldritch Blast', spellLevel: 0 }}
        />
      );
      expect(screen.getByTestId('metamagic-spell-name')).toHaveTextContent('Eldritch Blast');
      expect(screen.getByTestId('metamagic-spell-level')).toHaveTextContent('0');
    });

    it('passes spell level 0 when spellLevel is missing from actionPendingMetamagic', () => {
      render(<CharActionSpellPopups {...createBaseProps()} actionPendingMetamagic={{ spellName: 'Ray of Frost' }} />);
      expect(screen.getByTestId('metamagic-spell-level')).toHaveTextContent('0');
    });

    it('passes onConfirm handler from actionHandleConfirm', () => {
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

    it('passes onSkip handler from actionHandleSkip', () => {
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

    it('passes playerStats with _metamagicCurrentSP to MetamagicPopup when _currentSP is provided', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingMetamagic={{ spellName: 'Empowered Spell', spellLevel: 0, _currentSP: 2 }}
        />
      );
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('passes playerStats without _metamagicCurrentSP when _currentSP is not provided', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingMetamagic={{ spellName: 'Quickened Spell', spellLevel: 0 }}
        />
      );
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('passes campaignName to MetamagicPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({ campaignName: 'forge-campaign' })}
          actionPendingMetamagic={{ spellName: 'Twin Spell', spellLevel: 2 }}
        />
      );
      // The Popup wrapper receives campaignName via context through its children
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });
  });

  describe('MetamagicPopup rendering (pendingActionMetamagic)', () => {
    it('renders MetamagicPopup when pendingActionMetamagic is truthy', () => {
      render(<CharActionSpellPopups {...createBaseProps()} pendingActionMetamagic={{ spellName: 'Sorcery Surge', spellLevel: 1 }} />);
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('does not render MetamagicPopup when pendingActionMetamagic is null', () => {
      render(<CharActionSpellPopups {...createBaseProps()} pendingActionMetamagic={null} />);
      expect(screen.queryByTestId('metamagic-popup')).not.toBeInTheDocument();
    });

    it('passes spell name and level from pendingActionMetamagic to MetamagicPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          pendingActionMetamagic={{ spellName: 'Distant Spell', spellLevel: 1 }}
        />
      );
      expect(screen.getByTestId('metamagic-spell-name')).toHaveTextContent('Distant Spell');
      expect(screen.getByTestId('metamagic-spell-level')).toHaveTextContent('1');
    });

    it('passes spell level 0 when spellLevel is missing from pendingActionMetamagic', () => {
      render(<CharActionSpellPopups {...createBaseProps()} pendingActionMetamagic={{ spellName: 'Twinned Spell' }} />);
      expect(screen.getByTestId('metamagic-spell-level')).toHaveTextContent('0');
    });

    it('passes onConfirm handler from handleActionMetamagicConfirm', () => {
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

    it('passes onSkip handler from handleActionMetamagicSkip', () => {
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

    it('passes playerStats with _metamagicCurrentSP from pendingActionMetamagic._currentSP', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          pendingActionMetamagic={{ spellName: 'Subtle Spell', spellLevel: 0, _currentSP: 1 }}
        />
      );
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });
  });

  describe('AidTargetPopup rendering', () => {
    it('renders AidTargetPopup when actionPendingAid is truthy', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingAid={{
            spellName: 'Aid',
            spellLevel: 2,
            range: '30 feet',
            rangeFt: 30,
            creatureTargets: ['Goblin', 'Skeleton'],
            maxTargets: 3,
            attackerPos: { gridX: 5, gridY: 5 },
          }}
        />
      );
      expect(screen.getByTestId('aid-target-popup')).toBeInTheDocument();
    });

    it('does not render AidTargetPopup when actionPendingAid is null', () => {
      render(<CharActionSpellPopups {...createBaseProps()} actionPendingAid={null} />);
      expect(screen.queryByTestId('aid-target-popup')).not.toBeInTheDocument();
    });

    it('passes spell name and level to AidTargetPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2 }}
        />
      );
      expect(screen.getByTestId('aid-spell-name')).toHaveTextContent('Aid');
      expect(screen.getByTestId('aid-spell-level')).toHaveTextContent('2');
    });

    it('passes range and rangeFt to AidTargetPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2, range: '60 feet', rangeFt: 60 }}
        />
      );
      expect(screen.getByTestId('aid-range')).toHaveTextContent('60 feet');
      expect(screen.getByTestId('aid-range-ft')).toHaveTextContent('60');
    });

    it('passes creatureTargets and maxTargets to AidTargetPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2, creatureTargets: ['Ally1', 'Ally2'], maxTargets: 5 }}
        />
      );
      expect(screen.getByTestId('aid-creature-count')).toHaveTextContent('2');
      expect(screen.getByTestId('aid-max-targets')).toHaveTextContent('5');
    });

    it('passes attackerPos to AidTargetPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2, attackerPos: { gridX: 10, gridY: 20 } }}
        />
      );
      expect(screen.getByTestId('aid-attacker-pos')).toHaveTextContent('10,20');
    });

    it('passes onConfirm handler from actionHandleAidConfirm', () => {
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

    it('passes onSkip handler from actionHandleAidSkip', () => {
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

    it('passes campaignName to AidTargetPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({ campaignName: 'aid-test' })}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2 }}
        />
      );
      expect(screen.getByTestId('aid-target-popup')).toBeInTheDocument();
    });
  });

  describe('GreaterRestorationPopup rendering', () => {
    it('renders GreaterRestorationPopup when actionPendingGreaterRestoration is truthy', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingGreaterRestoration={{
            spellName: 'Greater Restoration',
            creatureTargets: ['Ally'],
          }}
        />
      );
      expect(screen.getByTestId('greater-restoration-popup')).toBeInTheDocument();
    });

    it('does not render GreaterRestorationPopup when actionPendingGreaterRestoration is null', () => {
      render(<CharActionSpellPopups {...createBaseProps()} actionPendingGreaterRestoration={null} />);
      expect(screen.queryByTestId('greater-restoration-popup')).not.toBeInTheDocument();
    });

    it('passes spell name and level to GreaterRestorationPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingGreaterRestoration={{ spellName: 'Greater Restoration', spellLevel: 5 }}
        />
      );
      expect(screen.getByTestId('gr-spell-name')).toHaveTextContent('Greater Restoration');
      expect(screen.getByTestId('gr-spell-level')).toHaveTextContent('5');
    });

    it('passes creatureTargets to GreaterRestorationPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingGreaterRestoration={{ spellName: 'Greater Restoration', creatureTargets: ['Target1', 'Target2'] }}
        />
      );
      expect(screen.getByTestId('gr-creature-count')).toHaveTextContent('2');
    });

    it('passes range to GreaterRestorationPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingGreaterRestoration={{ spellName: 'Greater Restoration', range: 'Touch' }}
        />
      );
      expect(screen.getByTestId('gr-range')).toHaveTextContent('Touch');
    });

    it('passes onConfirm handler from actionHandleGreaterRestorationConfirm', () => {
      const actionHandleGreaterRestorationConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleGreaterRestorationConfirm })}
          actionPendingGreaterRestoration={{ spellName: 'Greater Restoration' }}
        />
      );
      screen.getByTestId('gr-confirm').click();
      expect(actionHandleGreaterRestorationConfirm).toHaveBeenCalled();
    });

    it('passes onSkip handler from actionHandleGreaterRestorationSkip', () => {
      const actionHandleGreaterRestorationSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleGreaterRestorationSkip })}
          actionPendingGreaterRestoration={{ spellName: 'Greater Restoration' }}
        />
      );
      screen.getByTestId('gr-skip').click();
      expect(actionHandleGreaterRestorationSkip).toHaveBeenCalled();
    });

    it('passes campaignName to GreaterRestorationPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({ campaignName: 'restoration-test' })}
          actionPendingGreaterRestoration={{ spellName: 'Greater Restoration' }}
        />
      );
      expect(screen.getByTestId('greater-restoration-popup')).toBeInTheDocument();
    });
  });

  describe('RemoveCursePopup rendering', () => {
    it('renders RemoveCursePopup when actionPendingRemoveCurse is truthy', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingRemoveCurse={{
            spellName: 'Remove Curse',
            creatureTargets: ['Cursed Ally'],
          }}
        />
      );
      expect(screen.getByTestId('remove-curse-popup')).toBeInTheDocument();
    });

    it('does not render RemoveCursePopup when actionPendingRemoveCurse is null', () => {
      render(<CharActionSpellPopups {...createBaseProps()} actionPendingRemoveCurse={null} />);
      expect(screen.queryByTestId('remove-curse-popup')).not.toBeInTheDocument();
    });

    it('passes spell name and level to RemoveCursePopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingRemoveCurse={{ spellName: 'Remove Curse', spellLevel: 3 }}
        />
      );
      expect(screen.getByTestId('rc-spell-name')).toHaveTextContent('Remove Curse');
      expect(screen.getByTestId('rc-spell-level')).toHaveTextContent('3');
    });

    it('passes creatureTargets to RemoveCursePopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingRemoveCurse={{ spellName: 'Remove Curse', creatureTargets: ['Cursed Sword'] }}
        />
      );
      expect(screen.getByTestId('rc-creature-count')).toHaveTextContent('1');
    });

    it('passes range to RemoveCursePopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          actionPendingRemoveCurse={{ spellName: 'Remove Curse', range: 'Touch' }}
        />
      );
      expect(screen.getByTestId('rc-range')).toHaveTextContent('Touch');
    });

    it('passes onConfirm handler from actionHandleRemoveCurseConfirm', () => {
      const actionHandleRemoveCurseConfirm = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleRemoveCurseConfirm })}
          actionPendingRemoveCurse={{ spellName: 'Remove Curse' }}
        />
      );
      screen.getByTestId('rc-confirm').click();
      expect(actionHandleRemoveCurseConfirm).toHaveBeenCalled();
    });

    it('passes onSkip handler from actionHandleRemoveCurseSkip', () => {
      const actionHandleRemoveCurseSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleRemoveCurseSkip })}
          actionPendingRemoveCurse={{ spellName: 'Remove Curse' }}
        />
      );
      screen.getByTestId('rc-skip').click();
      expect(actionHandleRemoveCurseSkip).toHaveBeenCalled();
    });

    it('passes campaignName to RemoveCursePopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({ campaignName: 'curse-test' })}
          actionPendingRemoveCurse={{ spellName: 'Remove Curse' }}
        />
      );
      expect(screen.getByTestId('remove-curse-popup')).toBeInTheDocument();
    });
  });

  describe('multiple popups simultaneously', () => {
    it('renders SpellDetailPopup and MetamagicPopup together', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          selectedActionSpell={{ name: 'Fireball', level: 3 }}
          actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }}
        />
      );
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('renders all five popup types simultaneously', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          selectedActionSpell={{ name: 'Fireball', level: 3 }}
          actionPendingMetamagic={{ spellName: 'Empowered Spell', spellLevel: 0 }}
          actionPendingAid={{ spellName: 'Aid', spellLevel: 2, creatureTargets: ['Ally'] }}
          actionPendingGreaterRestoration={{ spellName: 'Greater Restoration', creatureTargets: ['Ally'] }}
          actionPendingRemoveCurse={{ spellName: 'Remove Curse', creatureTargets: ['Cursed Item'] }}
        />
      );
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
      expect(screen.getByTestId('aid-target-popup')).toBeInTheDocument();
      expect(screen.getByTestId('greater-restoration-popup')).toBeInTheDocument();
      expect(screen.getByTestId('remove-curse-popup')).toBeInTheDocument();
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

    it('renders MetamagicPopup from pendingActionMetamagic alongside SpellDetailPopup', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps()}
          selectedActionSpell={{ name: 'Lightning Bolt', level: 3 }}
          pendingActionMetamagic={{ spellName: 'Twin Spell', spellLevel: 1 }}
        />
      );
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });
  });
});
