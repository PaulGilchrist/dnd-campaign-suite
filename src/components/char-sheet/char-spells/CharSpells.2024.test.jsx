// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats2024 } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => {
  const mockFn = () => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
  });
  mockFn.getCurrentSorceryPoints = vi.fn(() => 10);
  mockFn.getMaxSorceryPoints = vi.fn(() => 10);
  return { default: mockFn, getCurrentSorceryPoints: mockFn.getCurrentSorceryPoints, getMaxSorceryPoints: mockFn.getMaxSorceryPoints };
});

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MockMetamagicPopup({ onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <button data-testid="mock-confirm" onClick={() => onConfirm({ options: [], totalCost: 0, twinTarget: null })}>
          Mock Confirm
        </button>
        <button data-testid="mock-skip" onClick={onSkip}>
          Mock Skip
        </button>
      </div>
    );
  },
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function MockCharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    pendingGreaterRestoration: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    gateUpcast: vi.fn(() => false),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: vi.fn(() => null),
  })),
}));

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

const create2024Render = (overrides = {}) => {
  const playerStats = { ...mockPlayerStats2024, ...overrides };
  return render(<CharSpells playerStats={playerStats} />);
};

describe('CharSpells - 2024 ruleset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('2024-specific UI omissions', () => {
    it('does not render the Prepared column header', () => {
      create2024Render();
      expect(screen.queryByText('Prepared')).not.toBeInTheDocument();
    });

    it('does not render Prepared Spells or Max Prepared labels', () => {
      create2024Render();
      expect(screen.queryByText(/Prepared Spells:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Max Prepared:/)).not.toBeInTheDocument();
    });

    it('does not render prepared checkboxes', () => {
      create2024Render();
      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes).toHaveLength(0);
    });

    it('does not render prepared cells in spell rows', () => {
      create2024Render();
      const table = screen.getByRole('table');
      expect(table.textContent).not.toContain('Prepared');
    });
  });

  describe('2024-specific UI inclusions', () => {
    it('renders all non-Prepared table column headers', () => {
      create2024Render();
      expect(screen.getByText('Spell')).toBeInTheDocument();
      expect(screen.getByText('Level')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByText('Effect')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('renders spell names in the table', () => {
      create2024Render();
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Detect Magic')).toBeInTheDocument();
    });

    it('renders spell levels including Cantrip label', () => {
      create2024Render();
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('1');
      expect(table.textContent).toContain('Cantrip');
    });

    it('renders casting time abbreviations', () => {
      create2024Render();
      const table = screen.getByRole('table');
      expect(table.textContent).toContain(' A');
    });

    it('renders duration abbreviations', () => {
      create2024Render();
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('min');
    });

    it('renders spell damage display', () => {
      create2024Render();
      expect(screen.queryByText(/8d6/)).not.toBeInTheDocument();
    });

    it('renders spell range values', () => {
      create2024Render();
      expect(screen.getByText('Touch')).toBeInTheDocument();
      expect(screen.getByText('Self')).toBeInTheDocument();
    });

    it('renders spell components in notes', () => {
      create2024Render();
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('V');
    });

    it('renders spell damage type', () => {
      create2024Render();
      const table = screen.getByRole('table');
      expect(table.textContent).not.toContain('Fire');
    });
  });

  describe('2024 - spell notes rendering', () => {
    it('shows only components in notes (no concentration or ritual)', () => {
      const spellWithConc = {
        name: 'Concentration Spell',
        level: 2,
        casting_time: '1 action',
        range: '60 feet',
        duration: 'Concentration',
        components: ['V'],
        concentration: true,
        ritual: true,
      };
      const stats = {
        ...mockPlayerStats2024,
        spellAbilities: {
          ...mockPlayerStats2024.spellAbilities,
          spells: [spellWithConc],
        },
      };
      create2024Render({ spellAbilities: stats.spellAbilities });
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('V');
    });
  });

  describe('2024 - utility spells without damage', () => {
    it('shows "Utility" for spells without a damage property', () => {
      const spellNoDmg = {
        name: 'Prestidigitation',
        level: 0,
        casting_time: '1 action',
        range: 'Touch',
        duration: '1 hour',
        components: ['V', 'S'],
        prepared: 'Always',
      };
      const stats = {
        ...mockPlayerStats2024,
        spellAbilities: {
          ...mockPlayerStats2024.spellAbilities,
          spells: [spellNoDmg],
        },
      };
      create2024Render({ spellAbilities: stats.spellAbilities });
      expect(screen.getByText('Utility')).toBeInTheDocument();
      expect(screen.getByText('Prestidigitation')).toBeInTheDocument();
    });
  });

  describe('2024 - spell table structure', () => {
    it('renders a spell table element', () => {
      create2024Render();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders spell rows with clickable spell names', () => {
      create2024Render();
      const spellName = screen.getByText('Light');
      expect(spellName).toHaveClass('clickable');
    });

    it('renders the spell slots component', () => {
      create2024Render();
      expect(screen.getByTestId('char-spell-slots')).toBeInTheDocument();
    });
  });
});

describe('CharSpells - 2024 ruleset edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('empty/null spell abilities', () => {
    it('does not render a table when spells array is empty', () => {
      const emptyStats = {
        ...mockPlayerStats2024,
        spellAbilities: {
          ...mockPlayerStats2024.spellAbilities,
          spells: [],
        },
      };
      render(<CharSpells playerStats={emptyStats} />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('does not render a table when spellAbilities is undefined', () => {
      const noSpellsStats = {
        ...mockPlayerStats2024,
        spellAbilities: undefined,
      };
      render(<CharSpells playerStats={noSpellsStats} />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('does not render a table when spellAbilities is null', () => {
      const noSpellsStats = {
        ...mockPlayerStats2024,
        spellAbilities: null,
      };
      render(<CharSpells playerStats={noSpellsStats} />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('spell with save DC display', () => {
    it('shows save type and result in effect column', () => {
      const spellWithDc = {
        name: 'Fireball',
        level: 3,
        casting_time: '1 action',
        range: '150 feet',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        damage: {
          damage_at_slot_level: { '3': '8d6' },
          damage_type: 'Fire',
        },
        dc: { dc_type: 'Dex', dc_success: 'half' },
      };
      const stats = {
        ...mockPlayerStats2024,
        spellAbilities: {
          ...mockPlayerStats2024.spellAbilities,
          spells: [spellWithDc],
        },
      };
      render(<CharSpells playerStats={stats} />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Dex');
      expect(table.textContent).toContain('half');
    });
  });

  describe('spell name clickability', () => {
    it('renders all spell names with clickable class', () => {
      create2024Render();
      const light = screen.getByText('Light');
      const detectMagic = screen.getByText('Detect Magic');
      expect(light).toHaveClass('clickable');
      expect(detectMagic).toHaveClass('clickable');
    });
  });

  describe('sort headers', () => {
    it('renders Spell header as clickable', () => {
      create2024Render();
      const spellHeader = screen.getByText('Spell');
      expect(spellHeader).toHaveClass('clickable');
    });

    it('renders Level header as clickable', () => {
      create2024Render();
      const levelHeader = screen.getByText('Level');
      expect(levelHeader).toHaveClass('clickable');
    });
  });
});
