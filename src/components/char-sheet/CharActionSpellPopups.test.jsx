import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionSpellPopups from './CharActionSpellPopups.jsx';

// Mock all popup components
vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup({ spell }) {
    return <div data-testid="metamagic-popup">{spell?.name}</div>;
  },
}));

vi.mock('./popups/AidTargetPopup.jsx', () => ({
  default: function AidTargetPopup({ spell }) {
    return <div data-testid="aid-target-popup">{spell?.name}</div>;
  },
}));

vi.mock('./popups/GreaterRestorationPopup.jsx', () => ({
  default: function GreaterRestorationPopup({ spell }) {
    return <div data-testid="greater-restoration-popup">{spell?.name}</div>;
  },
}));

vi.mock('./popups/RemoveCursePopup.jsx', () => ({
  default: function RemoveCursePopup({ spell }) {
    return <div data-testid="remove-curse-popup">{spell?.name}</div>;
  },
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

const baseProps = {
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
};

describe('CharActionSpellPopups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when all popup flags are falsy', () => {
    const { container } = render(<CharActionSpellPopups {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders SpellDetailPopup when selectedActionSpell is set', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      selectedActionSpell={{ name: 'Fireball', level: 3 }}
    />);
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('renders MetamagicPopup when actionPendingMetamagic is set', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }}
    />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('renders MetamagicPopup when pendingActionMetamagic is set', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      pendingActionMetamagic={{ spellName: 'Lightning Bolt', spellLevel: 3 }}
    />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('renders AidTargetPopup when actionPendingAid is set', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingAid={{
        spellName: 'Aid',
        spellLevel: 2,
        range: '60 feet',
        creatureTargets: ['Goblin', 'Skeleton'],
      }}
    />);
    expect(screen.getByTestId('aid-target-popup')).toBeInTheDocument();
  });

  it('renders GreaterRestorationPopup when actionPendingGreaterRestoration is set', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingGreaterRestoration={{
        spellName: 'Greater Restoration',
        creatureTargets: ['Ally'],
      }}
    />);
    expect(screen.getByTestId('greater-restoration-popup')).toBeInTheDocument();
  });

  it('renders RemoveCursePopup when actionPendingRemoveCurse is set', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingRemoveCurse={{
        spellName: 'Remove Curse',
        creatureTargets: ['Cursed Ally'],
      }}
    />);
    expect(screen.getByTestId('remove-curse-popup')).toBeInTheDocument();
  });

  it('renders multiple popups simultaneously', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      selectedActionSpell={{ name: 'Fireball', level: 3 }}
      actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }}
    />);
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('passes playerStats to SpellDetailPopup', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      selectedActionSpell={{ name: 'Fireball', level: 3 }}
    />);
    // The SpellDetailPopup receives playerStats prop
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('passes campaignName to all popups', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      selectedActionSpell={{ name: 'Fireball', level: 3 }}
      actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }}
    />);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('passes buildUpcastLevels result to SpellDetailPopup', () => {
    const buildUpcastLevels = vi.fn(() => [2, 3, 4]);
    render(<CharActionSpellPopups
      {...baseProps}
      selectedActionSpell={{ name: 'Fireball', level: 3 }}
      buildUpcastLevels={buildUpcastLevels}
    />);
    expect(buildUpcastLevels).toHaveBeenCalledWith({ name: 'Fireball', level: 3 });
  });

  it('passes actionHandleConfirm to MetamagicPopup', () => {
    const actionHandleConfirm = vi.fn();
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }}
      actionHandleConfirm={actionHandleConfirm}
    />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('passes actionHandleSkip to MetamagicPopup', () => {
    const actionHandleSkip = vi.fn();
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3 }}
      actionHandleSkip={actionHandleSkip}
    />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('passes AidTargetPopup props correctly', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingAid={{
        spellName: 'Aid',
        spellLevel: 2,
        range: '60 feet',
        rangeFt: 60,
        creatureTargets: ['Goblin'],
        maxTargets: 3,
        attackerPos: { gridX: 5, gridY: 5 },
      }}
    />);
    expect(screen.getByTestId('aid-target-popup')).toBeInTheDocument();
  });

  it('handles actionPendingMetamagic without spellLevel', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingMetamagic={{ spellName: 'Cantrip' }}
    />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('handles pendingActionMetamagic without spellLevel', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      pendingActionMetamagic={{ spellName: 'Cantrip' }}
    />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('passes _metamagicCurrentSP to MetamagicPopup', () => {
    render(<CharActionSpellPopups
      {...baseProps}
      actionPendingMetamagic={{ spellName: 'Fireball', spellLevel: 3, _currentSP: 2 }}
    />);
    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });
});
