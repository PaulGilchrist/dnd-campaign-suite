import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharSpells from './CharSpells.jsx';
import * as helpers from './CharSpells.test-utils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useDiceRollPopup.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({
    resolvePositions: vi.fn(() => Promise.resolve()),
    cachedPosRef: { current: null },
  })),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({})),
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

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function CharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup() {
    return <div data-testid="metamagic-popup" />;
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup() {
    return <div data-testid="multi-target-popup" />;
  },
}));

vi.mock('../popups/MultiTargetCountPopup.jsx', () => ({
  default: function MultiTargetCountPopup() {
    return <div data-testid="aid-target-popup" />;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="greater-restoration-popup" />;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="mage-armor-popup" />;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="protection-from-energy-popup" />;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup" />;
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup() {
    return <div data-testid="upcast-popup" />;
  },
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: function DiceRollResult() {
    return <div data-testid="dice-roll-result" />;
  },
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));



const basePlayerStats = helpers.mockPlayerStats;
const baseProps = { playerStats: basePlayerStats, campaignName: 'test' };

function renderWithProps(props) {
  return render(<CharSpells {...baseProps} {...props} />);
}

describe('CharSpells - Table Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('table structure', () => {
    it.each`
      ruleset                | playerStats              | expectedHeaders
      ${'5e'}                | ${basePlayerStats}       | ${['Spell', 'Level', 'Prepared', 'Time', 'Range', 'Effect', 'Duration', 'Notes']}
      ${'2024'}              | ${helpers.mockPlayerStats2024} | ${['Spell', 'Level', 'Time', 'Range', 'Effect', 'Duration', 'Notes']}
      ${'2024 wizard'}       | ${helpers.mockPlayerStats2024Wizard} | ${['Spell', 'Level', 'Prepared', 'Time', 'Range', 'Effect', 'Duration', 'Notes']}
    `('renders correct headers for $ruleset rules', ({ playerStats, expectedHeaders }) => {
      renderWithProps({ playerStats });
      const headers = screen.getAllByRole('columnheader').map(th => th.textContent.trim());
      expect(headers).toEqual(expectedHeaders);
    });
  });

  describe('prepared column', () => {
    it('renders checkboxes for spells with prepared: "Prepared"', () => {
      const spellWithCheckbox = {
        name: 'Shield',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: '1 round',
        components: ['S'],
        prepared: 'Prepared',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellWithCheckbox],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    });

    it('toggles checkbox checked state and calls handleTogglePreparedSpells', () => {
      const spellWithCheckbox = {
        name: 'Shield',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: '1 round',
        components: ['S'],
        prepared: 'Prepared',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellWithCheckbox],
        },
      };
      const toggleFn = vi.fn();
      render(<CharSpells playerStats={stats} campaignName="test" handleTogglePreparedSpells={toggleFn} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      fireEvent.click(checkbox);
      expect(toggleFn).toHaveBeenCalledWith('Shield');
    });

    it('does not render prepared column or checkboxes for non-wizard 2024 rules', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024 });
      expect(screen.queryAllByRole('columnheader').map(th => th.textContent.trim())).not.toContain('Prepared');
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('renders the prepared column and checkboxes for a 2024 wizard', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024Wizard });
      const headers = screen.getAllByRole('columnheader').map(th => th.textContent.trim());
      expect(headers).toContain('Prepared');
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      checkboxes.forEach(checkbox => expect(checkbox).not.toBeChecked());
    });

    it('prevents opening spell detail for unprepared non-ritual 2024 wizard spells', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024Wizard });
      const shieldCell = screen.getByText('Shield');
      fireEvent.click(shieldCell);
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('allows opening spell detail for unprepared ritual 2024 wizard spells', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024Wizard });
      const detectMagicCell = screen.getByText('Detect Magic');
      fireEvent.click(detectMagicCell);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('sorts spells alphabetically when Spell header is clicked', () => {
      renderWithProps({});
      const spellHeader = screen.getByText('Spell');
      fireEvent.click(spellHeader);
      const spellNames = screen.getAllByText(/^(Detect Magic|Light)$/);
      expect(spellNames[0].textContent).toBe('Detect Magic');
      expect(spellNames[1].textContent).toBe('Light');
    });

    it('sorts spells by level ascending when Level header is clicked', () => {
      renderWithProps({});
      const levelHeader = screen.getByText('Level');
      fireEvent.click(levelHeader);
      const firstSpellCell = screen.getAllByRole('row')[1].querySelectorAll('td')[0];
      expect(firstSpellCell.textContent).toBe('Light');
    });
  });

  describe('edge cases', () => {
    it('hides the table when no spells remain after filtering', () => {
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [],
        },
      };
      renderWithProps({ playerStats: stats });
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });
});
