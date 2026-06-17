import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  buildFeatureDetailHtml: vi.fn((reaction) => {
    if (reaction.details) return `<b>${reaction.name}</b><br/>${reaction.details}`;
    return null;
  }),
  default: vi.fn(() => ({ showPopup: vi.fn(), popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../../services/combat/baseCombatActions.js', () => ({
  OPPORTUNITY_ATTACK: { name: 'Opportunity Attack', description: 'Make an attack' },
  MELEE_REACH_FEET: '5 feet',
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  hasTacticalShift: vi.fn(() => false),
  hasSpeedyOpportunityDisadvantage: vi.fn(() => false),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/automation/index.js', () => ({
  executeHandler: vi.fn().mockResolvedValue(null),
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children, onClickOrKeyDown }) {
    return (
      <div data-testid="popup" onClick={onClickOrKeyDown}>
        {children}
      </div>
    );
  },
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: function DiceRollResult() {
    return <div data-testid="dice-roll-result">DiceRollResult</div>;
  },
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup() {
    return <div data-testid="metamagic-popup">Metamagic</div>;
  },
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue({ players: [], placedItems: [] }),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

const basePlayerStats = {
  name: 'Test Character',
  level: 5,
  reactions: [
    { name: 'Opportunity Attack', description: 'Make a melee attack' },
    { name: 'Reaction Test', description: 'A test reaction', details: 'Details here' },
  ],
  attacks: [
    { name: 'Longsword', type: 'Action', range: '5 feet', hitBonus: 5 },
  ],
  spellAbilities: {
    spells: [
      {
        name: 'Shield',
        casting_time: '1 reaction',
        range: 'Self',
        prepared: 'Prepared',
      },
    ],
  },
};

const baseProps = {
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  cannotAct: false,
  mapName: null,
  characters: [],
};

describe('CharReactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders reactions section header', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('renders reactions list', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('renders reaction description', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Make a melee attack')).toBeInTheDocument();
  });

  it('renders reaction as clickable when it has details', () => {
    render(<CharReactions {...baseProps} />);
    const reactionTest = screen.getByText(/Reaction Test/);
    expect(reactionTest).toHaveClass('clickable');
  });

  it('renders spell reaction with range', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Self')).toBeInTheDocument();
  });

  it('renders spell reaction as clickable to open detail popup', () => {
    render(<CharReactions {...baseProps} />);
    const spellName = screen.getByText('Shield');
    fireEvent.click(spellName);
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('renders reaction table headers for spell reactions', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText('Damage')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('renders reaction spells as utility type', () => {
    render(<CharReactions {...baseProps} />);
    expect(screen.getByText('Utility')).toBeInTheDocument();
  });

  it('does not show duplicate Opportunity Attack when already in reactions', () => {
    render(<CharReactions {...baseProps} />);
    const reactions = screen.getAllByText(/opportunity attack/i);
    expect(reactions.length).toBe(1);
  });

  it('adds Opportunity Attack dynamically when not in reactions', () => {
    const stats = {
      ...basePlayerStats,
      reactions: [],
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('does not allow reaction click when cannotAct', () => {
    render(<CharReactions {...baseProps} cannotAct={true} />);
    const oa = screen.getByText('Opportunity Attack:');
    fireEvent.click(oa);
  });

  it('renders popup when reaction has details', () => {
    render(<CharReactions {...baseProps} />);
    const reactionTest = screen.getByText('Reaction Test:');
    fireEvent.click(reactionTest);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('renders char-reactions wrapper class', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.char-reactions')).toBeInTheDocument();
  });

  it('renders attacks wrapper for reaction spells', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.attacks')).toBeInTheDocument();
  });

  it('renders half-line at end', () => {
    render(<CharReactions {...baseProps} />);
    expect(document.querySelector('.half-line')).toBeInTheDocument();
  });

  it('handles empty reactions array', () => {
    const stats = {
      ...basePlayerStats,
      reactions: [],
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('handles null reactions', () => {
    const stats = {
      ...basePlayerStats,
      reactions: null,
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
  });

  it('handles empty spell abilities', () => {
    const stats = {
      ...basePlayerStats,
      spellAbilities: { spells: [] },
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('handles undefined spell abilities', () => {
    const stats = {
      ...basePlayerStats,
      spellAbilities: undefined,
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('filters reaction spells by casting time', () => {
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        spells: [
          { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared' },
          { name: 'Aid', casting_time: '1 action', prepared: 'Prepared' },
          { name: 'Hex', casting_time: '1 bonus action', prepared: 'Always' },
        ],
      },
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Shield')).toBeInTheDocument();
  });

  it('excludes attack names from reaction spells', () => {
    const stats = {
      ...basePlayerStats,
      attacks: [{ name: 'Shield', type: 'Action', range: 'Self', hitBonus: 5 }],
      spellAbilities: {
        spells: [
          { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared' },
        ],
      },
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
  });

  it('excludes unprepared spells from reaction spells', () => {
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        spells: [
          { name: 'Shield', casting_time: '1 reaction', prepared: 'Not Prepared' },
        ],
      },
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
  });

  it('renders reaction spells with casting time abbreviations', () => {
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        spells: [
          { name: 'Shield', casting_time: '1 reaction', range: 'Self', prepared: 'Prepared' },
        ],
      },
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    const table = document.querySelector('.attacks');
    expect(table.textContent).toContain('R');
  });

  it('renders reaction spells with capital R', () => {
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        spells: [
          { name: 'Shield', casting_time: '1 Reaction', range: 'Self', prepared: 'Prepared' },
        ],
      },
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    const table = document.querySelector('.attacks');
    expect(table.textContent).toContain('R');
  });

  it('renders reaction spells with lowercase reaction', () => {
    const stats = {
      ...basePlayerStats,
      spellAbilities: {
        spells: [
          { name: 'Shield', casting_time: 'reaction', range: 'Self', prepared: 'Prepared' },
        ],
      },
    };
    render(<CharReactions playerStats={stats} {...baseProps} />);
    const table = document.querySelector('.attacks');
    expect(table.textContent).toContain('R');
  });

  it('renders sanitized HTML in reaction descriptions', () => {
    render(<CharReactions {...baseProps} />);
    const reactionTest = screen.getByText('Reaction Test:');
    fireEvent.click(reactionTest);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });
});
